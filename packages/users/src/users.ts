import { grpc } from '@improbable-eng/grpc-web'
import {
  encrypt,
  extractPublicKeyBytes,
  Identity,
  Public,
} from '@textile/crypto'
import {
  CopyAuthOptions,
  GrpcAuthentication,
  WithKeyInfoOptions,
  WithUserAuthOptions,
} from '@textile/grpc-authentication'
import { GetThreadResponse } from '@textile/hub-threads-client'
import { KeyInfo, UserAuth } from '@textile/security'
import {
  deleteInboxMessage,
  deleteSentboxMessage,
  getMailboxID,
  getThread,
  getUsage,
  GetUsageResponse,
  InboxListOptions,
  listInboxMessages,
  listSentboxMessages,
  listThreads,
  MailboxEvent,
  readInboxMessage,
  sendMessage,
  SentboxListOptions,
  setupMailbox,
  UsageOptions,
  UserMessage,
  watchMailbox,
} from './api'

/**
 * Users a client wrapper for interacting with the Textile Users API.
 *
 * This API has the ability to:
 *
 *   - Register new users with a User Group key and obtain a new API Token
 *
 *   - Get and List all Threads created for/by the user in your app.
 *
 *   - Create an inbox for the user or send message to another user's inbox.
 *
 *   - Check, read, and delete messages in a user's inbox.
 *
 * @example
 * Initialize a the User API and list their threads.
 * ```typescript
 * import { Users, UserAuth } from '@textile/hub'
 *
 * const example = async (auth: UserAuth) => {
 *   const api = Users.withUserAuth(auth)
 *   const list = api.listThreads()
 *   return list
 * }
 * ```
 *
 * @example
 * Create a new inbox for the user
 * ```typescript
 * import { Users } from '@textile/hub'
 *
 * // This method requires you already authenticate the Users object.
 * async function setupMailbox (users: Users) {
 *   await users.setupMailbox()
 * }
 * ```
 *
 * @example
 * Send a message to a public key
 * ```typescript
 * import { Users, Identity, PublicKey  } from "@textile/hub"
 *
 * // This method requires you already authenticate the Users object.
 *
 * async function example(users: Users, from: Identity, to: PublicKey, message: string) {
 *   const encoder = new TextEncoder()
 *   const body = encoder.encode(message)
 *   return await users.sendMessage(from, to, body)
 * }
 * ```
 */
export class Users extends GrpcAuthentication {
  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.copyAuth}
   *
   * @example
   * Copy an authenticated Users api instance to Buckets.
   * ```typescript
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
   * ```typescript
   * import { Buckets, Users } from '@textile/hub'
   *
   * const bucketsToUsers = async (buckets: Buckets) => {
   *   const user = Users.copyAuth(buckets)
   *   return user
   * }
   * ```
   */
  static copyAuth(auth: GrpcAuthentication, options?: CopyAuthOptions): Users {
    return new Users(auth.context, options?.debug)
  }
  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.withUserAuth}
   *
   * @example
   * ```@typescript
   * import { Users, UserAuth } from '@textile/hub'
   *
   * async function example (userAuth: UserAuth) {
   *   const users = await Users.withUserAuth(userAuth)
   * }
   * ```
   */
  static withUserAuth(
    auth: UserAuth | (() => Promise<UserAuth>),
    options?: WithUserAuthOptions,
  ): Users {
    const res = super.withUserAuth(auth, options)
    return this.copyAuth(res, options)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.withKeyInfo}
   *
   * @example
   * ```@typescript
   * import { Users, KeyInfo } from '@textile/hub'
   *
   * async function start () {
   *   const keyInfo: KeyInfo = {
   *     key: '<api key>',
   *     secret: '<api secret>'
   *   }
   *   const users = await Users.withKeyInfo(keyInfo)
   * }
   * ```
   */
  static async withKeyInfo(
    key: KeyInfo,
    options?: WithKeyInfoOptions,
  ): Promise<Users> {
    const auth = await super.withKeyInfo(key, options)
    return this.copyAuth(auth, options)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.withThread}
   *
   * @example
   * ```@typescript
   * import { Client, ThreadID } from '@textile/hub'
   *
   * async function example (threadID: ThreadID) {
   *   const id = threadID.toString()
   *   const users = await Users.withThread(id)
   * }
   * ```
   */
  withThread(threadID?: string): void {
    return super.withThread(threadID)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.getToken}
   *
   * @example
   * ```@typescript
   * import { Users, PrivateKey } from '@textile/hub'
   *
   * async function example (users: Users, identity: PrivateKey) {
   *   const token = await users.getToken(identity)
   *   return token // already added to `users` scope
   * }
   * ```
   */
  async getToken(identity: Identity): Promise<string> {
    return super.getToken(identity)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.getToken}
   */
  setToken(token: string): Promise<void> {
    return super.setToken(token)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.getTokenChallenge}
   *
   * @example
   * ```typescript
   * import { Users, PrivateKey } from '@textile/hub'
   *
   * async function example (users: Users, identity: PrivateKey) {
   *   const token = await users.getTokenChallenge(
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
   * GetUsage returns current billing and usage information.
   *
   * @example
   * ```typescript
   * import { Users } from "@textile/hub"
   *
   * async function example(users: Users) {
   *    const usage = await users.getUsage()
   * }
   * ```
   */
  async getUsage(options?: UsageOptions): Promise<GetUsageResponse> {
    return getUsage(this, options)
  }

  /**
   * Lists a users existing threads. This method
   * requires a valid user, token, and session.
   *
   * @example
   * ```typescript
   * import { Users } from "@textile/hub"
   *
   * async function example(users: Users) {
   *    const list = await users.listThreads()
   * }
   * ```
   */
  async listThreads(): Promise<Array<GetThreadResponse>> {
    return listThreads(this)
  }

  /**
   * Gets a users existing thread by name.
   *
   * @example
   * ```typescript
   * import { Users } from "@textile/hub"
   *
   * async function example(users: Users) {
   *    const thread = await users.getThread('thread-name')
   *    return thread
   * }
   * ```
   */
  async getThread(name: string): Promise<GetThreadResponse> {
    return getThread(this, name)
  }

  /**
   * Setup a user's inbox. This is required for each new user.
   * An inbox must be setup by the inbox owner (keys) before
   * messages can be sent to it.
   *
   * @returns mailboxID
   *
   * @example
   * ```typescript
   * import { Users } from "@textile/hub"
   *
   * async function example(users: Users) {
   *    return await users.setupMailbox()
   * }
   * ```
   */
  async setupMailbox(): Promise<string> {
    return setupMailbox(this)
  }

  /**
   * Returns the mailboxID of the current user if it exists.
   *
   * @returns {string} mailboxID
   */
  async getMailboxID(): Promise<string> {
    return getMailboxID(this)
  }

  /**
   * A local user can author messages to remote user through their public-key
   *
   * @param from defines the local, sending, user. Any object that conforms to the Identity interface.
   * @param to defines the remote, receiving user. Any object that conforms to the Public interface.
   * @param body is the message body bytes in UInt8Array format.
   *
   * @example
   * ```typescript
   * import { Users, Identity, PublicKey  } from "@textile/hub"
   *
   * async function example(users: Users, from: Identity, to: PublicKey, message: string) {
   *   const encoder = new TextEncoder()
   *   const body = encoder.encode(message)
   *   return await users.sendMessage(from, to, body)
   * }
   * ```
   */
  async sendMessage(
    from: Identity,
    to: Public,
    body: Uint8Array,
  ): Promise<UserMessage> {
    const toBytes = extractPublicKeyBytes(to)
    const fromBytes = extractPublicKeyBytes(from.public)
    const fromBody = await encrypt(body, fromBytes)
    const fromSig = await from.sign(fromBody)
    const toBody = await encrypt(body, toBytes)
    const toSig = await from.sign(toBody)
    return sendMessage(
      this,
      from.public.toString(),
      to.toString(),
      toBody,
      toSig,
      fromBody,
      fromSig,
    )
  }

  /**
   * List the inbox of the local user
   *
   * @example
   * ```typescript
   * import { Users, Status } from "@textile/hub"
   *
   * async function example(users: Users) {
   *    return await users.listInboxMessages({
   *      limit: 5,
   *      ascending: true,
   *      status: Status.UNREAD,
   *    })
   * }
   * ```
   */
  async listInboxMessages(
    opts?: InboxListOptions,
  ): Promise<Array<UserMessage>> {
    return listInboxMessages(this, opts)
  }

  /**
   * List the sent messages of the local user
   *
   * @example
   * ```typescript
   * import { Users } from "@textile/hub"
   *
   * async function example(users: Users) {
   *    return await users.listSentboxMessages({
   *      limit: 5,
   *      ascending: true,
   *    })
   * }
   * ```
   */
  async listSentboxMessages(
    opts?: SentboxListOptions,
  ): Promise<Array<UserMessage>> {
    return listSentboxMessages(this, opts)
  }

  /**
   * Mark a message as read
   *
   * @example
   * ```typescript
   * import { Users } from "@textile/hub"
   *
   * async function example(users: Users) {
   *    const res = await users.listInboxMessages({
   *      limit: 1,
   *      ascending: true,
   *    })
   *    if (res.length === 1) users.readInboxMessage(res[0].id)
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
   * async function example(users: Users) {
   *    const res = await users.listInboxMessages({
   *      limit: 1,
   *      ascending: true,
   *    })
   *    if (res.length === 1) users.deleteInboxMessage(res[0].id)
   * }
   * ```
   */
  async deleteInboxMessage(id: string): Promise<void> {
    return deleteInboxMessage(this, id)
  }

  /**
   * Mark a message as read
   *
   * @example
   * ```typescript
   * import { Users } from "@textile/hub"
   *
   * async function example(users: Users) {
   *    const res = await users.listSentboxMessages({
   *      limit: 1,
   *      ascending: true,
   *    })
   *    if (res.length === 1) users.deleteInboxMessage(res[0].id)
   * }
   * ```
   */
  async deleteSentboxMessage(id: string): Promise<void> {
    return deleteSentboxMessage(this, id)
  }

  /**
   * watchInbox watches the inbox for new mailbox events.
   * Returns a listener of watch connectivity states.
   * @returns listener. listener.close will stop watching.
   * @param id the mailbox id
   * @param callback handles each new mailbox event
   *
   * @example
   * Listen and log all new inbox events
   *
   * ```typescript
   * import { Users, MailboxEvent } from '@textile/hub'
   *
   * const callback = async (reply?: MailboxEvent, err?: Error) => {
   *   if (!reply || !reply.message) return console.log('no message')
   *   console.log(reply.type)
   * }
   *
   * async function example (users: Users) {
   *   const mailboxID = await users.getMailboxID()
   *   const closer = await users.watchInbox(mailboxID, callback)
   *   return closer
   * }
   * ```
   *
   * @example
   * Decrypt a new message in local user's inbox sent by listener callback
   *
   * ```typescript
   * import { Users, MailboxEvent, PrivateKey } from '@textile/hub'
   *
   * const userID = PrivateKey.fromRandom()
   *
   * const callback = async (reply?: MailboxEvent, err?: Error) => {
   *   if (!reply || !reply.message) return console.log('no message')
   *   const bodyBytes = await userID.decrypt(reply.message.body)
   *
   *   const decoder = new TextDecoder()
   *   const body = decoder.decode(bodyBytes)
   *
   *   console.log(body)
   * }
   *
   * // Requires userID already be authenticated to the Users API
   * async function startListener(users: Users) {
   *   const mailboxID = await users.getMailboxID()
   *   const closer = await users.watchInbox(mailboxID, callback)
   * }
   * ```
   */

  watchInbox(
    id: string,
    callback: (reply?: MailboxEvent, err?: Error) => void,
  ): grpc.Request {
    return watchMailbox(this, id, 'inbox', callback)
  }
  /**
   * watchSentbox watches the sentbox for new mailbox events.
   * Returns a listener of watch connectivity states.
   * @returns listener. listener.close will stop watching.
   * @param id the mailbox id
   * @param callback handles each new mailbox event.
   *
   * @example
   * The local user's own sentbox can be decrypted with their private key
   *
   * ```typescript
   * import { Users, MailboxEvent, PrivateKey } from '@textile/hub'
   *
   * const userID = PrivateKey.fromRandom()
   *
   * const callback = async (reply?: MailboxEvent, err?: Error) => {
   *   if (!reply || !reply.message) return console.log('no message')
   *   const bodyBytes = await userID.decrypt(reply.message.body)
   *
   *   const decoder = new TextDecoder()
   *   const body = decoder.decode(bodyBytes)
   *
   *   console.log(body)
   * }
   *
   * // Requires userID already be authenticated to the Users API
   * async function startListener(users: Users) {
   *   const mailboxID = await users.getMailboxID()
   *   const closer = await users.watchInbox(mailboxID, callback)
   * }
   * ```
   */
  watchSentbox(
    id: string,
    callback: (reply?: MailboxEvent, err?: Error) => void,
  ): grpc.Request {
    return watchMailbox(this, id, 'sentbox', callback)
  }
}
