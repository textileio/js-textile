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

interface GetThreadResponse {
  id: string
  name?: string
}

declare module '@textile/threads-client' {
  interface Client {
    getThread(name: string, ctx?: Context): Promise<GetThreadResponse>
    listThreads(ctx?: Context): Promise<Array<GetThreadResponse>>
  }
}

Client.prototype.getThread = async function (
  name: string,
  ctx?: Context,
): Promise<GetThreadResponse> {
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
        client.getThread(
          req,
          meta,
          (err: ServiceError | null, message: _GetThreadResponse | null) => {
            if (err) reject(err)
            if (message) {
              const res = {
                name: message.getName(),
                id: ThreadID.fromBytes(message.getId_asU8()).toString(),
              }
              resolve(res)
            } else {
              reject(new Error('No result'))
            }
          },
        )
      })
      .catch((err: Error) => {
        reject(err)
      })
  })
}

// Private listDBs method
const oldListDBs = Client.prototype.listDBs

/**
 * Lists all known DBs.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
Client.prototype.listDBs = async function (
  ctx?: Context,
): Promise<Record<string, GetThreadResponse | undefined>> {
  const dbs: Record<string, GetThreadResponse | undefined> = {}
  if (this.context.withContext(ctx).get('x-textile-api-sig')) {
    // We're probably on the Hub
    const threads = await this.listThreads(ctx)
    for (const thread of threads) {
      dbs[thread.id] = thread
    }
    return dbs
  }
  const threads = await oldListDBs.bind(this)()
  for (const [id, db] of Object.entries(threads)) {
    dbs[id] = { id, name: db?.name }
  }
  return dbs
}

/**
 * Returns a list of available Threads.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal credentials.
 * @note Threads can be created using the threads or threads network clients.
 */
Client.prototype.listThreads = async function (
  ctx?: Context,
): Promise<Array<GetThreadResponse>> {
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
        client.listThreads(
          req,
          meta,
          (err: ServiceError | null, message: _ListThreadsResponse | null) => {
            if (err) return reject(err)
            const lst = message?.getListList()
            let results: GetThreadResponse[] = []
            if (!lst) return resolve(results)
            results = lst.map((thrd: _GetThreadResponse) => {
              return {
                name: thrd.getName(),
                id: ThreadID.fromBytes(thrd.getId_asU8()).toString(),
              }
            })
            return resolve(results)
          },
        )
      })
      .catch((err: Error) => {
        return reject(err)
      })
  })
}

/**
 * Clients is a web-gRPC wrapper client for communicating with the web-gRPC enabled Threads API.
 */
export { Client, GetThreadResponse, KeyInfo, UserAuth }
