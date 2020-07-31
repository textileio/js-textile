import log from 'loglevel'
import {
  SetupMailboxRequest,
  SetupMailboxReply,
  ListThreadsRequest,
  ListThreadsReply,
  GetThreadReply,
  GetThreadRequest,
  SendMessageRequest,
  SendMessageReply,
  ListInboxMessagesRequest,
  ListMessagesReply,
  ListSentboxMessagesRequest,
  ReadInboxMessageRequest,
  ReadInboxMessageReply,
  DeleteMessageRequest,
} from '@textile/users-grpc/users_pb'
import { API } from '@textile/users-grpc/users_pb_service'
import { GrpcConnection } from '@textile/grpc-connection'
import { ContextInterface } from '@textile/context'
import { ThreadID } from '@textile/threads-id'
import { Libp2pCryptoPublicKey } from '@textile/threads-core'

const logger = log.getLogger('users-api')

export enum Status {
  ALL,
  READ,
  UNREAD,
}

export type StatusInt = 0 | 1 | 2

export async function listThreads(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<Array<GetThreadReply.AsObject>> {
  logger.debug('list threads request')
  const req = new ListThreadsRequest()
  const res: ListThreadsReply = await api.unary(API.ListThreads, req, ctx)
  return res.getListList().map((value: GetThreadReply) => {
    const thread = value.toObject()
    thread.id = ThreadID.fromBytes(Buffer.from(thread.id as string, 'base64')).toString()
    return thread
  })
}

export async function getThread(
  api: GrpcConnection,
  name: string,
  ctx?: ContextInterface,
): Promise<GetThreadReply.AsObject> {
  logger.debug('get thread request')
  const req = new GetThreadRequest()
  req.setName(name)
  const res: GetThreadReply = await api.unary(API.GetThread, req, ctx)
  const thread = res.toObject()
  thread.id = ThreadID.fromBytes(Buffer.from(thread.id as string, 'base64')).toString()
  return thread
}

export async function setupMailbox(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<{ mailboxID: Uint8Array | string }> {
  logger.debug('setup mailbox request')
  const req = new SetupMailboxRequest()
  const res: SetupMailboxReply = await api.unary(API.SetupMailbox, req, ctx)
  const mailboxID = res.toObject().mailboxid
  return { mailboxID }
}

export async function sendMessage(
  api: GrpcConnection,
  to: Libp2pCryptoPublicKey,
  toBody: string | Uint8Array,
  toSignature: string | Uint8Array,
  fromBody: string | Uint8Array,
  fromSignature: string | Uint8Array,
  ctx?: ContextInterface,
): Promise<{ id: string; createdAt: number }> {
  logger.debug('send message request')
  const req = new SendMessageRequest()
  req.setTo(to.toString())
  req.setTobody(toBody)
  req.setTosignature(toSignature)
  req.setFrombody(fromBody)
  req.setFromsignature(fromSignature)
  const res: SendMessageReply = await api.unary(API.SendMessage, req, ctx)
  const obj = res.toObject()
  return { id: obj.id, createdAt: obj.createdat }
}

export async function listInboxMessages(
  api: GrpcConnection,
  seek: string,
  limit: number,
  ascending: boolean,
  status: Status | StatusInt,
  ctx?: ContextInterface,
): Promise<ListMessagesReply.AsObject> {
  logger.debug('list inbox message request')
  const req = new ListInboxMessagesRequest()
  req.setSeek(seek)
  req.setLimit(limit)
  req.setAscending(ascending)
  req.setStatus(status)
  const res: ListMessagesReply = await api.unary(API.ListInboxMessages, req, ctx)
  return res.toObject()
}

export async function listSentboxMessages(
  api: GrpcConnection,
  seek: string,
  limit: number,
  ascending: boolean,
  ctx?: ContextInterface,
): Promise<ListMessagesReply.AsObject> {
  logger.debug('list sentbox message request')
  const req = new ListSentboxMessagesRequest()
  req.setSeek(seek)
  req.setLimit(limit)
  req.setAscending(ascending)
  const res: ListMessagesReply = await api.unary(API.ListSentboxMessages, req, ctx)
  return res.toObject()
}

export async function readInboxMessage(
  api: GrpcConnection,
  id: string,
  ctx?: ContextInterface,
): Promise<{ readAt: number }> {
  logger.debug('read inbox message request')
  const req = new ReadInboxMessageRequest()
  req.setId(id)
  const res: ReadInboxMessageReply = await api.unary(API.ReadInboxMessage, req, ctx)
  return { readAt: res.toObject().readat }
}

export async function deleteInboxMessage(api: GrpcConnection, id: string, ctx?: ContextInterface): Promise<{}> {
  logger.debug('delete inbox message request')
  const req = new DeleteMessageRequest()
  req.setId(id)
  return await api.unary(API.DeleteInboxMessage, req, ctx)
}

export async function deleteSentboxMessage(api: GrpcConnection, id: string, ctx?: ContextInterface): Promise<{}> {
  logger.debug('delete sentbox message request')
  const req = new DeleteMessageRequest()
  req.setId(id)
  return await api.unary(API.DeleteSentboxMessage, req, ctx)
}
