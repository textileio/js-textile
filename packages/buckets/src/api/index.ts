import { grpc } from '@improbable-eng/grpc-web'
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
  RemovePathRequest,
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
  APIServicePushPath,
  BidirectionalStream,
  Status,
} from '@textile/buckets-grpc/api/bucketsd/pb/bucketsd_pb_service'
import { Context, ContextInterface } from '@textile/context'
import { GrpcConnection } from '@textile/grpc-connection'
import { WebsocketTransport } from '@textile/grpc-transport'
import type { AbortSignal } from 'abort-controller'
import CID from 'cids'
import { EventIterator } from 'event-iterator'
import log from 'loglevel'
import { File, normaliseInput } from './normalize'

const logger = log.getLogger('buckets-api')

/**
 * PushOptions provides additional options for controlling a push to a bucket path.
 */
export interface PushOptions {
  /**
   * A callback function to use for monitoring push progress.
   */
  progress?: (num?: number) => void
  /**
   * The bucket root path as a string, or root object. Important to set this property when
   * there is a possibility of multiple parallel pushes to a bucket. Specifying this property
   * will enforce fast-forward only updates. It not provided explicitly, the root path will
   * be fetched via an additional API call before each push.
   */
  root?: Root | string

  /**
   * An optional abort signal to allow cancelation or aborting a bucket push.
   */
  signal?: AbortSignal
}

export const AbortError = new Error('aborted')

/**
 * The expected result format from pushing a path to a bucket
 */
export interface PushPathResult {
  path: {
    path: string
    cid: CID
    root: CID
    remainder: string
  }
  root: string
}

/**
 * Response from bucket links query.
 */
export type Links = {
  www: string
  ipns: string
  url: string
}

/**
 * @deprecated
 */
export type LinksObject = Links

/**
 * Bucket root info
 */
export type Root = {
  key: string
  name: string
  path: string
  createdAt: number
  updatedAt: number
  thread: string
}
/**
 * @deprecated
 */
export type RootObject = Root

export enum PathAccessRole {
  PATH_ACCESS_ROLE_UNSPECIFIED = 0,
  PATH_ACCESS_ROLE_READER = 1,
  PATH_ACCESS_ROLE_WRITER = 2,
  PATH_ACCESS_ROLE_ADMIN = 3,
}

export type BuckMetadata = {
  roles: Map<string, PathAccessRole>
  updatedAt: number
}
/**
 * @deprecated
 */
export type MetadataObject = BuckMetadata

/**
 * A bucket path item response
 */
export type PathItem = {
  cid: string
  name: string
  path: string
  size: number
  isDir: boolean
  items: Array<PathItem>
  count: number
  metadata?: BuckMetadata
}
/**
 * @deprecated
 */
export type PathItemObject = PathItem

/**
 * A bucket list path response
 */
export type Path = {
  item?: PathItem
  root?: Root
}
/**
 * @deprecated
 */
export type PathObject = Path

export const CHUNK_SIZE = 32768

export function* genChunks(value: Uint8Array, size: number) {
  return yield* Array.from(Array(Math.ceil(value.byteLength / size)), (_, i) => value.slice(i * size, i * size + size))
}

/**
 * ArchiveConfig is the desired state of a Cid in the Filecoin network.
 */
export interface ArchiveConfig {
  /**
   * RepFactor (ignored in Filecoin testnet) indicates the desired amount of active deals
   * with different miners to store the data. While making deals
   * the other attributes of FilConfig are considered for miner selection.
   */
  repFactor: number
  /**
   * DealMinDuration indicates the duration to be used when making new deals.
   */
  dealMinDuration: number
  /**
   * ExcludedMiners (ignored in Filecoin testnet) is a set of miner addresses won't be ever be selected
   *when making new deals, even if they comply to other filters.
   */
  excludedMiners: Array<string>
  /**
   * TrustedMiners (ignored in Filecoin testnet) is a set of miner addresses which will be forcibly used
   * when making new deals. An empty/nil list disables this feature.
   */
  trustedMiners: Array<string>
  /**
   * CountryCodes (ignored in Filecoin testnet) indicates that new deals should select miners on specific countries.
   */
  countryCodes: Array<string>
  /**
   * Renew indicates deal-renewal configuration.
   */
  renew?: ArchiveRenew
  /**
   * Addr is the wallet address used to store the data in filecoin
   */
  addr: string
  /**
   * MaxPrice is the maximum price that will be spent to store the data, 0 is no max
   */
  maxPrice: number
  /**
   *
   * FastRetrieval indicates that created deals should enable the
   * fast retrieval feature.
   */
  fastRetrieval: boolean
  /**
   * DealStartOffset indicates how many epochs in the future impose a
   * deadline to new deals being active on-chain. This value might influence
   * if miners accept deals, since they should seal fast enough to satisfy
   * this constraint.
   */
  dealStartOffset: number
}

/**
 * ArchiveRenew contains renew configuration for a ArchiveConfig.
 */
export interface ArchiveRenew {
  /**
   * Enabled indicates that deal-renewal is enabled for this Cid.
   */
  enabled: boolean
  /**
   * Threshold indicates how many epochs before expiring should trigger
   * deal renewal. e.g: 100 epoch before expiring.
   */
  threshold: number
}

const fromProtoArchiveConfig = (protoConfig: _ArchiveConfig): ArchiveConfig => {
  const config: ArchiveConfig = {
    addr: protoConfig.getAddr(),
    countryCodes: protoConfig.getCountryCodesList(),
    dealMinDuration: protoConfig.getDealMinDuration(),
    dealStartOffset: protoConfig.getDealStartOffset(),
    excludedMiners: protoConfig.getExcludedMinersList(),
    fastRetrieval: protoConfig.getFastRetrieval(),
    maxPrice: protoConfig.getMaxPrice(),
    repFactor: protoConfig.getRepFactor(),
    trustedMiners: protoConfig.getTrustedMinersList(),
  }
  const renew = protoConfig.getRenew()
  if (renew) {
    config.renew = {
      enabled: renew.getEnabled(),
      threshold: renew.getThreshold(),
    }
  }
  return config
}

const toProtoArchiveConfig = (config: ArchiveConfig): _ArchiveConfig => {
  const protoConfig = new _ArchiveConfig()
  protoConfig.setAddr(config.addr)
  protoConfig.setCountryCodesList(config.countryCodes)
  protoConfig.setDealMinDuration(config.dealMinDuration)
  protoConfig.setDealStartOffset(config.dealStartOffset)
  protoConfig.setExcludedMinersList(config.excludedMiners)
  protoConfig.setFastRetrieval(config.fastRetrieval)
  protoConfig.setMaxPrice(config.maxPrice)
  protoConfig.setRepFactor(config.repFactor)
  protoConfig.setTrustedMinersList(config.trustedMiners)
  if (config.renew) {
    const renew = new _ArchiveRenew()
    renew.setEnabled(config.renew.enabled)
    renew.setThreshold(config.renew.threshold)
    protoConfig.setRenew(renew)
  }
  return protoConfig
}

/**
 * Information about a Filecoin deal for a Bucket Archive.
 */
export interface ArchiveDealInfo {
  proposalCid: string
  stateId: number
  stateName: string
  miner: string
  pieceCid: string
  size: number
  pricePerEpoch: number
  startEpoch: number
  duration: number
  dealId: number
  activationEpoch: number
  message: string
}

/**
 * Archive status codes
 */
export enum ArchiveStatus {
  UNSPECIFIED,
  QUEUED,
  EXECUTING,
  FAILED,
  CANCELED,
  SUCCESS,
}

/**
 * Information about a bucket archive.
 */
export interface Archive {
  cid: string
  jobId: string
  status: ArchiveStatus
  aborted: boolean
  abortedMsg: string
  failureMsg: string
  createdAt: number
  dealInfo: Array<ArchiveDealInfo>
}

/**
 * Response of archives request showing current and past archives.
 */
export interface Archives {
  current?: Archive
  history: Array<Archive>
}

function fromPbDealInfo(pbDealInfo: _DealInfo): ArchiveDealInfo {
  return {
    activationEpoch: pbDealInfo.getActivationEpoch(),
    dealId: pbDealInfo.getDealId(),
    duration: pbDealInfo.getDuration(),
    message: pbDealInfo.getMessage(),
    miner: pbDealInfo.getMiner(),
    pieceCid: pbDealInfo.getPieceCid(),
    pricePerEpoch: pbDealInfo.getPricePerEpoch(),
    proposalCid: pbDealInfo.getProposalCid(),
    size: pbDealInfo.getSize(),
    startEpoch: pbDealInfo.getStartEpoch(),
    stateId: pbDealInfo.getStateId(),
    stateName: pbDealInfo.getStateName(),
  }
}

function fromPbArchiveStatus(pbArchiveStatus: _ArchiveStatusMap[keyof _ArchiveStatusMap]): ArchiveStatus {
  switch (pbArchiveStatus) {
    case _ArchiveStatus.ARCHIVE_STATUS_CANCELED:
      return ArchiveStatus.CANCELED
    case _ArchiveStatus.ARCHIVE_STATUS_EXECUTING:
      return ArchiveStatus.EXECUTING
    case _ArchiveStatus.ARCHIVE_STATUS_FAILED:
      return ArchiveStatus.FAILED
    case _ArchiveStatus.ARCHIVE_STATUS_QUEUED:
      return ArchiveStatus.QUEUED
    case _ArchiveStatus.ARCHIVE_STATUS_SUCCESS:
      return ArchiveStatus.SUCCESS
    case _ArchiveStatus.ARCHIVE_STATUS_UNSPECIFIED:
      return ArchiveStatus.UNSPECIFIED
  }
}

function fromPbArchive(pbArchive: _Archive): Archive {
  return {
    aborted: pbArchive.getAborted(),
    abortedMsg: pbArchive.getAbortedMsg(),
    cid: pbArchive.getCid(),
    createdAt: pbArchive.getCreatedAt(),
    failureMsg: pbArchive.getFailureMsg(),
    jobId: pbArchive.getJobId(),
    status: fromPbArchiveStatus(pbArchive.getArchiveStatus()),
    dealInfo: pbArchive.getDealInfoList().map((item) => fromPbDealInfo(item)),
  }
}

/**
 * Bucket create response
 */
export type CreateResponse = { seed: Uint8Array; seedCid: string; root?: Root; links?: Links }
/**
 * @deprecated
 */
export type CreateObject = CreateResponse

const convertRootObject = (root: _Root): Root => {
  return {
    key: root.getKey(),
    name: root.getName(),
    path: root.getPath(),
    createdAt: root.getCreatedAt(),
    updatedAt: root.getUpdatedAt(),
    thread: root.getThread(),
  }
}

const convertRootObjectNullable = (root?: _Root): Root | undefined => {
  if (!root) return
  return convertRootObject(root)
}

const convertMetadata = (metadata?: _Metadata): BuckMetadata | undefined => {
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

const convertPathItem = (item: _PathItem): PathItem => {
  const list = item.getItemsList()
  return {
    cid: item.getCid(),
    name: item.getName(),
    path: item.getPath(),
    size: item.getSize(),
    isDir: item.getIsDir(),
    items: list ? list.map(convertPathItem) : [],
    count: item.getItemsCount(),
    metadata: convertMetadata(item.getMetadata()),
  }
}

const convertPathItemNullable = (item?: _PathItem): PathItem | undefined => {
  if (!item) return
  return convertPathItem(item)
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
    root: convertRootObjectNullable(res.getRoot()),
    links: links ? links.toObject() : undefined,
  }
}

/**
 * Returns the bucket root CID
 * @param key Unique (IPNS compatible) identifier key for a bucket.
 *
 * @internal
 */
export async function bucketsRoot(api: GrpcConnection, key: string, ctx?: ContextInterface): Promise<Root | undefined> {
  logger.debug('root request')
  const req = new RootRequest()
  req.setKey(key)
  const res: RootResponse = await api.unary(APIService.Root, req, ctx)
  return convertRootObjectNullable(res.getRoot())
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
export async function bucketsList(api: GrpcConnection, ctx?: ContextInterface): Promise<Array<Root>> {
  logger.debug('list request')
  const req = new ListRequest()
  const res: ListResponse = await api.unary(APIService.List, req, ctx)
  const roots = res.getRootsList()
  const map = roots ? roots.map((m) => m).map((m) => convertRootObject(m)) : []
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
    item: convertPathItemNullable(res.getItem()),
    root: convertRootObjectNullable(res.getRoot()),
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
  const res: ListIpfsPathResponse = await api.unary(APIService.ListIpfsPath, req, ctx)
  return convertPathItemNullable(res.getItem())
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
 *
 * @internal
 */
export async function bucketsPushPath(
  api: GrpcConnection,
  key: string,
  path: string,
  input: any,
  opts?: PushOptions,
  ctx?: ContextInterface,
) {
  return new Promise<PushPathResult>(async (resolve, reject) => {
    // Only process the first input if there are more than one
    const source: File | undefined = (await normaliseInput(input).next()).value
    const client = grpc.client<PushPathRequest, PushPathResponse, APIServicePushPath>(APIService.PushPath, {
      host: api.serviceHost,
      transport: api.rpcOptions.transport,
      debug: api.rpcOptions.debug,
    })
    // Send a close event to the bucket api upon abort
    if (opts?.signal !== undefined) {
      opts.signal.addEventListener('abort', () => {
        client.close()
        return reject(AbortError)
      })
    }
    client.onMessage((message) => {
      // Let's just make sure we haven't aborted this outside this function
      if (opts?.signal?.aborted) {
        client.close()
        return reject(AbortError)
      }
      if (message.hasEvent()) {
        const event = message.getEvent()?.toObject()
        if (event?.path) {
          // @todo: Is there an standard library/tool for this step in JS?
          const pth = event.path.startsWith('/ipfs/') ? event.path.split('/ipfs/')[1] : event.path
          const cid = new CID(pth)
          const res: PushPathResult = {
            path: {
              path: `/ipfs/${cid.toString()}`,
              cid: cid,
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
    client.onEnd((code, msg) => {
      if (code !== grpc.Code.OK) {
        const message = msg ? msg : code.toString()
        return reject(new Error(message))
      } else {
        return resolve()
      }
    })
    if (source) {
      const head = new PushPathRequest.Header()
      head.setPath(source.path || path)
      head.setKey(key)
      // Setting root here ensures pushes will error if root is out of date
      let root = ''
      if (opts?.root) {
        // If we explicitly received a root argument, use that
        root = typeof opts.root === 'string' ? opts.root : opts.root.path
      } else {
        // Otherwise, make a call to list path to get the latest known root
        const head = await bucketsListPath(api, key, '', ctx)
        root = head.root?.path ?? '' // Shouldn't ever be undefined here
      }
      head.setRoot(root)
      const req = new PushPathRequest()
      req.setHeader(head)
      const metadata = { ...api.context.toJSON(), ...ctx?.toJSON() }
      // Let's just make sure we haven't aborted this outside this function
      if (opts?.signal?.aborted) {
        return reject(AbortError)
      }
      client.start(metadata)
      client.send(req)

      if (source.content) {
        for await (const chunk of source.content) {
          // Let's just make sure we haven't aborted this outside this function
          if (opts?.signal?.aborted) {
            try {
              client.close()
            } catch {} // noop
            return reject(AbortError)
          }
          // Naively chunk into chunks smaller than CHUNK_SIZE bytes
          for (const chunklet of genChunks(chunk as Uint8Array, CHUNK_SIZE)) {
            const part = new PushPathRequest()
            part.setChunk(chunklet)
            client.send(part)
          }
        }
      }
      // We only need to finish send here if we actually started
      client.finishSend()
    }
  })
}

export async function bucketsPushPathNode(
  api: GrpcConnection,
  key: string,
  path: string,
  input: any,
  opts?: PushOptions,
  ctx?: ContextInterface,
) {
  return new Promise<PushPathResult>(async (resolve, reject) => {
    // Only process the first input if there are more than one
    const source: File | undefined = (await normaliseInput(input).next()).value

    if (!source) {
      return reject(AbortError)
    }

    const clientjs = new APIServiceClient(api.serviceHost, api.rpcOptions)

    const metadata = { ...api.context.toJSON(), ...ctx?.toJSON() }

    const stream: BidirectionalStream<PushPathRequest, PushPathResponse> = clientjs.pushPath(metadata)

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
          const pth = event.path.startsWith('/ipfs/') ? event.path.split('/ipfs/')[1] : event.path
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
        return resolve()
      }
    })
    stream.on('status', (status?: Status) => {
      if (status && status.code !== grpc.Code.OK) {
        return reject(new Error(status.details))
      } else {
        return resolve()
      }
    })

    const head = new PushPathRequest.Header()
    head.setPath(source.path || path)
    head.setKey(key)
    // Setting root here ensures pushes will error if root is out of date
    let root = ''
    if (opts?.root) {
      // If we explicitly received a root argument, use that
      root = typeof opts.root === 'string' ? opts.root : opts.root.path
    } else {
      // Otherwise, make a call to list path to get the latest known root
      const head = await bucketsListPath(api, key, '', ctx)
      root = head.root?.path ?? '' // Shouldn't ever be undefined here
    }
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
 * Pushes a file to a bucket path.
 * @internal
 */
export async function bucketsSetPath(
  api: GrpcConnection,
  key: string,
  path: string,
  cid: string,
  ctx?: ContextInterface,
) {
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
  const metadata = { ...api.context.toJSON(), ...ctx?.toJSON() }
  const request = new PullPathRequest()
  request.setKey(key)
  request.setPath(path)
  let written = 0
  const events = new EventIterator<Uint8Array>(({ push, stop, fail }) => {
    const resp = grpc.invoke(APIService.PullPath, {
      host: api.serviceHost,
      transport: api.rpcOptions.transport,
      debug: api.rpcOptions.debug,
      request,
      metadata,
      onMessage: async (res: PullPathResponse) => {
        const chunk = res.getChunk_asU8()
        push(chunk)
        written += chunk.byteLength
        if (opts?.progress) {
          opts.progress(written)
        }
      },
      onEnd: async (status: grpc.Code, message: string, _trailers: grpc.Metadata) => {
        if (status !== grpc.Code.OK) {
          fail(new Error(message))
        }
        stop()
      },
    })
    return () => resp.close()
  })
  const it: AsyncIterableIterator<Uint8Array> = {
    [Symbol.asyncIterator]() {
      return this
    },
    ...events[Symbol.asyncIterator](),
  }
  return it
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
  const metadata = { ...api.context.toJSON(), ...ctx?.toJSON() }
  const request = new PullIpfsPathRequest()
  request.setPath(path)
  let written = 0
  const events = new EventIterator<Uint8Array>(({ push, stop, fail }) => {
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
      onEnd: async (status: grpc.Code, message: string, _trailers: grpc.Metadata) => {
        if (status !== grpc.Code.OK) {
          fail(new Error(message))
        }
        stop()
      },
    })
    return () => resp.close()
  })
  const it: AsyncIterableIterator<Uint8Array> = {
    [Symbol.asyncIterator]() {
      return this
    },
    ...events[Symbol.asyncIterator](),
  }
  return it
}

/**
 * Removes an entire bucket. Files and directories will be unpinned.
 * @param key Unique (IPNS compatible) identifier key for a bucket.
 *
 * @internal
 */
export async function bucketsRemove(api: GrpcConnection, key: string, ctx?: ContextInterface) {
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
  root?: string,
  ctx?: ContextInterface,
) {
  logger.debug('remove path request')
  const req = new RemovePathRequest()
  req.setKey(key)
  req.setPath(path)
  if (root) req.setRoot(root)
  await api.unary(APIService.RemovePath, req, ctx)
  return
}

export async function bucketsPushPathAccessRoles(
  api: GrpcConnection,
  key: string,
  path: string,
  roles: Map<string, PathAccessRole>,
  ctx?: ContextInterface,
) {
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
  const response: PullPathAccessRolesResponse = await api.unary(APIService.PullPathAccessRoles, req, ctx)
  const roles = response.getRolesMap()
  const typedRoles = new Map()
  roles.forEach((entry, key) => typedRoles.set(key, entry))
  return typedRoles
}

/**
 * @internal
 */
export async function bucketsDefaultArchiveConfig(api: GrpcConnection, key: string, ctx?: ContextInterface) {
  logger.debug('default archive config request')
  const req = new DefaultArchiveConfigRequest()
  req.setKey(key)
  const res: DefaultArchiveConfigResponse = await api.unary(APIService.DefaultArchiveConfig, req, ctx)
  const config = res.getArchiveConfig()
  if (!config) {
    throw new Error('no archive config returned')
  }
  return fromProtoArchiveConfig(config)
}

/**
 * @internal
 */
export async function bucketsSetDefaultArchiveConfig(
  api: GrpcConnection,
  key: string,
  config: ArchiveConfig,
  ctx?: ContextInterface,
) {
  logger.debug('set default archive config request')
  const req = new SetDefaultArchiveConfigRequest()
  req.setKey(key)
  req.setArchiveConfig(toProtoArchiveConfig(config))
  await api.unary(APIService.SetDefaultArchiveConfig, req, ctx)
  return
}
/**
 * An object to configure options for Archive.
 */
export interface ArchiveOptions {
  /**
   * Provide a custom ArchiveConfig to override use of the default.
   */
  archiveConfig?: ArchiveConfig
}

/**
 * archive creates a Filecoin bucket archive.
 * @internal
 * @param key Unique (IPNS compatible) identifier key for a bucket.
 * @param options Options that control the behavior of the bucket archive
 */
export async function bucketsArchive(
  api: GrpcConnection,
  key: string,
  options?: ArchiveOptions,
  ctx?: ContextInterface,
) {
  logger.debug('archive request')
  const req = new ArchiveRequest()
  req.setKey(key)
  if (options?.archiveConfig) {
    req.setArchiveConfig(toProtoArchiveConfig(options.archiveConfig))
  }
  await api.unary(APIService.Archive, req, ctx)
  return
}

/**
 * @internal
 */
export async function bucketsArchives(api: GrpcConnection, key: string, ctx?: ContextInterface): Promise<Archives> {
  logger.debug('archives request')
  const req = new ArchivesRequest()
  req.setKey(key)
  const res: ArchivesResponse = await api.unary(APIService.Archives, req, ctx)
  const current = res.getCurrent()
  return {
    current: current ? fromPbArchive(current) : undefined,
    history: res.getHistoryList().map((item) => fromPbArchive(item)),
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
  callback: (reply?: { id: string | undefined; msg: string }, err?: Error) => void,
  ctx?: ContextInterface,
) {
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
    onEnd: (status: grpc.Code, message: string, _trailers: grpc.Metadata) => {
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
  >(methodDescriptor: M, req: R, ctx?: ContextInterface): Promise<T> {
    return new Promise<T>((resolve, reject) => {
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
