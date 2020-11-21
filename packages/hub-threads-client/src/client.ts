import log from 'loglevel'
import {
  GetThreadResponse,
  ListThreadsResponse,
  GetThreadRequest,
  ListThreadsRequest,
} from '@textile/users-grpc/api/usersd/pb/usersd_pb'
import { APIServiceClient } from '@textile/users-grpc/api/usersd/pb/usersd_pb_service'
import { ServiceError } from '@textile/hub-grpc/api/hubd/pb/hubd_pb_service'
import { Client } from '@textile/threads-client'
import { ThreadID } from '@textile/threads-id'
import { UserAuth, KeyInfo } from '@textile/security'
import { Context } from '@textile/context'

const logger = log.getLogger('users')

declare module '@textile/threads-client' {
  interface Client {
    getThread(name: string, ctx?: Context): Promise<GetThreadResponse.AsObject>
    listThreads(ctx?: Context): Promise<ListThreadsResponse.AsObject>
  }
}

Client.prototype.getThread = async function (name: string, ctx?: Context): Promise<GetThreadResponse.AsObject> {
  logger.debug('get thread request')
  const client = new APIServiceClient(this.serviceHost, {
    transport: this.rpcOptions.transport,
    debug: this.rpcOptions.debug,
  })
  return new Promise<GetThreadResponse.AsObject>((resolve, reject) => {
    const req = new GetThreadRequest()
    req.setName(name)
    this.context
      .toMetadata(ctx)
      .then((meta) => {
        client.getThread(req, meta, (err: ServiceError | null, message: GetThreadResponse | null) => {
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
Client.prototype.listThreads = async function (ctx?: Context): Promise<ListThreadsResponse.AsObject> {
  logger.debug('list threads request')
  const client = new APIServiceClient(this.serviceHost, {
    transport: this.rpcOptions.transport,
    debug: this.rpcOptions.debug,
  })
  return new Promise<ListThreadsResponse.AsObject>((resolve, reject) => {
    const req = new ListThreadsRequest()
    this.context
      .toMetadata(ctx)
      .then((meta) => {
        client.listThreads(req, meta, (err: ServiceError | null, message: ListThreadsResponse | null) => {
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
