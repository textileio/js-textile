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
import { API, ServiceError } from '@textile/users-grpc/users_pb_service'
// import { APIClient } from '@textile/users-grpc/users_pb_service'
// import CID from 'cids'
// import { EventIterator } from 'event-iterator'
// import nextTick from 'next-tick'
import { grpc } from '@improbable-eng/grpc-web'
import { ContextInterface, Context } from '@textile/context'
import { WebsocketTransport } from '@textile/grpc-transport'
import { ThreadID } from '@textile/threads-id'
import { Libp2pCryptoPublicKey } from '@textile/threads-core'

const logger = log.getLogger('users-api')

export enum Status {
  ALL,
  READ,
  UNREAD,
}

export type StatusInt = 0 | 1 | 2

export class UsersGrpcClient {
  public serviceHost: string
  public rpcOptions: grpc.RpcOptions
  /**
   * Creates a new gRPC client instance for accessing the Textile Buckets API.
   * @param context The context to use for interacting with the APIs. Can be modified later.
   */
  constructor(public context: ContextInterface = new Context(), debug = false) {
    this.serviceHost = context.host
    this.rpcOptions = {
      transport: WebsocketTransport(),
      debug,
    }
  }

  public unary<
    R extends grpc.ProtobufMessage,
    T extends grpc.ProtobufMessage,
    M extends grpc.UnaryMethodDefinition<R, T>
  >(methodDescriptor: M, req: R, ctx?: ContextInterface): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const metadata = { ...this.context.toJSON(), ...ctx?.toJSON() }
      grpc.unary(methodDescriptor, {
        request: req,
        host: this.serviceHost,
        transport: this.rpcOptions.transport,
        debug: this.rpcOptions.debug,
        metadata,
        onEnd: (res: grpc.UnaryOutput<T>) => {
          const { status, statusMessage, message } = res
          if (status === grpc.Code.OK) {
            if (message) {
              resolve(message)
            } else {
              resolve()
            }
          } else {
            const err: ServiceError = {
              message: statusMessage,
              code: status,
              metadata,
            }
            reject(err)
          }
        },
      })
    })
  }
}

export async function listThreads(
  api: UsersGrpcClient,
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
  api: UsersGrpcClient,
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
  api: UsersGrpcClient,
  ctx?: ContextInterface,
): Promise<{ mailboxID: Uint8Array | string }> {
  logger.debug('setup mailbox request')
  const req = new SetupMailboxRequest()
  const res: SetupMailboxReply = await api.unary(API.SetupMailbox, req, ctx)
  const mailboxID = res.toObject().mailboxid
  return { mailboxID }
}

export async function sendMessage(
  api: UsersGrpcClient,
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
  api: UsersGrpcClient,
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
  api: UsersGrpcClient,
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
  api: UsersGrpcClient,
  id: string,
  ctx?: ContextInterface,
): Promise<{ readAt: number }> {
  logger.debug('read inbox message request')
  const req = new ReadInboxMessageRequest()
  req.setId(id)
  const res: ReadInboxMessageReply = await api.unary(API.ReadInboxMessage, req, ctx)
  return { readAt: res.toObject().readat }
}

export async function deleteInboxMessage(api: UsersGrpcClient, id: string, ctx?: ContextInterface): Promise<{}> {
  logger.debug('delete inbox message request')
  const req = new DeleteMessageRequest()
  req.setId(id)
  return await api.unary(API.DeleteInboxMessage, req, ctx)
}

export async function deleteSentboxMessage(api: UsersGrpcClient, id: string, ctx?: ContextInterface): Promise<{}> {
  logger.debug('delete sentbox message request')
  const req = new DeleteMessageRequest()
  req.setId(id)
  return await api.unary(API.DeleteSentboxMessage, req, ctx)
}
