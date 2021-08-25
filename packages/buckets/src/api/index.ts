/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { grpc } from '@improbable-eng/grpc-web'
import { Repeater } from '@repeaterjs/repeater'
import {
  Archive as _Archive,
  ArchiveConfig as _ArchiveConfig,
  ArchiveRenew as _ArchiveRenew,
  ArchiveRequest,
  ArchivesRequest,
  ArchivesResponse,
  ArchiveStatus as _ArchiveStatus,
  ArchiveStatusMap as _ArchiveStatusMap,
  ArchiveWatchRequest,
  ArchiveWatchResponse,
  CreateRequest,
  CreateResponse as _CreateResponse,
  DealInfo as _DealInfo,
  DefaultArchiveConfigRequest,
  DefaultArchiveConfigResponse,
  LinksRequest,
  LinksResponse,
  ListIpfsPathRequest,
  ListIpfsPathResponse,
  ListPathRequest,
  ListPathResponse,
  ListRequest,
  ListResponse,
  Metadata as _Metadata,
  MovePathRequest,
  PathItem as _PathItem,
  PullIpfsPathRequest,
  PullIpfsPathResponse,
  PullPathAccessRolesRequest,
  PullPathAccessRolesResponse,
  PullPathRequest,
  PullPathResponse,
  PushPathAccessRolesRequest,
  PushPathRequest,
  PushPathResponse,
  PushPathsRequest,
  PushPathsResponse,
  RemovePathRequest,
  RemovePathResponse as _RemovePathResponse,
  RemoveRequest,
  Root as _Root,
  RootRequest,
  RootResponse,
  SetDefaultArchiveConfigRequest,
  SetPathRequest,
} from '@textile/buckets-grpc/api/bucketsd/pb/bucketsd_pb'
import {
  APIService,
  APIServiceClient,
  BidirectionalStream,
  Status,
} from '@textile/buckets-grpc/api/bucketsd/pb/bucketsd_pb_service'
import { Context, ContextInterface } from '@textile/context'
import { GrpcConnection } from '@textile/grpc-connection'
import { WebsocketTransport } from '@textile/grpc-transport'
import CID from 'cids'
import drain from 'it-drain'
import log from 'loglevel'
// @ts-expect-error: missing types
import paramap from 'paramap-it'
import {
  AbortError,
  Archive,
  ArchiveConfig,
  ArchiveDealInfo,
  ArchiveOptions,
  ArchiveRenew,
  Archives,
  ArchiveStatus,
  BuckMetadata,
  CreateResponse,
  Links,
  Path,
  PathAccessRole,
  PathItem,
  PushOptions,
  PushPathResult,
  PushPathsResult,
  RemovePathOptions,
  RemovePathResponse,
  Root,
} from '../types'
import { File, normaliseInput } from './normalize'

export { File }

const logger = log.getLogger('buckets-api')

function fromPbRootObject(root: _Root): Root {
  return {
    key: root.getKey(),
    name: root.getName(),
    path: root.getPath(),
    createdAt: root.getCreatedAt(),
    updatedAt: root.getUpdatedAt(),
    thread: root.getThread(),
  }
}

function fromPbRootObjectNullable(root?: _Root): Root | undefined {
  if (!root) return
  return fromPbRootObject(root)
}

function fromPbMetadata(metadata?: _Metadata): BuckMetadata | undefined {
  if (!metadata) return
  const roles = metadata.getRolesMap()
  const typedRoles = new Map()
  roles.forEach((entry, key) => typedRoles.set(key, entry))
  const response: BuckMetadata = {
    updatedAt: metadata.getUpdatedAt(),
    roles: typedRoles,
  }

  return response
}

export const CHUNK_SIZE = 1024

function fromPbPathItem(item: _PathItem): PathItem {
  const list = item.getItemsList()
  return {
    cid: item.getCid(),
    name: item.getName(),
    path: item.getPath(),
    size: item.getSize(),
    isDir: item.getIsDir(),
    items: list ? list.map(fromPbPathItem) : [],
    count: item.getItemsCount(),
    metadata: fromPbMetadata(item.getMetadata()),
  }
}

function fromPbPathItemNullable(item?: _PathItem): PathItem | undefined {
  if (!item) return
  return fromPbPathItem(item)
}

function fromProtoArchiveRenew(item: _ArchiveRenew.AsObject): ArchiveRenew {
  return { ...item }
}

function fromProtoArchiveConfig(item: _ArchiveConfig.AsObject): ArchiveConfig {
  return {
    ...item,
    countryCodes: item.countryCodesList,
    excludedMiners: item.excludedMinersList,
    trustedMiners: item.trustedMinersList,
    renew: item.renew ? fromProtoArchiveRenew(item.renew) : undefined,
  }
}

function toProtoArchiveConfig(config: ArchiveConfig): _ArchiveConfig {
  const protoConfig = new _ArchiveConfig()
  protoConfig.setCountryCodesList(config.countryCodes)
  protoConfig.setDealMinDuration(config.dealMinDuration)
  protoConfig.setDealStartOffset(config.dealStartOffset)
  protoConfig.setExcludedMinersList(config.excludedMiners)
  protoConfig.setFastRetrieval(config.fastRetrieval)
  protoConfig.setMaxPrice(config.maxPrice)
  protoConfig.setRepFactor(config.repFactor)
  protoConfig.setTrustedMinersList(config.trustedMiners)
  protoConfig.setVerifiedDeal(config.verifiedDeal)
  if (config.renew) {
    const renew = new _ArchiveRenew()
    renew.setEnabled(config.renew.enabled)
    renew.setThreshold(config.renew.threshold)
    protoConfig.setRenew(renew)
  }
  return protoConfig
}

function fromPbDealInfo(item: _DealInfo.AsObject): ArchiveDealInfo {
  return { ...item }
}

function fromPbArchiveStatus(
  item: _ArchiveStatusMap[keyof _ArchiveStatusMap],
): ArchiveStatus {
  switch (item) {
    case _ArchiveStatus.ARCHIVE_STATUS_CANCELED:
      return ArchiveStatus.Canceled
    case _ArchiveStatus.ARCHIVE_STATUS_EXECUTING:
      return ArchiveStatus.Executing
    case _ArchiveStatus.ARCHIVE_STATUS_FAILED:
      return ArchiveStatus.Failed
    case _ArchiveStatus.ARCHIVE_STATUS_QUEUED:
      return ArchiveStatus.Queued
    case _ArchiveStatus.ARCHIVE_STATUS_SUCCESS:
      return ArchiveStatus.Success
    case _ArchiveStatus.ARCHIVE_STATUS_UNSPECIFIED:
      return ArchiveStatus.Unspecified
    default:
      throw new Error('unknown status')
  }
}

function fromPbArchive(item: _Archive.AsObject): Archive {
  return {
    ...item,
    // TODO: standardize units coming from server.
    createdAt: new Date(item.createdAt * 1000),
    status: fromPbArchiveStatus(item.archiveStatus),
    dealInfo: item.dealInfoList.map(fromPbDealInfo),
  }
}

/**
 * Ensures that a Root | string | undefined is converted into a string
 */
async function ensureRootString(
  api: GrpcConnection,
  key: string,
  root?: Root | string,
  ctx?: ContextInterface,
): Promise<string> {
  if (root) {
    return typeof root === 'string' ? root : root.path
  } else {
    /* eslint-disable  @typescript-eslint/no-use-before-define */
    const root = await bucketsRoot(api, key, ctx)
    return root?.path ?? ''
  }
}

export function* genChunks(
  value: Uint8Array,
  size: number,
): Generator<Uint8Array, any, undefined> {
  return yield* Array.from(Array(Math.ceil(value.byteLength / size)), (_, i) =>
    value.slice(i * size, i * size + size),
  )
}

/**
 * Creates a new bucket.
 * @public
 * @param name Human-readable bucket name. It is only meant to help identify a bucket in a UI and is not unique.
 * @param isPrivate encrypt the bucket contents (default `false`)
 * @param cid (optional) Bootstrap the bucket with a UnixFS Cid from the IPFS network
 * @example
 * Creates a Bucket called "app-name-files"
 * ```typescript
 * import { Buckets } from '@textile/hub'
 *
 * const create = async (buckets: Buckets) => {
 *     return buckets.create("app-name-files")
 * }
 * ```
 *
 * @internal
 */
export async function bucketsCreate(
  api: GrpcConnection,
  name: string,
  isPrivate = false,
  cid?: string,
  ctx?: ContextInterface,
): Promise<CreateResponse> {
  logger.debug('create request')
  const req = new CreateRequest()
  req.setName(name)
  if (cid) {
    req.setBootstrapCid(cid)
  }
  req.setPrivate(isPrivate)
  const res: _CreateResponse = await api.unary(APIService.Create, req, ctx)
  const links = res.getLinks()
  return {
    seed: res.getSeed_asU8(),
    seedCid: res.getSeedCid(),
    root: fromPbRootObjectNullable(res.getRoot()),
    links: links ? links.toObject() : undefined,
  }
}

/**
 * Returns the bucket root CID
 * @param key Unique (IPNS compatible) identifier key for a bucket.
 *
 * @internal
 */
export async function bucketsRoot(
  api: GrpcConnection,
  key: string,
  ctx?: ContextInterface,
): Promise<Root | undefined> {
  logger.debug('root request')
  const req = new RootRequest()
  req.setKey(key)
  const res: RootResponse = await api.unary(APIService.Root, req, ctx)
  return fromPbRootObjectNullable(res.getRoot())
}

/**
 * Returns a list of bucket links.
 * @param key Unique (IPNS compatible) identifier key for a bucket.
 * @example
 * Generate the HTTP, IPNS, and IPFS links for a Bucket
 * ```typescript
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
 *
 * @internal
 */
export async function bucketsLinks(
  api: GrpcConnection,
  key: string,
  path: string,
  ctx?: ContextInterface,
): Promise<Links> {
  logger.debug('link request')
  const req = new LinksRequest()
  req.setKey(key)
  req.setPath(path)
  const res: LinksResponse = await api.unary(APIService.Links, req, ctx)
  return res.toObject()
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
 * ```
 *
 * @internal
 */
export async function bucketsList(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<Array<Root>> {
  logger.debug('list request')
  const req = new ListRequest()
  const res: ListResponse = await api.unary(APIService.List, req, ctx)
  const roots = res.getRootsList()
  const map = roots ? roots.map((m) => m).map((m) => fromPbRootObject(m)) : []
  return map
}

/**
 * Returns information about a bucket path.
 * @param key Unique (IPNS compatible) identifier key for a bucket.
 * @param path A file/object (sub)-path within a bucket.
 *
 * @internal
 */
export async function bucketsListPath(
  api: GrpcConnection,
  key: string,
  path: string,
  ctx?: ContextInterface,
): Promise<Path> {
  logger.debug('list path request')
  const req = new ListPathRequest()
  req.setKey(key)
  req.setPath(path)
  const res: ListPathResponse = await api.unary(APIService.ListPath, req, ctx)
  return {
    item: fromPbPathItemNullable(res.getItem()),
    root: fromPbRootObjectNullable(res.getRoot()),
  }
}

/**
 * listIpfsPath returns items at a particular path in a UnixFS path living in the IPFS network.
 * @param path UnixFS path
 *
 * @internal
 */
export async function bucketsListIpfsPath(
  api: GrpcConnection,
  path: string,
  ctx?: ContextInterface,
): Promise<PathItem | undefined> {
  logger.debug('list path request')
  const req = new ListIpfsPathRequest()
  req.setPath(path)
  const res: ListIpfsPathResponse = await api.unary(
    APIService.ListIpfsPath,
    req,
    ctx,
  )
  return fromPbPathItemNullable(res.getItem())
}

/**
 * Move a file or subpath to a new path.
 * @internal
 */
export async function bucketsMovePath(
  api: GrpcConnection,
  key: string,
  fromPath: string,
  toPath: string,
  ctx?: ContextInterface,
): Promise<void> {
  const request = new MovePathRequest()
  request.setKey(key)
  request.setFromPath(fromPath)
  request.setToPath(toPath)
  await api.unary(APIService.MovePath, request, ctx)
}

/**
 * Pushes a file to a bucket path.
 * @param key Unique (IPNS compatible) identifier key for a bucket.
 * @param path A file/object (sub)-path within a bucket.
 * @param input The input file/stream/object.
 * @param opts Options to control response stream.
 * @remarks
 * This will return the resolved path and the bucket's new root path.
 * @example
 * Push a file to the root of a bucket
 * ```typescript
 * import { Buckets } from '@textile/hub'
 *
 * const pushFile = async (content: string, bucketKey: string) => {
 *    const file = { path: '/index.html', content: Buffer.from(content) }
 *    return await buckets.pushPath(bucketKey!, 'index.html', file)
 * }
 * ```
 * @internal
 */
export async function bucketsPushPath(
  api: GrpcConnection,
  key: string,
  path: string,
  input: any,
  opts?: PushOptions,
  ctx?: ContextInterface,
): Promise<PushPathResult> {
  return new Promise<PushPathResult>(async (resolve, reject) => {
    // Only process the first input if there are more than one
    const source: File | undefined = (await normaliseInput(input).next()).value

    if (!source) {
      return reject(AbortError)
    }

    const clientjs = new APIServiceClient(api.serviceHost, api.rpcOptions)

    const metadata = { ...api.context.toJSON(), ...ctx?.toJSON() }

    const stream: BidirectionalStream<
      PushPathRequest,
      PushPathResponse
    > = clientjs.pushPath(metadata)

    if (opts?.signal !== undefined) {
      opts.signal.addEventListener('abort', () => {
        stream.cancel()
        return reject(AbortError)
      })
    }

    stream.on('data', (message: PushPathResponse) => {
      // Let's just make sure we haven't aborted this outside this function
      if (opts?.signal?.aborted) {
        stream.cancel()
        return reject(AbortError)
      }
      if (message.hasEvent()) {
        const event = message.getEvent()?.toObject()
        if (event?.path) {
          // TODO: Is there an standard library/tool for this step in JS?
          const pth = event.path.startsWith('/ipfs/')
            ? event.path.split('/ipfs/')[1]
            : event.path
          const cid = new CID(pth)
          const res: PushPathResult = {
            path: {
              path: `/ipfs/${cid?.toString()}`,
              cid,
              root: cid,
              remainder: '',
            },
            root: event.root?.path ?? '',
          }
          return resolve(res)
        } else if (opts?.progress) {
          opts.progress(event?.bytes)
        }
      } else {
        return reject(new Error('Invalid reply'))
      }
    })

    stream.on('end', (status?: Status) => {
      if (status && status.code !== grpc.Code.OK) {
        return reject(new Error(status.details))
      } else {
        return reject(new Error('undefined result'))
      }
    })
    stream.on('status', (status?: Status) => {
      if (status && status.code !== grpc.Code.OK) {
        return reject(new Error(status.details))
      } else {
        return reject(new Error('undefined result'))
      }
    })

    const head = new PushPathRequest.Header()
    head.setPath(source.path || path)
    head.setKey(key)
    // Setting root here ensures pushes will error if root is out of date
    const root = await ensureRootString(api, key, opts?.root, ctx)
    head.setRoot(root)
    const req = new PushPathRequest()
    req.setHeader(head)

    stream.write(req)
    if (source.content) {
      for await (const chunk of source.content) {
        if (opts?.signal?.aborted) {
          // Let's just make sure we haven't aborted this outside this function
          try {
            // Should already have been handled
            stream.cancel()
          } catch {} // noop
          return reject(AbortError)
        }
        // Naively chunk into chunks smaller than CHUNK_SIZE bytes
        for (const chunklet of genChunks(chunk as Uint8Array, CHUNK_SIZE)) {
          const part = new PushPathRequest()
          part.setChunk(chunklet)
          stream.write(part)
        }
      }
    }
    stream.end()
  })
}

/**
 * Pushes an iterable of files to a bucket.
 * @param key Unique (IPNS compatible) identifier key for a bucket.
 * @param input The input array of file/stream/objects.
 * @param opts Options to control response stream.
 * @internal
 */
export function bucketsPushPaths(
  api: GrpcConnection,
  key: string,
  input: any,
  opts?: Omit<PushOptions, 'progress'>,
  ctx?: ContextInterface,
): AsyncIterableIterator<PushPathsResult> {
  return new Repeater<PushPathsResult>(async (push, stop) => {
    const clientjs = new APIServiceClient(api.serviceHost, api.rpcOptions)

    const metadata = { ...api.context.toJSON(), ...ctx?.toJSON() }

    const stream: BidirectionalStream<
      PushPathsRequest,
      PushPathsResponse
    > = clientjs.pushPaths(metadata)

    if (opts?.signal !== undefined) {
      opts.signal.addEventListener('abort', () => {
        stream.cancel()
        throw AbortError
      })
    }

    stream.on('data', (message: PushPathsResponse) => {
      // Let's just make sure we haven't aborted this outside this function
      if (opts?.signal?.aborted) {
        stream.cancel()
        return stop(AbortError)
      }
      const obj: PushPathsResult = {
        path: message.getPath(),
        root: fromPbRootObjectNullable(message.getRoot()),
        cid: new CID(message.getCid()),
        pinned: message.getPinned(),
        size: message.getSize(),
      }
      push(obj)
    })

    stream.on('end', (status?: Status) => {
      if (status && status.code !== grpc.Code.OK) {
        return stop(new Error(status.details))
      }
      return stop()
    })
    stream.on('status', (status?: Status) => {
      if (status && status.code !== grpc.Code.OK) {
        return stop(new Error(status.details))
      }
      return stop()
    })

    const head = new PushPathsRequest.Header()
    head.setKey(key)
    // Setting root here ensures pushes will error if root is out of date
    const root = await ensureRootString(api, key, opts?.root, ctx)
    head.setRoot(root)
    const req = new PushPathsRequest()
    req.setHeader(head)
    stream.write(req)

    // Map the following over the top level inputs for parallel pushes
    const mapper = async ({ path, content }: File): Promise<void> => {
      const req = new PushPathsRequest()
      const chunk = new PushPathsRequest.Chunk()
      chunk.setPath(path)
      if (content) {
        for await (const data of content) {
          if (opts?.signal?.aborted) {
            // Let's just make sure we haven't aborted this outside this function
            try {
              // Should already have been handled
              stream.cancel()
            } catch {} // noop
            return stop(AbortError)
          }
          // Naively chunk into chunks smaller than CHUNK_SIZE bytes
          for (const chunklet of genChunks(data as Uint8Array, CHUNK_SIZE)) {
            chunk.setData(chunklet)
            req.setChunk(chunk)
            stream.write(req)
          }
        }
      }
      // Close out the file
      const final = new PushPathsRequest.Chunk()
      final.setPath(path)
      req.setChunk(final)
      stream.write(req)
    }

    // We don't care about the top level order, progress is labeled by path
    await drain(paramap(normaliseInput(input), mapper, { ordered: false }))
    stream.end()
  })
}

/**
 * Sets a file at a given bucket path.
 * @internal
 */
export async function bucketsSetPath(
  api: GrpcConnection,
  key: string,
  path: string,
  cid: string,
  ctx?: ContextInterface,
): Promise<void> {
  const request = new SetPathRequest()
  request.setKey(key)
  request.setPath(path)
  request.setCid(cid)
  await api.unary(APIService.SetPath, request, ctx)
}

/**
 * Pulls the bucket path, returning the bytes of the given file.
 * @param key Unique (IPNS compatible) identifier key for a bucket.
 * @param path A file/object (sub)-path within a bucket.
 * @param opts Options to control response stream. Currently only supports a progress function.
 *
 * @internal
 */
export function bucketsPullPath(
  api: GrpcConnection,
  key: string,
  path: string,
  opts?: { progress?: (num?: number) => void },
  ctx?: ContextInterface,
): AsyncIterableIterator<Uint8Array> {
  return new Repeater<Uint8Array>((push, stop) => {
    const metadata = { ...api.context.toJSON(), ...ctx?.toJSON() }
    const request = new PullPathRequest()
    request.setKey(key)
    request.setPath(path)
    let written = 0
    const resp = grpc.invoke(APIService.PullPath, {
      host: api.serviceHost,
      transport: api.rpcOptions.transport,
      debug: api.rpcOptions.debug,
      request,
      metadata,
      onMessage: async (res: PullPathResponse) => {
        const chunk = res.getChunk_asU8()
        written += chunk.byteLength
        if (opts?.progress) {
          opts.progress(written)
        }
        push(chunk)
      },
      onEnd: async (
        status: grpc.Code,
        message: string,
        // _trailers: grpc.Metadata,
      ) => {
        if (status !== grpc.Code.OK) {
          stop(new Error(message))
        }
        stop()
      },
    })
    // Cleanup afterwards
    stop.then(() => resp.close())
  })
}

/**
 * pullIpfsPath pulls the path from a remote UnixFS dag, writing it to writer if it's a file.
 * @param path A file/object (sub)-path within a bucket.
 * @param opts Options to control response stream. Currently only supports a progress function.
 *
 * @internal
 */
export function bucketsPullIpfsPath(
  api: GrpcConnection,
  path: string,
  opts?: { progress?: (num?: number) => void },
  ctx?: ContextInterface,
): AsyncIterableIterator<Uint8Array> {
  return new Repeater<Uint8Array>((push, stop) => {
    const metadata = { ...api.context.toJSON(), ...ctx?.toJSON() }
    const request = new PullIpfsPathRequest()
    request.setPath(path)
    let written = 0
    const resp = grpc.invoke(APIService.PullIpfsPath, {
      host: api.serviceHost,
      transport: api.rpcOptions.transport,
      debug: api.rpcOptions.debug,
      request,
      metadata,
      onMessage: async (res: PullIpfsPathResponse) => {
        const chunk = res.getChunk_asU8()
        push(chunk)
        written += chunk.byteLength
        if (opts?.progress) {
          opts.progress(written)
        }
      },
      onEnd: async (
        status: grpc.Code,
        message: string,
        // _trailers: grpc.Metadata,
      ) => {
        if (status !== grpc.Code.OK) {
          stop(new Error(message))
        }
        stop()
      },
    })
    stop.then(() => resp.close())
  })
}

/**
 * Removes an entire bucket. Files and directories will be unpinned.
 * @param key Unique (IPNS compatible) identifier key for a bucket.
 *
 * @internal
 */
export async function bucketsRemove(
  api: GrpcConnection,
  key: string,
  ctx?: ContextInterface,
): Promise<void> {
  logger.debug('remove request')
  const req = new RemoveRequest()
  req.setKey(key)
  await api.unary(APIService.Remove, req, ctx)
  return
}

/**
 * Returns information about a bucket path.
 * @param key Unique (IPNS compatible) identifier key for a bucket.
 * @param path A file/object (sub)-path within a bucket.
 * @param root optional to specify a root
 *
 * @internal
 */
export async function bucketsRemovePath(
  api: GrpcConnection,
  key: string,
  path: string,
  opts?: RemovePathOptions,
  ctx?: ContextInterface,
): Promise<RemovePathResponse> {
  logger.debug('remove path request')
  const req = new RemovePathRequest()
  req.setKey(key)
  req.setPath(path)
  const root = await ensureRootString(api, key, opts?.root, ctx)
  req.setRoot(root)
  const res: _RemovePathResponse = await api.unary(
    APIService.RemovePath,
    req,
    ctx,
  )
  return {
    pinned: res.getPinned(),
    root: fromPbRootObjectNullable(res.getRoot()),
  }
}

export async function bucketsPushPathAccessRoles(
  api: GrpcConnection,
  key: string,
  path: string,
  roles: Map<string, PathAccessRole>,
  ctx?: ContextInterface,
): Promise<void> {
  logger.debug('remove path request')
  const req = new PushPathAccessRolesRequest()
  req.setKey(key)
  req.setPath(path)
  roles.forEach((value, key) => req.getRolesMap().set(key, value))
  await api.unary(APIService.PushPathAccessRoles, req, ctx)
  return
}

export async function bucketsPullPathAccessRoles(
  api: GrpcConnection,
  key: string,
  path = '/',
  ctx?: ContextInterface,
): Promise<Map<string, 0 | 1 | 2 | 3>> {
  logger.debug('remove path request')
  const req = new PullPathAccessRolesRequest()
  req.setKey(key)
  req.setPath(path)
  const response: PullPathAccessRolesResponse = await api.unary(
    APIService.PullPathAccessRoles,
    req,
    ctx,
  )
  const roles = response.getRolesMap()
  const typedRoles = new Map()
  roles.forEach((entry, key) => typedRoles.set(key, entry))
  return typedRoles
}

/**
 * @internal
 */
export async function bucketsDefaultArchiveConfig(
  api: GrpcConnection,
  key: string,
  ctx?: ContextInterface,
): Promise<ArchiveConfig> {
  logger.debug('default archive config request')
  const req = new DefaultArchiveConfigRequest()
  req.setKey(key)
  const res: DefaultArchiveConfigResponse = await api.unary(
    APIService.DefaultArchiveConfig,
    req,
    ctx,
  )
  const config = res.getArchiveConfig()
  if (!config) {
    throw new Error('no archive config returned')
  }
  return fromProtoArchiveConfig(config.toObject())
}

/**
 * @internal
 */
export async function bucketsSetDefaultArchiveConfig(
  api: GrpcConnection,
  key: string,
  config: ArchiveConfig,
  ctx?: ContextInterface,
): Promise<void> {
  logger.debug('set default archive config request')
  const req = new SetDefaultArchiveConfigRequest()
  req.setKey(key)
  req.setArchiveConfig(toProtoArchiveConfig(config))
  await api.unary(APIService.SetDefaultArchiveConfig, req, ctx)
  return
}

/**
 * archive creates a Filecoin bucket archive.
 * @internal
 * @param key Unique (IPNS compatible) identifier key for a bucket.
 * @param options Options that control the behavior of the bucket archive
 * @param skipAutomaticVerifiedDeal skips logic that automatically uses available datacap to make a verified deal for the archive.
 */
export async function bucketsArchive(
  api: GrpcConnection,
  key: string,
  options?: ArchiveOptions,
  skipAutomaticVerifiedDeal?: boolean,
  ctx?: ContextInterface,
): Promise<void> {
  logger.debug('archive request')
  const req = new ArchiveRequest()
  req.setKey(key)
  if (skipAutomaticVerifiedDeal !== undefined) {
    req.setSkipAutomaticVerifiedDeal(skipAutomaticVerifiedDeal)
  }
  if (options?.archiveConfig) {
    req.setArchiveConfig(toProtoArchiveConfig(options.archiveConfig))
  }
  await api.unary(APIService.Archive, req, ctx)
  return
}

/**
 * @internal
 */
export async function bucketsArchives(
  api: GrpcConnection,
  key: string,
  ctx?: ContextInterface,
): Promise<Archives> {
  logger.debug('archives request')
  const req = new ArchivesRequest()
  req.setKey(key)
  const res: ArchivesResponse = await api.unary(APIService.Archives, req, ctx)
  const current = res.toObject().current
  return {
    current: current ? fromPbArchive(current) : undefined,
    history: res.toObject().historyList.map(fromPbArchive),
  }
}

/**
 * archiveWatch watches status events from a Filecoin bucket archive.
 * @internal
 * @param key Unique (IPNS compatible) identifier key for a bucket.
 */
export async function bucketsArchiveWatch(
  api: GrpcConnection,
  key: string,
  callback: (
    reply?: { id: string | undefined; msg: string },
    err?: Error,
  ) => void,
  ctx?: ContextInterface,
): Promise<() => void> {
  logger.debug('archive watch request')
  const req = new ArchiveWatchRequest()
  req.setKey(key)

  const metadata = { ...api.context.toJSON(), ...ctx?.toJSON() }
  const res = grpc.invoke(APIService.ArchiveWatch, {
    host: api.context.host,
    request: req,
    metadata,
    onMessage: (rec: ArchiveWatchResponse) => {
      const response = {
        id: rec.getJsPbMessageId(),
        msg: rec.getMsg(),
      }
      callback(response)
    },
    onEnd: (
      status: grpc.Code,
      message: string /** _trailers: grpc.Metadata */,
    ) => {
      if (status !== grpc.Code.OK) {
        return callback(undefined, new Error(message))
      }
      callback()
    },
  })
  return res.close.bind(res)
}

/**
 * Raw API connected needed by Buckets CI code (compile friendly)
 * see more https://github.com/textileio/github-action-buckets
 */
export class BucketsGrpcClient {
  public serviceHost: string
  public rpcOptions: grpc.RpcOptions
  /**
   * Creates a new gRPC client instance for accessing the Textile Buckets API.
   * @param context The context to use for interacting with the APIs. Can be modified later.
   */
  constructor(public context: ContextInterface = new Context(), debug = false) {
    this.serviceHost = context.host
    this.rpcOptions = {
      transport: WebsocketTransport(),
      debug,
    }
  }

  public unary<
    R extends grpc.ProtobufMessage,
    T extends grpc.ProtobufMessage,
    M extends grpc.UnaryMethodDefinition<R, T>
  >(methodDescriptor: M, req: R, ctx?: ContextInterface): Promise<T | void> {
    return new Promise<T | void>((resolve, reject) => {
      const metadata = { ...this.context.toJSON(), ...ctx?.toJSON() }
      grpc.unary(methodDescriptor, {
        request: req,
        host: this.serviceHost,
        transport: this.rpcOptions.transport,
        debug: this.rpcOptions.debug,
        metadata,
        onEnd: (res: grpc.UnaryOutput<T>) => {
          const { status, statusMessage, message } = res
          if (status === grpc.Code.OK) {
            if (message) {
              resolve(message)
            } else {
              resolve()
            }
          } else {
            reject(new Error(statusMessage))
          }
        },
      })
    })
  }
}
