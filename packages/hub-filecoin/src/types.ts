export interface AddressInfo {
  name: string
  address: string
  type: string
  balance: bigint
}

export interface IpfsConfig {
  addTimeout: number
}

export interface HotConfig {
  enabled: boolean
  allowUnfreeze: boolean
  unfreezeMaxPrice: number
  ipfs?: IpfsConfig
}

export interface FilRenew {
  enabled: boolean
  threshold: number
}

export interface FilConfig {
  replicationFactor: number
  dealMinDuration: number
  excludedMiners: string[]
  trustedMiners: string[]
  countryCodes: string[]
  renew?: FilRenew
  address: string
  maxPrice: number
  fastRetrieval: boolean
  dealStartOffset: number
}

export interface ColdConfig {
  enabled: boolean
  filecoin?: FilConfig
}

export interface StorageConfig {
  hot?: HotConfig
  cold?: ColdConfig
  repairable: boolean
}

export interface IpfsHotInfo {
  created: Date
}

export interface HotInfo {
  enabled: boolean
  size: number
  ipfs?: IpfsHotInfo
}

export interface FilStorage {
  proposalCid: string
  renewed: boolean
  duration: number
  activationEpoch: number
  startEpoch: number
  miner: string
  epochPrice: number
  pieceCid: string
}

export interface FilInfo {
  dataCid: string
  size: number
  proposals: FilStorage[]
}

export interface ColdInfo {
  enabled: boolean
  filecoin?: FilInfo
}

export interface StorageInfo {
  jobId: string
  cid: string
  created: Date
  hot?: HotInfo
  cold?: ColdInfo
}

export interface DealInfo {
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

export interface DealError {
  proposalCid: string
  miner: string
  message: string
}

export enum JobStatus {
  Unspecified,
  Queued,
  Executing,
  Failed,
  Canceled,
  Success,
}

export interface StorageJob {
  id: string
  apiId: string
  cid: string
  status: JobStatus
  errorCause: string
  dealInfo: DealInfo[]
  dealErrors: DealError[]
  createdAt: Date
}

export interface CidInfo {
  cid: string
  latestPushedStorageConfig?: StorageConfig
  currentStorageInfo?: StorageInfo
  queuedStorageJobs: StorageJob[]
  executingStorageJob?: StorageJob
  latestFinalStorageJob?: StorageJob
  latestSuccessfulStorageJob?: StorageJob
}

export interface StorageDealInfo {
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

export interface StorageDealRecord {
  rootCid: string
  address: string
  time: Date
  pending: boolean
  dealInfo?: StorageDealInfo
}

export interface RetrievalDealInfo {
  rootCid: string
  size: number
  minPrice: number
  paymentInterval: number
  paymentIntervalIncrease: number
  miner: string
  minerPeerId: string
}

export interface RetrievalDealRecord {
  address: string
  time: Date
  dealInfo?: RetrievalDealInfo
}

export interface DealRecordsConfig {
  fromAddrs: string[]
  dataCids: string[]
  includePending: boolean
  includeFinal: boolean
  ascending: boolean
}
