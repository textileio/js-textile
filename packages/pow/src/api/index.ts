import { ContextInterface } from '@textile/context'
import { GrpcConnection } from '@textile/grpc-connection'
import {
  AddrsRequest,
  AddrsResponse,
  InfoRequest,
  InfoResponse,
  ListDealRecordsConfig,
  ListRetrievalDealRecordsRequest,
  ListRetrievalDealRecordsResponse,
  ListStorageDealRecordsRequest,
  ListStorageDealRecordsResponse,
  NewAddrRequest,
  NewAddrResponse,
  SendFilRequest,
  SendFilResponse,
  ShowAllRequest,
  ShowAllResponse,
  ShowRequest,
  ShowResponse,
} from '@textile/grpc-powergate-client/dist/ffs/rpc/rpc_pb'
import { RPCService as FFSRPCService } from '@textile/grpc-powergate-client/dist/ffs/rpc/rpc_pb_service'
import { CheckRequest, CheckResponse } from '@textile/grpc-powergate-client/dist/health/rpc/rpc_pb'
import { RPCService as HealthRPCService } from '@textile/grpc-powergate-client/dist/health/rpc/rpc_pb_service'
import {
  ConnectednessRequest,
  ConnectednessResponse,
  FindPeerRequest,
  FindPeerResponse,
  PeersRequest,
  PeersResponse,
} from '@textile/grpc-powergate-client/dist/net/rpc/rpc_pb'
import { RPCService as NetRPCService } from '@textile/grpc-powergate-client/dist/net/rpc/rpc_pb_service'
import { BalanceRequest, BalanceResponse } from '@textile/grpc-powergate-client/dist/wallet/rpc/rpc_pb'
import { RPCService as WalletRPCService } from '@textile/grpc-powergate-client/dist/wallet/rpc/rpc_pb_service'
import log from 'loglevel'

const logger = log.getLogger('pow-api')

/**
 * @internal
 */
export async function health(api: GrpcConnection, ctx?: ContextInterface): Promise<CheckResponse.AsObject> {
  logger.debug('health request')
  const res: CheckResponse = await api.unary(HealthRPCService.Check, new CheckRequest(), ctx)
  return res.toObject()
}

/**
 * @internal
 */
export async function peers(api: GrpcConnection, ctx?: ContextInterface): Promise<PeersResponse.AsObject> {
  logger.debug('peers request')
  const res: PeersResponse = await api.unary(NetRPCService.Peers, new PeersRequest(), ctx)
  return res.toObject()
}

/**
 * @internal
 */
export async function findPeer(
  api: GrpcConnection,
  peerId: string,
  ctx?: ContextInterface,
): Promise<FindPeerResponse.AsObject> {
  logger.debug('find peer request')
  const req = new FindPeerRequest()
  req.setPeerId(peerId)
  const res: FindPeerResponse = await api.unary(NetRPCService.FindPeer, req, ctx)
  return res.toObject()
}

/**
 * @internal
 */
export async function connectedness(
  api: GrpcConnection,
  peerId: string,
  ctx?: ContextInterface,
): Promise<ConnectednessResponse.AsObject> {
  logger.debug('find peer request')
  const req = new ConnectednessRequest()
  req.setPeerId(peerId)
  const res: ConnectednessResponse = await api.unary(NetRPCService.Connectedness, req, ctx)
  return res.toObject()
}

/**
 * @internal
 */
export async function addrs(api: GrpcConnection, ctx?: ContextInterface): Promise<AddrsResponse.AsObject> {
  logger.debug('addrs request')
  const res: AddrsResponse = await api.unary(FFSRPCService.Addrs, new AddrsRequest(), ctx)
  return res.toObject()
}

/**
 * @internal
 */
export async function newAddr(
  api: GrpcConnection,
  name: string,
  type: 'bls' | 'secp256k1',
  makeDefault: boolean,
  ctx?: ContextInterface,
): Promise<NewAddrResponse.AsObject> {
  logger.debug('newAddr request')
  const req = new NewAddrRequest()
  req.setName(name)
  req.setAddressType(type)
  req.setMakeDefault(makeDefault)
  const res: NewAddrResponse = await api.unary(FFSRPCService.NewAddr, req, ctx)
  return res.toObject()
}

/**
 * @internal
 */
export async function info(api: GrpcConnection, ctx?: ContextInterface): Promise<InfoResponse.AsObject> {
  const res: InfoResponse = await api.unary(FFSRPCService.Info, new InfoRequest(), ctx)
  return res.toObject()
}

/**
 * @internal
 */
export async function show(
  api: GrpcConnection,
  cid: string,
  ctx?: ContextInterface,
): Promise<SendFilResponse.AsObject> {
  const req = new ShowRequest()
  req.setCid(cid)
  const res: ShowResponse = await api.unary(FFSRPCService.Show, req, ctx)
  return res.toObject()
}

/**
 * @internal
 */
export async function showAll(api: GrpcConnection, ctx?: ContextInterface): Promise<ShowAllResponse.AsObject> {
  const res: ShowAllResponse = await api.unary(FFSRPCService.ShowAll, new ShowAllRequest(), ctx)
  return res.toObject()
}

/**
 * @internal
 */
export async function listStorageDealRecords(
  api: GrpcConnection,
  config: ListDealRecordsConfig.AsObject,
  ctx?: ContextInterface,
): Promise<ListStorageDealRecordsResponse.AsObject> {
  const c = new ListDealRecordsConfig()
  c.setAscending(config.ascending)
  c.setDataCidsList(config.dataCidsList)
  c.setFromAddrsList(config.fromAddrsList)
  c.setIncludeFinal(config.includeFinal)
  c.setIncludePending(config.includePending)
  const req = new ListStorageDealRecordsRequest()
  req.setConfig(c)
  const res: ListStorageDealRecordsResponse = await api.unary(FFSRPCService.ListStorageDealRecords, req, ctx)
  return res.toObject()
}

/**
 * @internal
 */
export async function listRetrievalDealRecords(
  api: GrpcConnection,
  config: ListDealRecordsConfig.AsObject,
  ctx?: ContextInterface,
): Promise<ListRetrievalDealRecordsResponse.AsObject> {
  const c = new ListDealRecordsConfig()
  c.setAscending(config.ascending)
  c.setDataCidsList(config.dataCidsList)
  c.setFromAddrsList(config.fromAddrsList)
  c.setIncludeFinal(config.includeFinal)
  c.setIncludePending(config.includePending)
  const req = new ListRetrievalDealRecordsRequest()
  req.setConfig(c)
  const res: ListRetrievalDealRecordsResponse = await api.unary(FFSRPCService.ListRetrievalDealRecords, req, ctx)
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
  const res: BalanceResponse = await api.unary(WalletRPCService.Balance, req, ctx)
  return res.toObject()
}
