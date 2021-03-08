import fs from 'fs'
import path from 'path'
import util from 'util'
import glob from 'glob'
import {
  bucketsList,
  bucketsLinks,
  bucketsRemove,
  bucketsCreate,
  bucketsPushPaths,
  bucketsListPath,
  bucketsRemovePath,
  bucketsRoot,
  CHUNK_SIZE,
} from '@textile/buckets/dist/cjs/api'
import { Context } from '@textile/context'
import { GrpcConnection } from '@textile/grpc-connection'
import { RemovePathResponse, Root } from '@textile/buckets/dist/cjs/types'

const readFile = util.promisify(fs.readFile)
const globDir = util.promisify(glob)

function chunkBuffer(content: Buffer) {
  const size = 1024 * 1024 * 3
  const result = []
  const len = content.length
  let i = 0
  while (i < len) {
    result.push(content.slice(i, (i += size)))
  }
  return result
}

interface NextNode {
  files: Array<string>
  dirs: Array<string>
}
class BucketTree {
  constructor(public folders: Array<string> = [], public leafs: Array<string> = []) {}

  private removeFolder(folder: string) {
    const knownIndex = this.folders.indexOf(folder)
    if (knownIndex > -1) {
      this.folders.splice(knownIndex, 1)
    }
    return knownIndex
  }

  private removeLeaf(path: string) {
    const knownIndex = this.leafs.indexOf(path)
    if (knownIndex > -1) {
      this.leafs.splice(knownIndex, 1)
    }
    return knownIndex
  }

  remove(path: string) {
    if (path[0] !== '/') throw new Error('Unsupported path')
    const knownLeaf = this.removeLeaf(path)
    if (knownLeaf > -1) {
      let folder = `${path}`.replace(/\/[^\/]+$/, '')
      while (folder.length > 0) {
        // remove last folder
        this.removeFolder(folder)
        folder = folder.replace(/\/[^\/]+$/, '')
      }
    }
  }

  getDeletes() {
    let dirCount = this.folders.length
    let sorted = this.folders.sort((a, b) => a.length - b.length)
    for (let i = 0; i < dirCount; i++) {
      const folder = sorted[i]
      if (!folder) continue
      const reindex = false
      const folderDeletions = []
      for (const look of this.folders) {
        if (look.startsWith(`${folder}/`)) {
          folderDeletions.push(look)
        }
      }
      folderDeletions.forEach((drop) => this.removeFolder(drop))
      const fileDeleteions = []
      for (const look of this.leafs) {
        if (look.startsWith(`${folder}/`)) {
          fileDeleteions.push(look)
        }
      }
      fileDeleteions.forEach((drop) => this.removeLeaf(drop))
      if (reindex) {
        sorted = this.folders.sort((a, b) => a.length - b.length)
        dirCount = this.folders.length
      }
    }
    return [...this.leafs, ...this.folders]
  }
}

async function getNextNode(connection: GrpcConnection, bucketKey: string, path: string): Promise<NextNode> {
  const tree = await bucketsListPath(connection, bucketKey, path)
  const files: Array<string> = []
  const dirs: Array<string> = []
  if (tree.item) {
    for (const obj of tree.item.items) {
      if (obj.name === '.textileseed') continue
      if (obj.isDir) {
        dirs.push(`${path}/${obj.name}`)
      } else {
        files.push(`${path}/${obj.name}`)
      }
    }
  }
  return { files, dirs }
}

async function getTree(connection: GrpcConnection, bucketKey: string, path = '/'): Promise<BucketTree> {
  const leafs: Array<string> = []
  const folders: Array<string> = []
  const nodes: Array<string> = []
  const { files, dirs } = await getNextNode(connection, bucketKey, path)
  leafs.push(...files)
  folders.push(...dirs)
  nodes.push(...dirs)
  while (nodes.length > 0) {
    const dir = nodes.pop()
    if (!dir) continue
    const { files, dirs } = await getNextNode(connection, bucketKey, dir)
    leafs.push(...files)
    folders.push(...dirs)
    nodes.push(...dirs)
  }
  return new BucketTree(folders, leafs)
}

export type RunOutput = Map<string, string>

export async function execute(
  api: string,
  key: string,
  secret: string,
  thread: string,
  name: string,
  remove: string,
  pattern: string,
  dir: string,
  home: string,
): Promise<RunOutput> {
  const target = api.trim() != '' ? api.trim() : undefined

  const response: RunOutput = new Map()

  if (!key || key.trim() === '') {
    throw Error('Credentials required')
  }

  const keyInfo = {
    key,
    secret,
  }

  const expire: Date = new Date(Date.now() + 1000 * 1800) // 10min expiration
  const ctx = await new Context(target)
  await ctx.withKeyInfo(keyInfo, expire)

  if (thread.trim() === '') {
    throw Error('Existing thread required')
  }

  ctx.withThread(thread)
  const connection = new GrpcConnection(ctx)

  if (name.trim() === '') {
    throw Error('Every bucket needs a name')
  }

  const roots = await bucketsList(connection)
  const existing = roots.find((bucket: any) => bucket.name === name)
  if (remove === 'true') {
    if (existing) {
      await bucketsRemove(connection, existing.key)
      response.set('success', 'true')
      return response
    } else {
      throw Error('Bucket not found')
    }
  }

  let bucketKey = ''
  if (existing) {
    bucketKey = existing.key
  } else {
    const created = await bucketsCreate(connection, name)
    if (!created.root) {
      throw Error('Failed to create bucket')
    }
    bucketKey = created.root.key
  }

  const pathTree = await getTree(connection, bucketKey, '')

  const cwd = path.join(home, dir)
  const options = {
    cwd,
    nodir: true,
  }
  const files = await globDir(pattern, options)
  if (files.length === 0) {
    throw Error(`No files found: ${dir}`)
  }
  let streams = []
  for (const file of files) {
    pathTree.remove(`/${file}`)
    const stream = fs.createReadStream(path.join(cwd, file), {
      highWaterMark: CHUNK_SIZE,
    })
    streams.push({
      path: file,
      content: stream,
    })
  }

  // avoid requesting new head on every push path
  let root: string | Root | undefined = await bucketsRoot(connection, bucketKey)
  let raw
  for await (raw of bucketsPushPaths(connection, bucketKey, streams, { root })) root = raw.root
  if (!raw) {
    throw Error(`Failed to push data`)
  }
  // ensure latest root
  root = await bucketsRoot(connection, bucketKey)
  for (const orphan of pathTree.getDeletes()) {
    const rm: RemovePathResponse = await bucketsRemovePath(connection, bucketKey, orphan, { root })
    root = rm.root
  }

  const links = await bucketsLinks(connection, bucketKey, '/')

  const ipfs = !root ? '' : typeof root == 'string' ? root : root.path
  response.set('ipfs', ipfs.replace('/ipfs/', ''))
  response.set('ipfsUrl', `https://hub.textile.io${ipfs}`)

  const ipnsData = links.ipns.split('/')
  const ipns = ipnsData.length > 0 ? ipnsData[ipnsData.length - 1] : ''
  response.set('ipns', ipns)

  response.set('ipnsUrl', `${links.ipns}`)
  response.set('www', `${links.www}`)
  response.set('hub', `${links.url}`)
  response.set('key', `${bucketKey}`)
  return response
}

export async function apiConn(key: string, secret: string, thread: string, target?: string) {
  const keyInfo = {
    key,
    secret,
  }

  const expire: Date = new Date(Date.now() + 1000 * 1800) // 10min expiration
  const ctx = await new Context(target)
  await ctx.withKeyInfo(keyInfo, expire)

  if (thread.trim() === '') {
    throw Error('Existing thread required')
  }

  ctx.withThread(thread)
  const conn = new GrpcConnection(ctx)
  return conn
}

export function toDateString(date: number) {
  var d = new Date(date / 1000000)
  return d.toLocaleDateString("en-US")
}

export interface JSONPath {
  path: string
  name: string
  type: string
  children: Array<JSONPath>
}

export interface JSONBucket {
  key: string
  path: string,
  name: string,
  type: string,
  children: Array<JSONPath>
}

export async function getJSONTree(connection: GrpcConnection, bucketKey: string, name: string, path = '/'): Promise<JSONBucket> {
  const res: JSONBucket = {
    key: bucketKey,
    path: "/",
    name: name,
    type: "root",
    children: []
  }

  const { files, dirs } = await getNextNode(connection, bucketKey, path)
  for (const file of files) {
    res.children.push({
      path: file.split('/').reverse()[0],
      name: file,
      type: "file",
      children: []
    })
  }
  for (const dir of dirs) {
    const path = await jsonPath(connection, bucketKey, dir)
    res.children.push(path)
  }
  return res
}

async function jsonPath(connection: GrpcConnection, bucketKey: string, dir: string): Promise<JSONPath> {
  const dirNode: JSONPath = {
    name: dir.split('/').reverse()[0],
    path: dir,
    type: "directory",
    children: []
  }
  const { files, dirs } = await getNextNode(connection, bucketKey, dir)
  for (const file of files) {
    dirNode.children.push({
      name: file.split('/').reverse()[0],
      path: file,
      type: "file",
      children: []
    })
  }
  for (const dir of dirs) {
    const path = await jsonPath(connection, bucketKey, dir)
    dirNode.children.push(path)
  }
  return dirNode
}