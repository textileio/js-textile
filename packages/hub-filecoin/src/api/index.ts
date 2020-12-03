import { ContextInterface } from '@textile/context'
import { GrpcConnection } from '@textile/grpc-connection'
import {
  AddressesRequest,
  AddressesResponse,
  AddrInfo,
  BalanceRequest,
  BalanceResponse,
  CidInfo as _CidInfo,
  CidInfoRequest,
  CidInfoResponse,
  ColdConfig as _ColdConfig,
  ColdInfo as _ColdInfo,
  DealError as _DealError,
  DealInfo as _DealInfo,
  DealRecordsConfig as _DealRecordsConfig,
  FilConfig as _FilConfig,
  FilInfo as _FilInfo,
  FilRenew as _FilRenew,
  FilStorage as _FilStorage,
  HotConfig as _HotConfig,
  HotInfo as _HotInfo,
  IpfsConfig as _IpfsConfig,
  IpfsHotInfo as _IpfsHotInfo,
  JobStatus as _JobStatus,
  JobStatusMap,
  RetrievalDealInfo as _RetrievalDealInfo,
  RetrievalDealRecord as _RetrievalDealRecord,
  RetrievalDealRecordsRequest,
  RetrievalDealRecordsResponse,
  StorageConfig as _StorageConfig,
  StorageDealInfo as _StorageDealInfo,
  StorageDealRecord as _StorageDealRecord,
  StorageDealRecordsRequest,
  StorageDealRecordsResponse,
  StorageInfo as _StorageInfo,
  StorageJob as _StorageJob,
} from '@textile/grpc-powergate-client/dist/powergate/user/v1/user_pb'
import { UserService } from '@textile/grpc-powergate-client/dist/powergate/user/v1/user_pb_service'
import log from 'loglevel'
import {
  AddressInfo,
  CidInfo,
  ColdConfig,
  ColdInfo,
  DealError,
  DealInfo,
  DealRecordsConfig,
  FilConfig,
  FilInfo,
  FilRenew,
  FilStorage,
  HotConfig,
  HotInfo,
  IpfsConfig,
  IpfsHotInfo,
  JobStatus,
  RetrievalDealInfo,
  RetrievalDealRecord,
  StorageConfig,
  StorageDealInfo,
  StorageDealRecord,
  StorageInfo,
  StorageJob,
} from '../types'

const logger = log.getLogger('filecoin-api')

function fromPbAddressInfo(item: AddrInfo.AsObject): AddressInfo {
  return {
    ...item,
    balance: BigInt(item.balance),
  }
}

function fromPbIpfsConfig(item: _IpfsConfig.AsObject): IpfsConfig {
  return { ...item }
}

function fromPbHotConfig(item: _HotConfig.AsObject): HotConfig {
  return {
    ...item,
    ipfs: item.ipfs ? fromPbIpfsConfig(item.ipfs) : undefined,
  }
}

function fromPbFilRenew(item: _FilRenew.AsObject): FilRenew {
  return { ...item }
}

function fromPbFilConfig(item: _FilConfig.AsObject): FilConfig {
  return {
    ...item,
    countryCodes: item.countryCodesList,
    excludedMiners: item.excludedMinersList,
    trustedMiners: item.trustedMinersList,
    renew: item.renew ? fromPbFilRenew(item.renew) : undefined,
  }
}

function fromPbColdConfig(item: _ColdConfig.AsObject): ColdConfig {
  return {
    ...item,
    filecoin: item.filecoin ? fromPbFilConfig(item.filecoin) : undefined,
  }
}

function fromPbStorageConfig(item: _StorageConfig.AsObject): StorageConfig {
  return {
    ...item,
    cold: item.cold ? fromPbColdConfig(item.cold) : undefined,
    hot: item.hot ? fromPbHotConfig(item.hot) : undefined,
  }
}

function fromPbIpfsHotInfo(item: _IpfsHotInfo.AsObject): IpfsHotInfo {
  return {
    ...item,
    // TODO: standardize time units from server.
    created: new Date(item.created / 1000000),
  }
}

function fromPbHotInfo(item: _HotInfo.AsObject): HotInfo {
  return {
    ...item,
    ipfs: item.ipfs ? fromPbIpfsHotInfo(item.ipfs) : undefined,
  }
}

function fromPbFilStorage(item: _FilStorage.AsObject): FilStorage {
  return { ...item }
}

function fromPbFilInfo(item: _FilInfo.AsObject): FilInfo {
  return {
    ...item,
    proposals: item.proposalsList.map(fromPbFilStorage),
  }
}

function fromPbColdInfo(item: _ColdInfo.AsObject): ColdInfo {
  return {
    ...item,
    filecoin: item.filecoin ? fromPbFilInfo(item.filecoin) : undefined,
  }
}

function fromPbStorageInfo(item: _StorageInfo.AsObject): StorageInfo {
  return {
    ...item,
    // TODO: standardize time units from server.
    created: new Date(item.created / 1000000),
    cold: item.cold ? fromPbColdInfo(item.cold) : undefined,
    hot: item.hot ? fromPbHotInfo(item.hot) : undefined,
  }
}

function fromPbDealInfo(item: _DealInfo.AsObject): DealInfo {
  return { ...item }
}

function fromPbDealError(item: _DealError.AsObject): DealError {
  return { ...item }
}

function fromPbJobStatus(item: JobStatusMap[keyof JobStatusMap]): JobStatus {
  switch (item) {
    case _JobStatus.JOB_STATUS_CANCELED:
      return JobStatus.Canceled
    case _JobStatus.JOB_STATUS_EXECUTING:
      return JobStatus.Executing
    case _JobStatus.JOB_STATUS_FAILED:
      return JobStatus.Failed
    case _JobStatus.JOB_STATUS_QUEUED:
      return JobStatus.Queued
    case _JobStatus.JOB_STATUS_SUCCESS:
      return JobStatus.Success
    case _JobStatus.JOB_STATUS_UNSPECIFIED:
      return JobStatus.Unspecified
  }
}

function fromPbStorageJob(item: _StorageJob.AsObject): StorageJob {
  return {
    ...item,
    // TODO: standardize time units from server.
    createdAt: new Date(item.createdAt * 1000),
    status: fromPbJobStatus(item.status),
    dealInfo: item.dealInfoList.map(fromPbDealInfo),
    dealErrors: item.dealErrorsList.map(fromPbDealError),
  }
}

function fromPbCidInfo(item: _CidInfo.AsObject): CidInfo {
  return {
    ...item,
    latestPushedStorageConfig: item.latestPushedStorageConfig
      ? fromPbStorageConfig(item.latestPushedStorageConfig)
      : undefined,
    currentStorageInfo: item.currentStorageInfo ? fromPbStorageInfo(item.currentStorageInfo) : undefined,
    queuedStorageJobs: item.queuedStorageJobsList.map(fromPbStorageJob),
    executingStorageJob: item.executingStorageJob ? fromPbStorageJob(item.executingStorageJob) : undefined,
    latestFinalStorageJob: item.latestFinalStorageJob ? fromPbStorageJob(item.latestFinalStorageJob) : undefined,
    latestSuccessfulStorageJob: item.latestSuccessfulStorageJob
      ? fromPbStorageJob(item.latestSuccessfulStorageJob)
      : undefined,
  }
}

function fromPbStorageDealInfo(item: _StorageDealInfo.AsObject): StorageDealInfo {
  return { ...item }
}

function fromPbStorageDealRecord(item: _StorageDealRecord.AsObject): StorageDealRecord {
  return {
    ...item,
    // TODO: standardize time units from server.
    time: new Date(item.time * 1000),
    dealInfo: item.dealInfo ? fromPbStorageDealInfo(item.dealInfo) : undefined,
  }
}

function fromPbRetrievalDealInfo(item: _RetrievalDealInfo.AsObject): RetrievalDealInfo {
  return { ...item }
}

function fromPbRetrievalDealRecord(item: _RetrievalDealRecord.AsObject): RetrievalDealRecord {
  return {
    ...item,
    // TODO: standardize time units from server.
    time: new Date(item.time * 1000),
    dealInfo: item.dealInfo ? fromPbRetrievalDealInfo(item.dealInfo) : undefined,
  }
}

/**
 * @internal
 */
export async function addresses(api: GrpcConnection, ctx?: ContextInterface): Promise<AddressInfo[]> {
  logger.debug('addresses request')
  const res: AddressesResponse = await api.unary(UserService.Addresses, new AddressesRequest(), ctx)
  return res.toObject().addressesList.map(fromPbAddressInfo)
}

/**
 * @internal
 */
export async function balance(api: GrpcConnection, address: string, ctx?: ContextInterface): Promise<bigint> {
  const req = new BalanceRequest()
  req.setAddress(address)
  const res: BalanceResponse = await api.unary(UserService.Balance, req, ctx)
  return BigInt(res.getBalance())
}

/**
 * @internal
 */
export async function cidInfo(api: GrpcConnection, ctx?: ContextInterface, ...cids: string[]): Promise<CidInfo[]> {
  const req = new CidInfoRequest()
  req.setCidsList(cids)
  const res: CidInfoResponse = await api.unary(UserService.CidInfo, req, ctx)
  return res.toObject().cidInfosList.map(fromPbCidInfo)
}

/**
 * @internal
 */
export async function storageDealRecords(
  api: GrpcConnection,
  config: DealRecordsConfig,
  ctx?: ContextInterface,
): Promise<StorageDealRecord[]> {
  const c = new _DealRecordsConfig()
  c.setAscending(config.ascending)
  c.setDataCidsList(config.dataCids)
  c.setFromAddrsList(config.fromAddrs)
  c.setIncludeFinal(config.includeFinal)
  c.setIncludePending(config.includePending)
  const req = new StorageDealRecordsRequest()
  req.setConfig(c)
  const res: StorageDealRecordsResponse = await api.unary(UserService.StorageDealRecords, req, ctx)
  return res.toObject().recordsList.map(fromPbStorageDealRecord)
}

/**
 * @internal
 */
export async function retrievalDealRecords(
  api: GrpcConnection,
  config: DealRecordsConfig,
  ctx?: ContextInterface,
): Promise<RetrievalDealRecord[]> {
  const c = new _DealRecordsConfig()
  c.setAscending(config.ascending)
  c.setDataCidsList(config.dataCids)
  c.setFromAddrsList(config.fromAddrs)
  c.setIncludeFinal(config.includeFinal)
  c.setIncludePending(config.includePending)
  const req = new RetrievalDealRecordsRequest()
  req.setConfig(c)
  const res: RetrievalDealRecordsResponse = await api.unary(UserService.RetrievalDealRecords, req, ctx)
  return res.toObject().recordsList.map(fromPbRetrievalDealRecord)
}
