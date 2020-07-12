import log from 'loglevel'
import { GetThreadReply, ListThreadsReply, GetThreadRequest, ListThreadsRequest } from '@textile/users-grpc/users_pb'
import { APIClient } from '@textile/users-grpc/users_pb_service'
import { ServiceError } from '@textile/hub-grpc/hub_pb_service'
import { Client } from '@textile/threads-client'
import { ThreadID } from '@textile/threads-id'
import { UserAuth, KeyInfo } from '@textile/security'
import { Context } from '@textile/context'

const logger = log.getLogger('users')

declare module '@textile/threads-client' {
  interface Client {
    getThread(name: string, ctx?: Context): Promise<GetThreadReply.AsObject>
    listThreads(ctx?: Context): Promise<ListThreadsReply.AsObject>
  }
}

Client.prototype.getThread = async function (name: string, ctx?: Context): Promise<GetThreadReply.AsObject> {
  logger.debug('get thread request')
  const client = new APIClient(this.serviceHost, {
    transport: this.rpcOptions.transport,
    debug: this.rpcOptions.debug,
  })
  return new Promise<GetThreadReply.AsObject>((resolve, reject) => {
    const req = new GetThreadRequest()
    req.setName(name)
    this.context
      .toMetadata(ctx)
      .then((meta) => {
        client.getThread(req, meta, (err: ServiceError | null, message: GetThreadReply | null) => {
          if (err) reject(err)
          const msg = message?.toObject()
          if (msg) {
            msg.id = ThreadID.fromBytes(Buffer.from(msg.id as string, 'base64')).toString()
          }
          resolve(msg)
        })
      })
      .catch((err: Error) => {
        reject(err)
      })
  })
}

/**
 * Returns a list of available Threads.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal credentials.
 * @note Threads can be created using the threads or threads network clients.
 */
Client.prototype.listThreads = async function (ctx?: Context): Promise<ListThreadsReply.AsObject> {
  logger.debug('list threads request')
  const client = new APIClient(this.serviceHost, {
    transport: this.rpcOptions.transport,
    debug: this.rpcOptions.debug,
  })
  return new Promise<ListThreadsReply.AsObject>((resolve, reject) => {
    const req = new ListThreadsRequest()
    this.context
      .toMetadata(ctx)
      .then((meta) => {
        client.listThreads(req, meta, (err: ServiceError | null, message: ListThreadsReply | null) => {
          if (err) reject(err)
          const msg = message?.toObject()
          if (msg) {
            msg.listList.forEach((thread) => {
              thread.id = ThreadID.fromBytes(Buffer.from(thread.id as string, 'base64')).toString()
            })
          }
          resolve(msg)
        })
      })
      .catch((err: Error) => {
        reject(err)
      })
  })
}

/**
 * Clients is a web-gRPC wrapper client for communicating with the web-gRPC enabled Threads API.
 */
export { Client, UserAuth, KeyInfo }
