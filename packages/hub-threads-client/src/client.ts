import { Context } from '@textile/context'
import { ServiceError } from '@textile/hub-grpc/api/hubd/pb/hubd_pb_service'
import { KeyInfo, UserAuth } from '@textile/security'
import { Client } from '@textile/threads-client'
import { ThreadID } from '@textile/threads-id'
import {
  GetThreadRequest,
  GetThreadResponse,
  ListThreadsRequest,
  ListThreadsResponse,
} from '@textile/users-grpc/api/usersd/pb/usersd_pb'
import { APIServiceClient } from '@textile/users-grpc/api/usersd/pb/usersd_pb_service'
import log from 'loglevel'

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
          if (message) {
            const res = {
              name: message.getName(),
              isDb: message.getIsDb(),
              id: ThreadID.fromBytes(message.getId_asU8()).toString(),
            }
            resolve(res)
          } else {
            reject(new Error('No result'))
          }
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
          const lst = message?.getListList()
          const listList = []
          if (lst) {
            for (const thrd of lst) {
              const row = thrd.toObject()
              listList.push({ ...row, id: ThreadID.fromBytes(thrd.getId_asU8()).toString() })
            }
          }
          resolve({ listList })
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
