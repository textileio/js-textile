import { GrpcConnection } from '@textile/grpc-connection'
import { bucketsListPath, PathItemObject, PathObject } from './api'

/**
 * bytesToArray converts a buffer into <4mb chunks for use with grpc API
 * @param chunk an input Buffer or Uint8Array
 */
export function bytesToArray(chunk: Uint8Array, size = 1024 * 1024 * 3) {
  const result = []
  const len = chunk.length
  let i = 0
  while (i < len) {
    result.push(chunk.slice(i, (i += size)))
  }
  return result
}

/**
 * listPathRecursive returns a nested object of all paths (and info) in a bucket
 */
export async function listPathRecursive(
  grpc: GrpcConnection,
  bucketKey: string,
  path: string,
  depth: number,
  currentDepth = 0,
): Promise<PathObject> {
  const rootPath = path === '' || path === '.' || path === '/' ? '' : `${path}/`
  const tree = await bucketsListPath(grpc, bucketKey, path)
  if (tree.item && (currentDepth + 1 <= depth || depth === -1)) {
    for (let i = 0; i < tree.item.items.length; i++) {
      const obj = tree.item.items[i]
      if (!obj.isDir) continue
      const dirPath = `${rootPath}${obj.name}`
      const { item } = await listPathRecursive(grpc, bucketKey, dirPath, depth, currentDepth + 1)
      if (item) {
        tree.item.items[i] = item
      }
    }
  }
  return tree
}

async function treeToPaths(
  tree: PathItemObject[],
  path?: string,
  dirs = true,
  depth = 5,
  currentDepth = 0,
): Promise<Array<string>> {
  const result = []
  for (const item of tree) {
    const newPath = path === '' ? `${item.name}` : `${path}/${item.name}`
    if (dirs || !item.isDir) result.push(newPath)
    if (item.isDir && (currentDepth < depth || depth === -1)) {
      const downtree = await treeToPaths(item.items, newPath, dirs, depth, currentDepth + 1)
      result.push(...downtree)
    }
  }
  return result
}

/**
 * listPathFlat returns a string array of all paths in a bucket
 */
export async function listPathFlat(
  grpc: GrpcConnection,
  bucketKey: string,
  path: string,
  dirs: boolean,
  depth: number,
): Promise<Array<string>> {
  const tree = await listPathRecursive(grpc, bucketKey, path, depth)
  if (!tree.item) return []
  return treeToPaths(tree.item.items, path, dirs)
}
