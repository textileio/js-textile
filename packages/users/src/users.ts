import log from 'loglevel'
import { Context, defaultHost } from '@textile/context'
import { Client } from '@textile/hub-threads-client'
import { Identity, Libp2pCryptoIdentity, Libp2pCryptoPublicKey } from '@textile/threads-core'
import { UserAuth, KeyInfo } from '@textile/security'
import { ThreadID } from '@textile/threads-id'
import { GetThreadReply, SetupMailboxReply, ListMessagesReply } from '@textile/users-grpc/users_pb'
import {
  UsersGrpcClient,
  getThread,
  listInboxMessages,
  listThreads,
  setupMailbox,
  sendMessage,
  Status,
  StatusInt,
  listSentboxMessages,
  readInboxMessage,
  deleteInboxMessage,
  deleteSentboxMessage,
} from './api'

const logger = log.getLogger('users')

export class Users extends UsersGrpcClient {
  /**
   * Creates a new gRPC client instance for accessing the Textile Buckets API.
   * @param auth The user auth object.
   */
  static withUserAuth(auth: UserAuth | (() => Promise<UserAuth>), host = defaultHost, debug = false) {
    const context =
      typeof auth === 'object' ? Context.fromUserAuth(auth, host) : Context.fromUserAuthCallback(auth, host)
    return new Users(context, debug)
  }

  /**
   * Create a new gRPC client Bucket instance from a supplied key and secret
   * @param key The KeyInfo object containing {key: string, secret: string}
   */
  static async withKeyInfo(key: KeyInfo, host = defaultHost, debug = false) {
    const context = new Context(host)
    await context.withKeyInfo(key)
    return new Users(context, debug)
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

  async listThreads(): Promise<Array<GetThreadReply.AsObject>> {
    return listThreads(this)
  }

  async getThread(name: string): Promise<GetThreadReply.AsObject> {
    return getThread(this, name)
  }

  async setupMailbox(): Promise<{ mailboxID: Uint8Array | string }> {
    return setupMailbox(this)
  }

  async sendMessage(
    from: Libp2pCryptoIdentity,
    to: Libp2pCryptoPublicKey,
    body: string,
  ): Promise<{ id: string; createdAt: number }> {
    const fromBody = body // <- wrong
    const fromSig = await from.sign(Buffer.from(fromBody))
    const toBody = to.toString() // <- wrong
    const toSig = await from.sign(Buffer.from(toBody))
    return sendMessage(this, to, toBody, toSig, fromBody, fromSig)
  }

  async listInboxMessages(
    seek: string,
    limit: number,
    ascending: boolean,
    status: Status | StatusInt,
  ): Promise<ListMessagesReply.AsObject> {
    return listInboxMessages(this, seek, limit, ascending, status)
  }

  async listSentboxMessages(seek: string, limit: number, ascending: boolean): Promise<ListMessagesReply.AsObject> {
    return listSentboxMessages(this, seek, limit, ascending)
  }

  async readInboxMessage(id: string): Promise<{ readAt: number }> {
    return readInboxMessage(this, id)
  }

  async deleteInboxMessage(id: string): Promise<{}> {
    return deleteInboxMessage(this, id)
  }

  async deleteSentboxMessage(id: string): Promise<{}> {
    return deleteSentboxMessage(this, id)
  }
}
