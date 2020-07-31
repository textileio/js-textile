import log from 'loglevel'
import { Context, defaultHost } from '@textile/context'
import { Client } from '@textile/hub-threads-client'
import { Identity } from '@textile/threads-core'
import { UserAuth, KeyInfo } from '@textile/security'
import { ThreadID } from '@textile/threads-id'
import {
  Root,
  InitReply,
  LinksReply,
  ListPathReply,
  ListPathItem,
  ArchiveReply,
  ArchiveStatusReply,
  ArchiveInfoReply,
} from '@textile/buckets-grpc/buckets_pb'
import {
  BucketsGrpcClient,
  bucketsArchiveWatch,
  bucketsArchiveInfo,
  bucketsArchiveStatus,
  bucketsArchive,
  bucketsRemovePath,
  bucketsRemove,
  bucketsPullIpfsPath,
  bucketsPullPath,
  bucketsPushPath,
  bucketsListIpfsPath,
  bucketsList,
  bucketsLinks,
  bucketsRoot,
  bucketsInit,
  PushPathResult,
} from './api'
import { listPathRecursive, listPathFlat } from './utils'

const logger = log.getLogger('buckets')

/**
 * Buckets is a web-gRPC wrapper client for communicating with the web-gRPC enabled Textile Buckets API.
 * @example
 * Initialize a the Bucket API and open an existing bucket (or init if new).
 * ```typescript
 * import { Buckets, UserAuth } from '@textile/hub'
 *
 * const getOrInit = async (auth: UserAuth, bucketName: string) => {
 *   const buckets = Buckets.withUserAuth(auth)
 *   // Automatically scopes future calls on `buckets` to the Thread containing the bucket
 *   const { root, threadID } = await buckets.getOrInit(bucketName)
 *   if (!root) throw new Error('bucket not created')
 *   const bucketKey = root.key
 *   return { buckets, bucketKey }
 * }
 * ```
 *
 * @example
 * Print the links for the bucket
 * ```typescript
 * import { Buckets } from '@textile/hub'
 *
 * // This method requires that you run "getOrInit" or have specified "withThread"
 * async function logLinks (buckets: Buckets, bucketKey: string) {
 *   const links = await buckets.links(bucketKey)
 *   console.log(links)
 * }
 * ```
 *
 * @example
 * Find an existing Bucket
 * ```typescript
 * import { Buckets } from '@textile/hub'
 *
 * // This method requires that you already specify the Thread containing
 * // the bucket with buckets.withThread(<thread name>).
 * const exists = async (buckets: Buckets, bucketName: string) => {
 *     const roots = await buckets.list();
 *     return roots.find((bucket) => bucket.name === bucketName)
 * }
 * ```
 *
 * @example
 * Push an folder in node.js
 * ```typescript
 * import fs from 'fs'
 * import util from 'util'
 * import glob from 'glob'
 * import { Buckets } from '@textile/hub'
 *
 * const globDir = util.promisify(glob)
 *
 * // expects an already setup buckets session using getOrInit or withThread
 * const exists = async (buckets: Buckets, bucketKey: string, dir: string) => {
 *   const files = await globDir('<dir glob options>')
 *   return await Promise.all(files.map(async (file) => {
 *     const filePath = dir + '/' + file
 *     var content = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 * 3 });
 *     const upload = {
 *       path: file,
 *       content
 *     }
 *     return await buckets.pushPath(bucketKey, file, upload)
 *   }))
 * }
 * ```
 */
export class Buckets extends GrpcAuthentication {
  /**
   * Open a new / existing bucket by bucket name and ThreadID (init not required)
   * @param name name of bucket
   * @param threadName the name of the thread where the bucket is stored (default `buckets`)
   * @param isPrivate encrypt the bucket contents (default `false`)
   * @param threadID id of thread where bucket is stored
   * @deprecated Open has been replaced with getOrInit
   */
  async open(
    name: string,
    threadName = 'buckets',
    isPrivate = false,
    threadID?: string,
  ): Promise<{ root?: Root.AsObject; threadID?: string }> {
    return this.getOrInit(name, threadName, isPrivate, threadID)
  }

  /**
   * Open a new / existing bucket by bucket name and ThreadID (init not required)
   * Replaces `open` command in older versions.
   * @param name name of bucket
   * @param threadName the name of the thread where the bucket is stored (default `buckets`)
   * @param isPrivate encrypt the bucket contents (default `false`)
   * @param threadID id of thread where bucket is stored
   * @example
   * Initialize a Bucket called "app-name-files"
   * ```tyepscript
   * import { Buckets, UserAuth } from '@textile/hub'
   *
   * const open = async (auth: UserAuth, name: string) => {
   *     const buckets = Buckets.withUserAuth(auth)
   *     const { root, threadID } = await buckets.getOrInit(name)
   *     return { buckets, root, threadID }
   * }
   * ```
   */
  async getOrInit(
    name: string,
    threadName = 'buckets',
    isPrivate = false,
    threadID?: string,
  ): Promise<{ root?: Root.AsObject; threadID?: string }> {
    const client = new Client(this.context)
    if (threadID) {
      const id = threadID
      const res = await client.listThreads()
      const exists = res.listList.find((thread: any) => thread.id === id)
      if (!exists) {
        const id = ThreadID.fromString(threadID)
        await client.newDB(id, threadName)
      }
      this.withThread(threadID)
    } else {
      try {
        const res = await client.getThread(threadName)
        const existingId = typeof res.id === 'string' ? res.id : ThreadID.fromBytes(res.id).toString()
        this.withThread(existingId)
      } catch (error) {
        if (error.message !== 'Thread not found') {
          throw new Error(error.message)
        }
        const newId = ThreadID.fromRandom()
        await client.newDB(newId, threadName)
        threadID = newId.toString()
        this.withThread(threadID)
      }
    }

    const roots = await this.list()
    const existing = roots.find((bucket) => bucket.name === name)
    if (existing) {
      return { root: existing, threadID }
    }
    const created = await this.init(name, isPrivate)
    return { root: created.root, threadID }
  }

  /**
   * Obtain a token for interacting with the remote API.
   * @param identity A user identity to use for interacting with buckets.
   */
  async getToken(identity: Identity) {
    const client = new Client(this.context)
    return client.getToken(identity)
  }

  /**
   * Obtain a token for interacting with the remote API.
   * @param identity A user identity to use for interacting with buckets.
   * @param callback A callback function that takes a `challenge` argument and returns a signed
   * message using the input challenge and the private key associated with `publicKey`.
   * @note `publicKey` must be the corresponding public key of the private key used in `callback`.
   */
  async getTokenChallenge(
    publicKey: string,
    callback: (challenge: Uint8Array) => Uint8Array | Promise<Uint8Array>,
  ): Promise<string> {
    const client = new Client(this.context)
    return client.getTokenChallenge(publicKey, callback)
  }

  /**
   * Initializes a new bucket.
   * @public
   * @param name Human-readable bucket name. It is only meant to help identify a bucket in a UI and is not unique.
   * @param isPrivate encrypt the bucket contents (default `false`)
   * @example
   * Initialize a Bucket called "app-name-files"
   * ```tyepscript
   * import { Buckets } from '@textile/hub'
   *
   * const init = async (buckets: Buckets) => {
   *     return buckets.init("app-name-files")
   * }
   * ```
   */
  async init(name: string, isPrivate = false): Promise<InitReply.AsObject> {
    logger.debug('init request')
    return bucketsInit(this, name, isPrivate)
  }

  /**
   * Returns the bucket root CID
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async root(key: string) {
    logger.debug('root request')
    return bucketsRoot(this, key)
  }

  /**
   * Returns a list of bucket links.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @example
   * Generate the HTTP, IPNS, and IPFS links for a Bucket
   * ```tyepscript
   * import { Buckets } from '@textile/hub'
   *
   * const getLinks = async (buckets: Buckets) => {
   *    const links = buckets.links(bucketKey)
   *    return links.ipfs
   * }
   *
   * const getIpfs = async (buckets: Buckets) => {
   *    const links = buckets.links(bucketKey)
   *    return links.ipfs
   * }
   * ```
   */
  async links(key: string): Promise<LinksReply.AsObject> {
    logger.debug('link request')
    return bucketsLinks(this, key)
  }

  /**
   * Returns a list of all bucket roots.
   * @example
   * Find an existing Bucket named "app-name-files"
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const exists = async (buckets: Buckets) => {
   *     const roots = await buckets.list();
   *     return roots.find((bucket) => bucket.name ===  "app-name-files")
   * }
   * ````
   */
  async list() {
    logger.debug('list request')
    return bucketsList(this)
  }

  /**
   * Returns information about a bucket path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param depth (optional) will walk the entire bucket to target depth (default = 1)
   */
  async listPath(key: string, path: string, depth = 1): Promise<ListPathReply.AsObject> {
    logger.debug('list path request')
    return await listPathRecursive(this, key, path, depth)
  }

  /**
   * listPathRecursive returns a nested object of all paths (and info) in a bucket
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param dirs (optional) if false will include only file paths
   * @param depth (optional) will walk the entire bucket to target depth (default = 1)
   *
   * @example
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * async function printPaths(buckets: Buckets, bucketKey: string) {
   *   const list = await buckets.listPathFlat(bucketKey, '')
   *   console.log(list)
   * }
   * // [
   * //   '.textileseed',
   * //   'dir1',
   * //   'dir1/file1.jpg',
   * //   'path',
   * //   'path/to',
   * //   'path/to/file2.jpg'
   * // ]
   * ```
   */
  async listPathFlat(key: string, path: string, dirs = true, depth = 5): Promise<Array<string>> {
    logger.debug('list path recursive request')
    return await listPathFlat(this, key, path, dirs, depth)
  }

  /**
   * listIpfsPath returns items at a particular path in a UnixFS path living in the IPFS network.
   * @param path UnixFS path
   */
  async listIpfsPath(path: string): Promise<ListPathItem.AsObject | undefined> {
    logger.debug('list path request')
    return bucketsListIpfsPath(this, path)
  }

  /**
   * Pushes a file to a bucket path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param input The input file/stream/object.
   * @param opts Options to control response stream. Currently only supports a progress function.
   * @remarks
   * This will return the resolved path and the bucket's new root path.
   * @example
   * Push a file to the root of a bucket
   * ```tyepscript
   * import { Buckets } from '@textile/hub'
   *
   * const pushFile = async (content: string, bucketKey: string) => {
   *    const file = { path: '/index.html', content: Buffer.from(content) }
   *    return await buckets.pushPath(bucketKey!, 'index.html', file)
   * }
   * ```
   *
   * @example
   * Push an folder in node.js
   * ```typescript
   * import fs from 'fs'
   * import util from 'util'
   * import glob from 'glob'
   * import { Buckets } from '@textile/hub'
   *
   * const globDir = util.promisify(glob)
   *
   * // expects an already setup buckets session using getOrInit or withThread
   * const exists = async (buckets: Buckets, bucketKey: string, dir: string) => {
   *   const files = await globDir('<dir glob options>')
   *   return await Promise.all(files.map(async (file) => {
   *     const filePath = dir + '/' + file
   *     var content = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 * 3 });
   *     const upload = {
   *       path: file,
   *       content
   *     }
   *     return await buckets.pushPath(bucketKey, file, upload)
   *   }))
   * }
   * ```
   */
  async pushPath(
    key: string,
    path: string,
    input: any,
    opts?: { progress?: (num?: number) => void },
  ): Promise<PushPathResult> {
    return bucketsPushPath(this, key, path, input, opts)
  }

  /**
   * Pulls the bucket path, returning the bytes of the given file.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param opts Options to control response stream. Currently only supports a progress function.
   */
  pullPath(key: string, path: string, opts?: { progress?: (num?: number) => void }): AsyncIterableIterator<Uint8Array> {
    return bucketsPullPath(this, key, path, opts)
  }

  /**
   * pullIpfsPath pulls the path from a remote UnixFS dag, writing it to writer if it's a file.
   * @param path A file/object (sub)-path within a bucket.
   * @param opts Options to control response stream. Currently only supports a progress function.
   */
  pullIpfsPath(path: string, opts?: { progress?: (num?: number) => void }): AsyncIterableIterator<Uint8Array> {
    return bucketsPullIpfsPath(this, path, opts)
  }

  /**
   * Removes an entire bucket. Files and directories will be unpinned.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async remove(key: string) {
    logger.debug('remove request')
    return bucketsRemove(this, key)
  }

  /**
   * Returns information about a bucket path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param root optional to specify a root
   */
  async removePath(key: string, path: string, root?: string) {
    logger.debug('remove path request')
    return bucketsRemovePath(this, key, path, root)
  }

  /**
   * archive creates a Filecoin bucket archive via Powergate.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async archive(key: string): Promise<ArchiveReply.AsObject> {
    logger.debug('archive request')
    return bucketsArchive(this, key)
  }

  /**
   * archiveStatus returns the status of a Filecoin bucket archive.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async archiveStatus(key: string): Promise<ArchiveStatusReply.AsObject> {
    logger.debug('archive status request')
    return bucketsArchiveStatus(this, key)
  }

  /**
   * archiveInfo returns info about a Filecoin bucket archive.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async archiveInfo(key: string): Promise<ArchiveInfoReply.AsObject> {
    logger.debug('archive info request')
    return bucketsArchiveInfo(this, key)
  }

  /**
   * archiveWatch watches status events from a Filecoin bucket archive.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async archiveWatch(key: string, callback: (reply?: { id: string | undefined; msg: string }, err?: Error) => void) {
    logger.debug('archive watch request')
    return bucketsArchiveWatch(this, key, callback)
  }
}
