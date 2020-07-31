import { Context, defaultHost } from '@textile/context'
import { GrpcConnection } from '@textile/grpc-connection'
import { Identity } from '@textile/threads-core'
import { UserAuth, KeyInfo } from '@textile/security'
import { Client } from '@textile/hub-threads-client'

export class GrpcAuthentication extends GrpcConnection {
  /**
   * Creates a new gRPC client instance for accessing the Textile Buckets API.
   * @param auth The user auth object.
   */
  static withUserAuth(auth: UserAuth | (() => Promise<UserAuth>), host = defaultHost, debug = false) {
    const context =
      typeof auth === 'object' ? Context.fromUserAuth(auth, host) : Context.fromUserAuthCallback(auth, host)
    return new GrpcAuthentication(context, debug)
  }

  /**
   * Create a new gRPC client Bucket instance from a supplied key and secret
   * @param key The KeyInfo object containing {key: string, secret: string}
   */
  static async withKeyInfo(key: KeyInfo, host = defaultHost, debug = false) {
    const context = new Context(host)
    await context.withKeyInfo(key)
    return new GrpcAuthentication(context, debug)
  }

  /**
   * Scopes to a Thread by ID
   * @param threadId the ID of the thread
   */
  withThread(threadID?: string) {
    if (threadID === undefined) return this
    this.context.withThread(threadID)
  }

  /**
   * Obtain a token for interacting with the remote API.
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
