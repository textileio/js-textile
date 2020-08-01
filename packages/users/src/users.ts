import log from 'loglevel'
import { GrpcAuthentication } from '@textile/grpc-authentication'
import { encrypt, Identity, privateKeyFromString } from '@textile/crypto'
import { GetThreadReply, ListMessagesReply } from '@textile/users-grpc/users_pb'
import {
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
import { publicKeyBytesFromString } from '@textile/crypto/dist/utils'

const logger = log.getLogger('users')

export class Users extends GrpcAuthentication {
  /**
   * Use the Buckets APIs with the sessions already created when using
   * other API classes, such as Users.
   *
   * @example
   * ```typescript
   * import { Buckets, Users } from "@textile/hub"
   *
   * function transferAuth(buckets: Buckets): Users {
   *   const user = Users.withAuth(buckets)
   *   return user
   * }
   */
  withAuth(auth: GrpcAuthentication) {
    logger.debug('init from grpc-auth')
    return new Users(auth.context)
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

  async sendMessage(from: Identity, to: string, body: Uint8Array): Promise<{ id: string; createdAt: number }> {
    logger.debug('send message using keys')
    const toBytes = publicKeyBytesFromString(to)
    const fromBody = await encrypt(body, from.public.bytes)
    const fromSig = await from.sign(fromBody)
    const toBody = await encrypt(body, toBytes)
    const toSig = await from.sign(toBody)
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
