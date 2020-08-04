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
  Message,
} from '@textile/users-grpc/users_pb'
import { API } from '@textile/users-grpc/users_pb_service'
import { GrpcConnection } from '@textile/grpc-connection'
import { ContextInterface } from '@textile/context'
import { ThreadID } from '@textile/threads-id'

const logger = log.getLogger('users-api')

export enum Status {
  ALL,
  READ,
  UNREAD,
}

export type StatusInt = 0 | 1 | 2

export interface SentboxListOptions {
  seek?: string
  limit?: number
  ascending?: boolean
}

export interface InboxListOptions {
  seek?: string
  limit?: number
  ascending?: boolean
  status?: Status | StatusInt
}

export interface GetThreadReplyObj {
  isDB: boolean
  name: string
  id: string
}

export interface UserMessage {
  id: string
  to: string
  from: string
  body: Uint8Array
  signature: Uint8Array
  createdAt: number
  readAt?: number
}

function convertMessageObj(input: Message): UserMessage {
  return {
    body: input.getBody_asU8(),
    signature: input.getSignature_asU8(),
    from: input.getFrom(),
    id: input.getId(),
    to: input.getTo(),
    createdAt: input.getCreatedat(),
    readAt: input.getReadat(),
  }
}

export async function listThreads(api: GrpcConnection, ctx?: ContextInterface): Promise<Array<GetThreadReplyObj>> {
  logger.debug('list threads request')
  const req = new ListThreadsRequest()
  const res: ListThreadsReply = await api.unary(API.ListThreads, req, ctx)
  return res.getListList().map((value: GetThreadReply) => {
    const thread = value.toObject()
    const res = {
      isDB: thread.isdb,
      name: thread.name,
      id: ThreadID.fromBytes(Buffer.from(thread.id as string, 'base64')).toString(),
    }
    return res
  })
}

export async function getThread(api: GrpcConnection, name: string, ctx?: ContextInterface): Promise<GetThreadReplyObj> {
  logger.debug('get thread request')
  const req = new GetThreadRequest()
  req.setName(name)
  const res: GetThreadReply = await api.unary(API.GetThread, req, ctx)
  const thread = res.toObject()
  return {
    isDB: thread.isdb,
    name: thread.name,
    id: ThreadID.fromBytes(Buffer.from(thread.id as string, 'base64')).toString(),
  }
}

export async function setupMailbox(api: GrpcConnection, ctx?: ContextInterface): Promise<{ mailboxID: Uint8Array }> {
  logger.debug('setup mailbox request')
  const req = new SetupMailboxRequest()
  const res: SetupMailboxReply = await api.unary(API.SetupMailbox, req, ctx)
  const mailboxID = res.getMailboxid_asU8()
  return { mailboxID }
}

export async function sendMessage(
  api: GrpcConnection,
  from: string,
  to: string,
  toBody: Uint8Array,
  toSignature: Uint8Array,
  fromBody: Uint8Array,
  fromSignature: Uint8Array,
  ctx?: ContextInterface,
): Promise<UserMessage> {
  logger.debug('send message request')
  const req = new SendMessageRequest()
  req.setTo(to)
  req.setTobody(toBody)
  req.setTosignature(toSignature)
  req.setFrombody(fromBody)
  req.setFromsignature(fromSignature)
  const res: SendMessageReply = await api.unary(API.SendMessage, req, ctx)
  return {
    id: res.getId(),
    createdAt: res.getCreatedat(),
    body: fromBody,
    signature: fromSignature,
    to,
    from,
  }
}

export async function listInboxMessages(
  api: GrpcConnection,
  opts?: InboxListOptions,
  ctx?: ContextInterface,
): Promise<Array<UserMessage>> {
  logger.debug('list inbox message request')
  const req = new ListInboxMessagesRequest()
  if (opts && opts.seek) req.setSeek(opts.seek)
  if (opts && opts.limit) req.setLimit(opts.limit)
  if (opts && opts.ascending) req.setAscending(opts.ascending)
  if (opts && opts.status) req.setStatus(opts.status)
  const res: ListMessagesReply = await api.unary(API.ListInboxMessages, req, ctx)
  return res.getMessagesList().map(convertMessageObj)
}

export async function listSentboxMessages(
  api: GrpcConnection,
  opts?: SentboxListOptions,
  ctx?: ContextInterface,
): Promise<Array<UserMessage>> {
  logger.debug('list sentbox message request')
  const req = new ListSentboxMessagesRequest()
  if (opts && opts.seek) req.setSeek(opts.seek)
  if (opts && opts.limit) req.setLimit(opts.limit)
  if (opts && opts.ascending) req.setAscending(opts.ascending)
  const res: ListMessagesReply = await api.unary(API.ListSentboxMessages, req, ctx)
  return res.getMessagesList().map(convertMessageObj)
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
