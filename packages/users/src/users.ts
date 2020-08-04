import log from 'loglevel'
import { GrpcAuthentication } from '@textile/grpc-authentication'
import { encrypt, Identity, extractPublicKeyBytes, Public } from '@textile/crypto'
import {
  getThread,
  listInboxMessages,
  listThreads,
  setupMailbox,
  sendMessage,
  listSentboxMessages,
  readInboxMessage,
  deleteInboxMessage,
  deleteSentboxMessage,
  InboxListOptions,
  SentboxListOptions,
  GetThreadReplyObj,
  UserMessage,
} from './api'
import { UserAuth, KeyInfo } from '@textile/security'
import { defaultHost } from '@textile/context'

const logger = log.getLogger('users')

export class Users extends GrpcAuthentication {
  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.copyAuth}
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
    return new Users(auth.context, debug)
  }
  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.withUserAuth}
   */
  static withUserAuth(auth: UserAuth | (() => Promise<UserAuth>), host = defaultHost, debug = false) {
    const res = super.withUserAuth(auth, host, debug)
    return this.copyAuth(res, debug)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.withKeyInfo}
   */
  static async withKeyInfo(key: KeyInfo, host = defaultHost, debug = false) {
    const auth = await super.withKeyInfo(key, host, debug)
    return this.copyAuth(auth, debug)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.withThread}
   */
  withThread(threadID?: string) {
    return super.withThread(threadID)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.getToken}
   */
  async getToken(identity: Identity) {
    return super.getToken(identity)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.getTokenChallenge}
   */
  async getTokenChallenge(
    publicKey: string,
    callback: (challenge: Uint8Array) => Uint8Array | Promise<Uint8Array>,
  ): Promise<string> {
    return super.getTokenChallenge(publicKey, callback)
  }

  /**
   * Lists a users existing threads. This method
   * requires a valid user, token, and session.
   *
   * @example
   * ```typescript
   * import { Users } from "@textile/hub"
   *
   * async function example(api: Users) {
   *    const list = await api.listThreads()
   * }
   * ```
   */
  async listThreads(): Promise<Array<GetThreadReplyObj>> {
    return listThreads(this)
  }

  /**
   * Gets a users existing thread by name.
   *
   * @example
   * ```typescript
   * import { Users } from "@textile/hub"
   *
   * async function example(api: Users) {
   *    const thread = await api.getThread('thread-name')
   *    return thread
   * }
   * ```
   */
  async getThread(name: string): Promise<GetThreadReplyObj> {
    return getThread(this, name)
  }

  /**
   * Setup a user's inbox. This is required for each new user.
   * An inbox must be setup by the inbox owner (keys) before
   * messages can be sent to it.
   *
   * @example
   * ```typescript
   * import { Users } from "@textile/hub"
   *
   * async function example(api: Users) {
   *    return await api.setupMailbox()
   * }
   * ```
   */
  async setupMailbox(): Promise<{ mailboxID: Uint8Array }> {
    return setupMailbox(this)
  }

  /**
   * A local user can author messages to remote user through their public-key
   *
   * @example
   * ```typescript
   * import { Users, Identity, PublicKey  } from "@textile/hub"
   *
   * async function example(api: Users, sender: Identity, recipient: PublicKey, message: string) {
   *   const encoder = new TextEncoder()
   *   const messageBytes = encoder.encode(message)
   *   return await api.sendMessage(sender, recipient, messageBytes)
   * }
   * ```
   */
  async sendMessage(from: Identity, to: Public, body: Uint8Array): Promise<UserMessage> {
    logger.debug('send message using keys')
    const toBytes = extractPublicKeyBytes(to)
    const fromBytes = extractPublicKeyBytes(from.public)
    const fromBody = await encrypt(body, fromBytes)
    const fromSig = await from.sign(fromBody)
    const toBody = await encrypt(body, toBytes)
    const toSig = await from.sign(toBody)
    return sendMessage(this, from.public.toString(), to.toString(), toBody, toSig, fromBody, fromSig)
  }

  /**
   * List the inbox of the local user
   *
   * @example
   * ```typescript
   * import { Users, Status } from "@textile/hub"
   *
   * async function example(api: Users) {
   *    return await api.listInboxMessages({
   *      limit: 5,
   *      ascending: true,
   *      status: Status.UNREAD,
   *    })
   * }
   * ```
   */
  async listInboxMessages(opts?: InboxListOptions): Promise<Array<UserMessage>> {
    return listInboxMessages(this, opts)
  }

  /**
   * List the sent messages of the local user
   *
   * @example
   * ```typescript
   * import { Users } from "@textile/hub"
   *
   * async function example(api: Users) {
   *    return await api.listSentboxMessages({
   *      limit: 5,
   *      ascending: true,
   *    })
   * }
   * ```
   */
  async listSentboxMessages(opts?: SentboxListOptions): Promise<Array<UserMessage>> {
    return listSentboxMessages(this, opts)
  }

  /**
   * Mark a message as read
   *
   * @example
   * ```typescript
   * import { Users } from "@textile/hub"
   *
   * async function example(api: Users) {
   *    const res = await api.listInboxMessages({
   *      limit: 1,
   *      ascending: true,
   *    })
   *    if (res.length === 1) api.readInboxMessage(res[0].id)
   * }
   * ```
   */
  async readInboxMessage(id: string): Promise<{ readAt: number }> {
    return readInboxMessage(this, id)
  }

  /**
   * Mark a message as read
   *
   * @example
   * ```typescript
   * import { Users } from "@textile/hub"
   *
   * async function example(api: Users) {
   *    const res = await api.listInboxMessages({
   *      limit: 1,
   *      ascending: true,
   *    })
   *    if (res.length === 1) api.deleteInboxMessage(res[0].id)
   * }
   * ```
   */
  async deleteInboxMessage(id: string): Promise<{}> {
    return deleteInboxMessage(this, id)
  }

  /**
   * Mark a message as read
   *
   * @example
   * ```typescript
   * import { Users } from "@textile/hub"
   *
   * async function example(api: Users) {
   *    const res = await api.listSentboxMessages({
   *      limit: 1,
   *      ascending: true,
   *    })
   *    if (res.length === 1) api.deleteInboxMessage(res[0].id)
   * }
   * ```
   */
  async deleteSentboxMessage(id: string): Promise<{}> {
    return deleteSentboxMessage(this, id)
  }
}
