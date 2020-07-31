import log from 'loglevel'
import { GrpcAuthentication } from '@textile/grpc-authentication'
import { Libp2pCryptoIdentity, Libp2pCryptoPublicKey } from '@textile/threads-core'
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

const logger = log.getLogger('users')

export class Users extends GrpcAuthentication {
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
