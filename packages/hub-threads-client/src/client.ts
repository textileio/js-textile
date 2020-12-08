import { Context } from '@textile/context'
import { ServiceError } from '@textile/hub-grpc/api/hubd/pb/hubd_pb_service'
import { KeyInfo, UserAuth } from '@textile/security'
import { Client } from '@textile/threads-client'
import { ThreadID } from '@textile/threads-id'
import {
  GetThreadRequest,
  GetThreadResponse as _GetThreadResponse,
  ListThreadsRequest,
  ListThreadsResponse as _ListThreadsResponse,
} from '@textile/users-grpc/api/usersd/pb/usersd_pb'
import { APIServiceClient } from '@textile/users-grpc/api/usersd/pb/usersd_pb_service'
import log from 'loglevel'

const logger = log.getLogger('users')

export interface GetThreadResponse {
    id: string,
    name: string,
    isDb: boolean,
}

declare module '@textile/threads-client' {
  interface Client {
    getThread(name: string, ctx?: Context): Promise<GetThreadResponse>
    listThreads(ctx?: Context): Promise<Array<GetThreadResponse>>
  }
}

Client.prototype.getThread = async function (name: string, ctx?: Context): Promise<GetThreadResponse> {
  logger.debug('get thread request')
  const client = new APIServiceClient(this.serviceHost, {
    transport: this.rpcOptions.transport,
    debug: this.rpcOptions.debug,
  })
  return new Promise<GetThreadResponse>((resolve, reject) => {
    const req = new GetThreadRequest()
    req.setName(name)
    this.context
      .toMetadata(ctx)
      .then((meta) => {
        client.getThread(req, meta, (err: ServiceError | null, message: _GetThreadResponse | null) => {
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
Client.prototype.listThreads = async function (ctx?: Context): Promise<Array<GetThreadResponse>> {
  logger.debug('list threads request')
  const client = new APIServiceClient(this.serviceHost, {
    transport: this.rpcOptions.transport,
    debug: this.rpcOptions.debug,
  })
  return new Promise<Array<GetThreadResponse>>((resolve, reject) => {
    const req = new ListThreadsRequest()
    this.context
      .toMetadata(ctx)
      .then((meta) => {
        client.listThreads(req, meta, (err: ServiceError | null, message: _ListThreadsResponse | null) => {
          if (err) reject(err)
          const lst = message?.getListList()
          const results = []
          if (lst) {
            for (const thrd of lst) {
              const res = {
                name: thrd.getName(),
                isDb: thrd.getIsDb(),
                id: ThreadID.fromBytes(thrd.getId_asU8()).toString(),
              }
              results.push(res)
            }
          }
          resolve(results)
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
