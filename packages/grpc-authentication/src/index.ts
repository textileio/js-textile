import { Context, defaultHost, ContextInterface } from '@textile/context'
import { GrpcConnection } from '@textile/grpc-connection'
import { Identity } from '@textile/crypto'
import { UserAuth, KeyInfo } from '@textile/security'
import { Client } from '@textile/hub-threads-client'

// Solves child class static type creation
// https://stackoverflow.com/questions/45123761/instantiating-child-class-from-a-static-method-in-base-class-using-typescript/45262288
export type StaticThis<T> = { new (context: ContextInterface, debug?: boolean): T }

/**
 * Not a directly used class, but defines the authorization, authentication, and
 * API scoping methods used by gRPC API client classes such as Users and Buckets.
 */
export class GrpcAuthentication extends GrpcConnection {
  /**
   * Copies the full scope and authentication from one API instance to this one.
   * This will copy any existing authentication and authorization info, including:
   *
   *   - Information created withKeyInfo and withUserAuth.
   *   - Any token generated from getToken or getTokenChallenge.
   *   - If you scoped the instance to a specific thread using withThread
   *
   * @param auth any authenticated API class such as Users or Buckets.
   *
   * @example
   * Copy an authenticated Users api instance to Buckets.
   * ```tyepscript
   * import { Buckets, Users } from '@textile/hub'
   *
   * const usersToBuckets = async (user: Users) => {
   *   const buckets = Buckets.copyAuth(user)
   *   return buckets
   * }
   * ```
   * 
   * @example
   * Copy an authenticated Buckets api instance to Users.
   * ```tyepscript
   * import { Buckets, Users } from '@textile/hub'
   *
   * const bucketsToUsers = async (buckets: Buckets) => {
   *   const user = Users.copyAuth(buckets)
   *   return user
   * }
   * ```
   */

  static copyAuth(auth: GrpcAuthentication, debug = false) {
    return new GrpcAuthentication(auth.context, debug)
  }

  /**
   * Creates a new API client instance for accessing the gRPC API
   * using User Group key authentication. This method is recommended for
   * public apps where API secrets need to remain hidden from end users.
   * @param auth The UserAuth object.
   */
  static withUserAuth(auth: UserAuth | (() => Promise<UserAuth>), host = defaultHost, debug = false) {
    const context =
      typeof auth === 'object' ? Context.fromUserAuth(auth, host) : Context.fromUserAuthCallback(auth, host)
    return new GrpcAuthentication(context, debug)
  }

  /**
   * Creates a new API client instance for accessing the gRPC API
   * using key & secret based authentication. This method is recommended
   * for admin or insecure implementations where the non-signing keys or
   * key with secret can be embedded directly in an app.
   * @param key The KeyInfo object containing {key: string, secret: string}
   */
  static async withKeyInfo(key: KeyInfo, host = defaultHost, debug = false) {
    const context = new Context(host)
    await context.withKeyInfo(key)
    return new GrpcAuthentication(context, debug)
  }

  /**
   * Scope future API calls to a specific thread.
   * For both Buckets and Threads, many API calls require knowledge
   * about which thread you are making requests against. Use `withThread`
   * to declare your target thread before making those API calls.
   * @param threadId the ID of the thread
   */
  withThread(threadID?: string) {
    if (threadID === undefined) return this
    this.context.withThread(threadID)
  }

  /**
   * Obtain a token for interacting with the remote API.
   * When your app is creating new private-key based users to interact with
   * the API using User Group keys, you must first create a new token for
   * each new user. Tokens do not change after you create them.
   * @param identity A user identity to use for interacting with APIs.
   */
  async getToken(identity: Identity) {
    const client = new Client(this.context)
    const token = await client.getToken(identity)
    this.context.withToken(token)
    return token
  }

  /**
   * Obtain a token for interacting with the remote API.
   * When your app is creating new private-key based users to interact with
   * the API using User Group keys, you must first create a new token for
   * each new user. Tokens do not change after you create them. This callback
   * method will require you to handle challenge signing.
   * @param identity A user identity to use for interacting with buckets.
   * @param callback A callback function that takes a `challenge` argument and returns a signed
   * message using the input challenge and the private key associated with `publicKey`.
   * @note `publicKey` must be the corresponding public key of the private key used in `callback`.
   */
  async getTokenChallenge(
    publicKey: string,
    callback: (challenge: Uint8Array) => Uint8Array | Promise<Uint8Array>,
  ): Promise<string> {
    const client = new Client(this.context)
    return client.getTokenChallenge(publicKey, callback)
  }
}
