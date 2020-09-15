import { Identity } from '@textile/crypto'
import {
  CopyAuthOptions,
  GrpcAuthentication,
  WithKeyInfoOptions,
  WithUserAuthOptions,
} from '@textile/grpc-authentication'
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
  show,
  showAll,
} from './api'

const logger = log.getLogger('pow')
/**
 * Pow a client wrapper for interacting with the Textile Powergate API.
 * @example
 * Initialize the Bucket API and open an existing bucket (or create if new).
 * ```typescript
 * import { Pow, PrivateKey, UserAuth } from '@textile/hub'
 *
 * const checkHealth = async (auth: UserAuth, user: PrivateKey) => {
 *   const pow = Pow.withUserAuth(auth)
 *   // Scope the API to the current user
 *   pow.getToken(user)
 *   // List adrs
 *   const health = pow.health()
 * }
 * ```
 */
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
  static copyAuth(auth: GrpcAuthentication, options?: CopyAuthOptions) {
    return new Pow(auth.context, options?.debug)
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
  static withUserAuth(auth: UserAuth | (() => Promise<UserAuth>), options?: WithUserAuthOptions) {
    const res = super.withUserAuth(auth, options)
    return this.copyAuth(res, options)
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
  static async withKeyInfo(key: KeyInfo, options?: WithKeyInfoOptions) {
    const auth = await super.withKeyInfo(key, options)
    return this.copyAuth(auth, options)
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

  /**
   * @beta
   */
  async health(): Promise<CheckResponse.AsObject> {
    return health(this)
  }

  /**
   * Gets the Powergate node Filecoin peers. This method
   * requires a valid user, token, and session.
   * @beta
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

  /**
   * Find a peer by peer id.
   * @beta
   * @param peerId The peer id of the peer you want to find.
   */
  async findPeer(peerId: string): Promise<FindPeerResponse.AsObject> {
    return findPeer(this, peerId)
  }

  /**
   * Query for network connectedness to the specified peer.
   * @beta
   * @param peerId The peer id to test connectedness for.
   */
  async connectedness(peerId: string): Promise<ConnectednessResponse.AsObject> {
    return connectedness(this, peerId)
  }

  /**
   * List all Filecoin wallet addresses associated with the current account or user.
   * @beta
   */
  async addrs(): Promise<AddrsResponse.AsObject> {
    return addrs(this)
  }

  /**
   * Create a new Filecoin wallet address.
   * @beta
   * @param name A human readable name for the wallet address.
   * @param type The type of address to create, wither bls or secp256k1.
   * @param makeDefault Whether or not to make the new address the default address to use in Filecoin transactions.
   */
  async newAddr(name: string, type: 'bls' | 'secp256k1', makeDefault: boolean): Promise<NewAddrResponse.AsObject> {
    return newAddr(this, name, type, makeDefault)
  }

  /**
   * Query for general information about Powergate associated with the current account/user.
   * @beta
   */
  async info(): Promise<InfoResponse.AsObject> {
    return info(this)
  }

  /**
   * Show information about data stored in Powergate.
   * @beta
   * @param cid The cid of the data to show information about.
   */
  async show(cid: string): Promise<SendFilResponse.AsObject> {
    return show(this, cid)
  }

  /**
   * Show information for all data stored in Powergate for the current account/user.
   * @beta
   */
  async showAll(): Promise<ShowAllResponse.AsObject> {
    return showAll(this)
  }

  /**
   * Query for Filecoin storage deal records for the current account/user.
   * @beta
   * @param config A config object to control the behavior of the query.
   */
  async listStorageDealRecords(
    config: ListDealRecordsConfig.AsObject,
  ): Promise<ListStorageDealRecordsResponse.AsObject> {
    return listStorageDealRecords(this, config)
  }

  /**
   * Query for Filecoin retrieval deal records for the current account/user.
   * @beta
   * @param config A config object to control the behavior of the query.
   */
  async listRetrievalDealRecords(
    config: ListDealRecordsConfig.AsObject,
  ): Promise<ListRetrievalDealRecordsResponse.AsObject> {
    return listRetrievalDealRecords(this, config)
  }

  /**
   * Get the balance for any wallet address.
   * @beta
   * @param address The wallet address to check the balance of.
   */
  async balance(address: string): Promise<BalanceResponse.AsObject> {
    return balance(this, address)
  }
}
