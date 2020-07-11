import log from 'loglevel'
import * as pb from '@textile/users-grpc/users_pb'
import { APIClient } from '@textile/users-grpc/users_pb_service'
import { ServiceError } from '@textile/hub-grpc/hub_pb_service'
import { Client } from '@textile/threads-client'
import { ThreadID } from '@textile/threads-id'
import type { Context } from '@textile/context'
import type { UserAuth, KeyInfo } from '@textile/security'

const logger = log.getLogger('users')

declare module '@textile/threads-client' {
  interface Client {
    getThread(name: string, ctx?: Context): Promise<pb.GetThreadReply.AsObject>
    listThreads(ctx?: Context): Promise<pb.ListThreadsReply.AsObject>
  }
}

Client.prototype.getThread = async function (name: string, ctx?: Context) {
  logger.debug('get thread request')
  const client = new APIClient(this.serviceHost, {
    transport: this.rpcOptions.transport,
    debug: this.rpcOptions.debug,
  })
  return new Promise<pb.GetThreadReply.AsObject>((resolve, reject) => {
    const req = new pb.GetThreadRequest()
    req.setName(name)
    this.context
      .toMetadata(ctx)
      .then((meta) => {
        client.getThread(req, meta, (err: ServiceError | null, message: pb.GetThreadReply | null) => {
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
Client.prototype.listThreads = async function (ctx?: Context) {
  logger.debug('list threads request')
  const client = new APIClient(this.serviceHost, {
    transport: this.rpcOptions.transport,
    debug: this.rpcOptions.debug,
  })
  return new Promise<pb.ListThreadsReply.AsObject>((resolve, reject) => {
    const req = new pb.ListThreadsRequest()
    this.context
      .toMetadata(ctx)
      .then((meta) => {
        client.listThreads(req, meta, (err: ServiceError | null, message: pb.ListThreadsReply | null) => {
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
