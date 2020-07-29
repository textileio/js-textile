import { ListPathItem, ListPathReply } from '@textile/buckets-grpc/buckets_pb'
import { bucketsListPath, BucketsGrpcClient } from './api'
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

export type ListPathRecursive = ReturnType<typeof listPathRecursive>
/**
 * listPathRecursive returns a nested object of all paths (and info) in a bucket
 */
export async function listPathRecursive(
  grpc: BucketsGrpcClient,
  bucketKey: string,
  path: string,
  depth: number,
  currentDepth = 0,
) {
  const rootPath = path === '' || path === '.' || path === '/' ? '' : `${path}/`
  const tree = await bucketsListPath(grpc, bucketKey, path)
  if (tree.item && (currentDepth + 1 <= depth || depth == -1)) {
    for (let i = 0; i < tree.item.itemsList.length; i++) {
      const obj = tree.item.itemsList[i]
      if (!obj.isdir) continue
      const dirPath = `${rootPath}${obj.name}`
      const { item } = await listPathRecursive(grpc, bucketKey, dirPath, depth, currentDepth + 1)
      if (item) {
        tree.item.itemsList[i] = item
      }
    }
  }
  return tree
}

async function treeToPaths(tree: ListPathItem.AsObject, path?: string, dirs = true, depth = 5): Promise<Array<string>> {
  const result = []
  const fp = path ? `${path}/${tree.name}` : `${tree.name}`
  // Only push if dirs included or not a dir
  if (dirs || !tree.isdir) result.push(fp)
  if (tree.isdir) {
    for (const item of tree.itemsList) {
      const downtree = await treeToPaths(item, fp, dirs, depth)
      result.push(...downtree)
    }
  }
  return result
}

export type ListPathFlat = ReturnType<typeof listPathFlat>

/**
 * utilPathsList returns a string array of all paths in a bucket
 */
export async function listPathFlat(
  grpc: BucketsGrpcClient,
  bucketKey: string,
  path: string,
  dirs: boolean,
  depth: number,
) {
  const tree = await listPathRecursive(grpc, bucketKey, path, depth)
  if (!tree.item) return []
  return treeToPaths(tree.item, undefined, dirs)
}
