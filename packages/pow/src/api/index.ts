import { ContextInterface } from '@textile/context'
import { GrpcConnection } from '@textile/grpc-connection'
import {
  AddressesRequest,
  AddressesResponse,
  BalanceRequest,
  BalanceResponse,
  CidInfoRequest,
  CidInfoResponse,
  DealRecordsConfig,
  RetrievalDealRecordsRequest,
  RetrievalDealRecordsResponse,
  StorageDealRecordsRequest,
  StorageDealRecordsResponse,
} from '@textile/grpc-powergate-client/dist/powergate/user/v1/user_pb'
import { UserService } from '@textile/grpc-powergate-client/dist/powergate/user/v1/user_pb_service'
import log from 'loglevel'

const logger = log.getLogger('pow-api')

/**
 * @internal
 */
export async function addresses(api: GrpcConnection, ctx?: ContextInterface): Promise<AddressesResponse.AsObject> {
  logger.debug('addresses request')
  const res: AddressesResponse = await api.unary(UserService.Addresses, new AddressesRequest(), ctx)
  return res.toObject()
}

/**
 * @internal
 */
export async function balance(
  api: GrpcConnection,
  address: string,
  ctx?: ContextInterface,
): Promise<BalanceResponse.AsObject> {
  const req = new BalanceRequest()
  req.setAddress(address)
  const res: BalanceResponse = await api.unary(UserService.Balance, req, ctx)
  return res.toObject()
}

/**
 * @internal
 */
export async function cidInfo(
  api: GrpcConnection,
  ctx?: ContextInterface,
  ...cids: string[]
): Promise<CidInfoResponse.AsObject> {
  const req = new CidInfoRequest()
  req.setCidsList(cids)
  const res: CidInfoResponse = await api.unary(UserService.CidInfo, req, ctx)
  return res.toObject()
}

/**
 * @internal
 */
export async function storageDealRecords(
  api: GrpcConnection,
  config: DealRecordsConfig.AsObject,
  ctx?: ContextInterface,
): Promise<StorageDealRecordsResponse.AsObject> {
  const c = new DealRecordsConfig()
  c.setAscending(config.ascending)
  c.setDataCidsList(config.dataCidsList)
  c.setFromAddrsList(config.fromAddrsList)
  c.setIncludeFinal(config.includeFinal)
  c.setIncludePending(config.includePending)
  const req = new StorageDealRecordsRequest()
  req.setConfig(c)
  const res: StorageDealRecordsResponse = await api.unary(UserService.StorageDealRecords, req, ctx)
  return res.toObject()
}

/**
 * @internal
 */
export async function retrievalDealRecords(
  api: GrpcConnection,
  config: DealRecordsConfig.AsObject,
  ctx?: ContextInterface,
): Promise<RetrievalDealRecordsResponse.AsObject> {
  const c = new DealRecordsConfig()
  c.setAscending(config.ascending)
  c.setDataCidsList(config.dataCidsList)
  c.setFromAddrsList(config.fromAddrsList)
  c.setIncludeFinal(config.includeFinal)
  c.setIncludePending(config.includePending)
  const req = new RetrievalDealRecordsRequest()
  req.setConfig(c)
  const res: RetrievalDealRecordsResponse = await api.unary(UserService.RetrievalDealRecords, req, ctx)
  return res.toObject()
}
