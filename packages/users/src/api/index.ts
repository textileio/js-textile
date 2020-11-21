import log from 'loglevel'
import { grpc } from '@improbable-eng/grpc-web'
import {
  SetupMailboxRequest,
  SetupMailboxResponse,
  ListThreadsRequest,
  ListThreadsResponse,
  GetThreadResponse,
  GetThreadRequest,
  SendMessageRequest,
  SendMessageResponse,
  ListInboxMessagesRequest,
  ListInboxMessagesResponse,
  ListSentboxMessagesRequest,
  ListSentboxMessagesResponse,
  ReadInboxMessageRequest,
  ReadInboxMessageResponse,
  DeleteInboxMessageRequest,
  DeleteSentboxMessageRequest,
  Message,
} from '@textile/users-grpc-internal/api/usersd/pb/usersd_pb'
import { APIService } from '@textile/users-grpc-internal/api/usersd/pb/usersd_pb_service'
import { GrpcConnection } from '@textile/grpc-connection'
import { ContextInterface } from '@textile/context'
import { Client, Update } from '@textile/hub-threads-client'
import { ThreadID } from '@textile/threads-id'

const logger = log.getLogger('users-api')

/**
 * Global settings for mailboxes
 */
export const MailConfig = {
  ThreadName: 'hubmail',
  InboxCollectionName: 'inbox',
  SentboxCollectionName: 'sentbox',
}

/**
 * The status query filter of an inbox message.
 */
export enum Status {
  ALL,
  READ,
  UNREAD,
}

/**
 * Sentbox query options
 */
export interface SentboxListOptions {
  seek?: string
  limit?: number
  ascending?: boolean
}

/**
 * Inbox query options
 */
export interface InboxListOptions {
  seek?: string
  limit?: number
  ascending?: boolean
  status?: Status
}

/**
 * The response type from getThread and listThreads
 */
export interface GetThreadResponseObj {
  isDB: boolean
  name: string
  id: ThreadID
}

/**
 * The message format returned from inbox or sentbox
 */
export interface UserMessage {
  id: string
  to: string
  from: string
  body: Uint8Array
  signature: Uint8Array
  createdAt: number
  readAt?: number
}

/**
 * The mailbox event type. CREATE, SAVE, or DELETE
 */
export enum MailboxEventType {
  CREATE,
  SAVE,
  DELETE,
}

/**
 * The event type returned from inbox and sentbox subscriptions
 */
export interface MailboxEvent {
  type: MailboxEventType
  messageID: string
  message?: UserMessage
}

interface IntermediateMessage {
  _id: string
  from: string
  to: string
  body: string
  signature: string
  created_at: number
  read_at: number
}

function convertMessageObj(input: Message): UserMessage {
  return {
    body: input.getBody_asU8(),
    signature: input.getSignature_asU8(),
    from: input.getFrom(),
    id: input.getId(),
    to: input.getTo(),
    createdAt: input.getCreatedAt(),
    readAt: input.getReadAt(),
  }
}

/**
 * @internal
 */
export async function listThreads(api: GrpcConnection, ctx?: ContextInterface): Promise<Array<GetThreadResponseObj>> {
  logger.debug('list threads request')
  const req = new ListThreadsRequest()
  const res: ListThreadsResponse = await api.unary(APIService.ListThreads, req, ctx)
  return res.getListList().map((value: GetThreadResponse) => {
    const thread = value.toObject()
    const res = {
      isDB: thread.isDb,
      name: thread.name,
      id: ThreadID.fromBytes(Buffer.from(thread.id as string, 'base64')),
    }
    return res
  })
}

/**
 * @internal
 */
export async function getThread(
  api: GrpcConnection,
  name: string,
  ctx?: ContextInterface,
): Promise<GetThreadResponseObj> {
  logger.debug('get thread request')
  const req = new GetThreadRequest()
  req.setName(name)
  const res: GetThreadResponse = await api.unary(APIService.GetThread, req, ctx)
  const thread = res.toObject()
  return {
    isDB: thread.isDb,
    name: thread.name,
    id: ThreadID.fromBytes(Buffer.from(thread.id as string, 'base64')),
  }
}

/**
 * @internal
 */
export async function setupMailbox(api: GrpcConnection, ctx?: ContextInterface): Promise<string> {
  logger.debug('setup mailbox request')
  const req = new SetupMailboxRequest()
  const res: SetupMailboxResponse = await api.unary(APIService.SetupMailbox, req, ctx)
  const mailboxID = ThreadID.fromBytes(Buffer.from(res.getMailboxId_asB64() as string, 'base64'))
  return mailboxID.toString()
}

/**
 * @internal
 */
export async function getMailboxID(api: GrpcConnection, ctx?: ContextInterface): Promise<string> {
  logger.debug('setup mailbox request')
  const thread = await getThread(api, MailConfig.ThreadName, ctx)
  return thread.id.toString()
}

/**
 * @internal
 */
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
  req.setToBody(toBody)
  req.setToSignature(toSignature)
  req.setFromBody(fromBody)
  req.setFromSignature(fromSignature)
  const res: SendMessageResponse = await api.unary(APIService.SendMessage, req, ctx)
  return {
    id: res.getId(),
    createdAt: res.getCreatedAt(),
    body: fromBody,
    signature: fromSignature,
    to,
    from,
  }
}

/**
 * @internal
 */
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
  if (opts && opts.status) {
    switch (opts.status) {
      case Status.READ:
        req.setStatus(ListInboxMessagesRequest.Status.STATUS_READ)
      case Status.UNREAD:
        req.setStatus(ListInboxMessagesRequest.Status.STATUS_UNREAD)
    }
  }
  const res: ListInboxMessagesResponse = await api.unary(APIService.ListInboxMessages, req, ctx)
  return res.getMessagesList().map(convertMessageObj)
}

/**
 * @internal
 */
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
  const res: ListSentboxMessagesResponse = await api.unary(APIService.ListSentboxMessages, req, ctx)
  return res.getMessagesList().map(convertMessageObj)
}

/**
 * @internal
 */
export async function readInboxMessage(
  api: GrpcConnection,
  id: string,
  ctx?: ContextInterface,
): Promise<{ readAt: number }> {
  logger.debug('read inbox message request')
  const req = new ReadInboxMessageRequest()
  req.setId(id)
  const res: ReadInboxMessageResponse = await api.unary(APIService.ReadInboxMessage, req, ctx)
  return { readAt: res.toObject().readAt }
}

/**
 * @internal
 */
export async function deleteInboxMessage(api: GrpcConnection, id: string, ctx?: ContextInterface) {
  logger.debug('delete inbox message request')
  const req = new DeleteInboxMessageRequest()
  req.setId(id)
  await api.unary(APIService.DeleteInboxMessage, req, ctx)
  return
}

/**
 * @internal
 */
export async function deleteSentboxMessage(api: GrpcConnection, id: string, ctx?: ContextInterface) {
  logger.debug('delete sentbox message request')
  const req = new DeleteSentboxMessageRequest()
  req.setId(id)
  await api.unary(APIService.DeleteSentboxMessage, req, ctx)
  return
}

/**
 * @internal
 */
export function watchMailbox(
  api: GrpcConnection,
  id: string,
  box: 'inbox' | 'sentbox',
  callback: (reply?: MailboxEvent, err?: Error) => void,
  ctx?: ContextInterface,
): grpc.Request {
  logger.debug('new watch inbox request')
  const client = new Client(ctx || api.context)
  const threadID = ThreadID.fromString(id)
  const retype = (reply?: Update<IntermediateMessage>, err?: Error) => {
    if (!reply) {
      callback(reply, err)
    } else {
      const type = reply.action as number
      const result: MailboxEvent = {
        type,
        messageID: reply.instanceID,
      }
      const instance = reply.instance
      if (instance) {
        result.message = {
          id: reply.instanceID,
          from: instance.from,
          to: instance.to,
          body: new Uint8Array(Buffer.from(instance.body, 'base64')),
          signature: new Uint8Array(Buffer.from(instance.signature, 'base64')),
          createdAt: instance.created_at,
          readAt: instance.read_at,
        }
      }
      callback(result)
    }
  }
  const collectionName = box === 'inbox' ? MailConfig.InboxCollectionName : MailConfig.SentboxCollectionName
  return client.listen<IntermediateMessage>(threadID, [{ collectionName }], retype)
}
