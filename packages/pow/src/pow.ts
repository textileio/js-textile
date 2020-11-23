import { Identity } from '@textile/crypto'
import {
  CopyAuthOptions,
  GrpcAuthentication,
  WithKeyInfoOptions,
  WithUserAuthOptions,
} from '@textile/grpc-authentication'
import {
  AddressesResponse,
  BalanceResponse,
  CidInfoResponse,
  DealRecordsConfig,
  RetrievalDealRecordsResponse,
  StorageDealRecordsResponse,
} from '@textile/grpc-powergate-client/dist/powergate/user/v1/user_pb'
import { KeyInfo, UserAuth } from '@textile/security'
import log from 'loglevel'
import { addresses, balance, cidInfo, retrievalDealRecords, storageDealRecords } from './api'

const logger = log.getLogger('pow')
/**
 * Pow a client wrapper for interacting with the Textile Powergate API.
 * @example
 * Initialize the Bucket API and open an existing bucket (or create if new).
 * ```typescript
 * import { Pow, PrivateKey, UserAuth } from '@textile/hub'
 *
 * const getAddresses = async (auth: UserAuth, user: PrivateKey) => {
 *   const pow = Pow.withUserAuth(auth)
 *   // Scope the API to the current user
 *   await pow.getToken(user)
 *   // List wallet addresses
 *   const health = await pow.addresses()
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
   * List all Filecoin wallet addresses associated with the current account or user.
   * @beta
   */
  async addresses(): Promise<AddressesResponse.AsObject> {
    return addresses(this)
  }

  /**
   * Get the balance for any wallet address.
   * @beta
   * @param address The wallet address to check the balance of.
   */
  async balance(address: string): Promise<BalanceResponse.AsObject> {
    return balance(this, address)
  }

  /**
   * Get information about the storage and job job state of cids stored by the user.
   * @beta
   * @param cids The cids to get info for.
   */
  async cidInfo(...cids: string[]): Promise<CidInfoResponse.AsObject> {
    return cidInfo(this, undefined, ...cids)
  }

  /**
   * Query for Filecoin storage deal records for the current account/user.
   * @beta
   * @param config A config object to control the behavior of the query.
   */
  async storageDealRecords(config: DealRecordsConfig.AsObject): Promise<StorageDealRecordsResponse.AsObject> {
    return storageDealRecords(this, config)
  }

  /**
   * Query for Filecoin retrieval deal records for the current account/user.
   * @beta
   * @param config A config object to control the behavior of the query.
   */
  async retrievalDealRecords(config: DealRecordsConfig.AsObject): Promise<RetrievalDealRecordsResponse.AsObject> {
    return retrievalDealRecords(this, config)
  }
}
