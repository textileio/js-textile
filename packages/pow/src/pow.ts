import { defaultHost } from '@textile/context'
import { Identity } from '@textile/crypto'
import { GrpcAuthentication } from '@textile/grpc-authentication'
import {
  AddrsResponse,
  InfoResponse,
  ListDealRecordsConfig,
  ListRetrievalDealRecordsResponse,
  ListStorageDealRecordsResponse,
  NewAddrResponse,
  SendFilResponse,
  ShowAllResponse,
} from '@textile/grpc-powergate-client/dist/ffs/rpc/rpc_pb'
import { CheckResponse } from '@textile/grpc-powergate-client/dist/health/rpc/rpc_pb'
import {
  ConnectednessResponse,
  FindPeerResponse,
  PeersResponse,
} from '@textile/grpc-powergate-client/dist/net/rpc/rpc_pb'
import { BalanceResponse } from '@textile/grpc-powergate-client/dist/wallet/rpc/rpc_pb'
import { KeyInfo, UserAuth } from '@textile/security'
import log from 'loglevel'
import {
  addrs,
  balance,
  connectedness,
  findPeer,
  health,
  info,
  listRetrievalDealRecords,
  listStorageDealRecords,
  newAddr,
  peers,
  sendFil,
  show,
  showAll,
} from './api'

const logger = log.getLogger('users')

export class Pow extends GrpcAuthentication {
  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.copyAuth}
   *
   * @example
   * Copy an authenticated Users api instance to Pow.
   * ```typescript
   * import { Pow, Users } from '@textile/hub'
   *
   * const usersToPow = async (user: Users) => {
   *   const pow = Pow.copyAuth(user)
   *   return pow
   * }
   * ```
   *
   * @example
   * Copy an authenticated Pow api instance to Users.
   * ```typescript
   * import { Pow, Users } from '@textile/hub'
   *
   * const powToUsers = async (pow: Pow) => {
   *   const user = Users.copyAuth(pow)
   *   return user
   * }
   * ```
   */
  static copyAuth(auth: GrpcAuthentication, debug = false) {
    return new Pow(auth.context, debug)
  }
  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.withUserAuth}
   *
   * @example
   * ```@typescript
   * import { Pow, UserAuth } from '@textile/hub'
   *
   * async function example (userAuth: UserAuth) {
   *   const pow = await Pow.withUserAuth(userAuth)
   * }
   * ```
   */
  static withUserAuth(auth: UserAuth | (() => Promise<UserAuth>), host = defaultHost, debug = false) {
    const res = super.withUserAuth(auth, host, debug)
    return this.copyAuth(res, debug)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.withKeyInfo}
   *
   * @example
   * ```@typescript
   * import { Pow, KeyInfo } from '@textile/hub'
   *
   * async function start () {
   *   const keyInfo: KeyInfo = {
   *     key: '<api key>',
   *     secret: '<api secret>'
   *   }
   *   const pow = await Pow.withKeyInfo(keyInfo)
   * }
   * ```
   */
  static async withKeyInfo(key: KeyInfo, host = defaultHost, debug = false) {
    const auth = await super.withKeyInfo(key, host, debug)
    return this.copyAuth(auth, debug)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.withThread}
   *
   * @example
   * ```@typescript
   * import { Pow, ThreadID } from '@textile/hub'
   *
   * async function example (threadID: ThreadID) {
   *   const pow = await Pow.withThread(threadID)
   * }
   * ```
   */
  withThread(threadID?: string) {
    return super.withThread(threadID)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.getToken}
   *
   * @example
   * ```@typescript
   * import { Pow, PrivateKey } from '@textile/hub'
   *
   * async function example (pow: Pow, identity: PrivateKey) {
   *   const token = await pow.getToken(identity)
   *   return token // already added to `pow` scope
   * }
   * ```
   */
  async getToken(identity: Identity) {
    return super.getToken(identity)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.getTokenChallenge}
   *
   * @example
   * ```typescript
   * import { Pow, PrivateKey } from '@textile/hub'
   *
   * async function example (pow: Pow, identity: PrivateKey) {
   *   const token = await pow.getTokenChallenge(
   *     identity.public.toString(),
   *     (challenge: Uint8Array) => {
   *       return new Promise((resolve, reject) => {
   *         // This is where you should program PrivateKey to respond to challenge
   *         // Read more here: https://docs.textile.io/tutorials/hub/production-auth/
   *       })
   *     }
   *   )
   *   return token
   * }
   * ```
   */
  async getTokenChallenge(
    publicKey: string,
    callback: (challenge: Uint8Array) => Uint8Array | Promise<Uint8Array>,
  ): Promise<string> {
    return super.getTokenChallenge(publicKey, callback)
  }

  async health(): Promise<CheckResponse.AsObject> {
    return health(this)
  }

  /**
   * Gets the Powergate node Filecoin peers. This method
   * requires a valid user, token, and session.
   *
   * @example
   * ```typescript
   * import { Pow } from "@textile/hub"
   *
   * async function example(pow: Pow) {
   *    const peersResp = await pow.peers()
   * }
   * ```
   */
  async peers(): Promise<PeersResponse.AsObject> {
    return peers(this)
  }

  async findPeer(peerId: string): Promise<FindPeerResponse.AsObject> {
    return findPeer(this, peerId)
  }

  async connectedness(peerId: string): Promise<ConnectednessResponse.AsObject> {
    return connectedness(this, peerId)
  }

  async addrs(): Promise<AddrsResponse.AsObject> {
    return addrs(this)
  }

  async newAddr(name: string, type: 'bls' | 'secp256k1', makeDefault: boolean): Promise<NewAddrResponse.AsObject> {
    return newAddr(this, name, type, makeDefault)
  }

  async sendFil(from: string, to: string, amount: number): Promise<SendFilResponse.AsObject> {
    return sendFil(this, from, to, amount)
  }

  async info(): Promise<InfoResponse.AsObject> {
    return info(this)
  }

  async show(cid: string): Promise<SendFilResponse.AsObject> {
    return show(this, cid)
  }

  async showAll(): Promise<ShowAllResponse.AsObject> {
    return showAll(this)
  }

  async listStorageDealRecords(
    config: ListDealRecordsConfig.AsObject,
  ): Promise<ListStorageDealRecordsResponse.AsObject> {
    return listStorageDealRecords(this, config)
  }

  async listRetrievalDealRecords(
    config: ListDealRecordsConfig.AsObject,
  ): Promise<ListRetrievalDealRecordsResponse.AsObject> {
    return listRetrievalDealRecords(this, config)
  }

  async balance(address: string): Promise<BalanceResponse.AsObject> {
    return balance(this, address)
  }
}
