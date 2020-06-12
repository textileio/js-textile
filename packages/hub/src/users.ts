import log from 'loglevel'
import * as pb from '@textile/users-grpc/users_pb'
import { APIClient } from '@textile/users-grpc/users_pb_service'
import { ServiceError } from '@textile/hub-grpc/hub_pb_service'
import { Context } from '@textile/context'
import { UserAuth, KeyInfo } from '@textile/security'
import { Client } from '@textile/threads-client'
import { ThreadID } from '@textile/threads-id'

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
    client.getThread(
      req,
      this.context.withContext(ctx).toMetadata(),
      (err: ServiceError | null, message: pb.GetThreadReply | null) => {
        if (err) reject(err)
        const msg = message?.toObject()
        if (msg) {
          msg.id = ThreadID.fromBytes(Buffer.from(msg.id as string, 'base64')).toString()
        }
        resolve(msg)
      },
    )
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
    client.listThreads(
      req,
      this.context.withContext(ctx).toMetadata(),
      (err: ServiceError | null, message: pb.ListThreadsReply | null) => {
        if (err) reject(err)
        const msg = message?.toObject()
        if (msg) {
          msg.listList.forEach((thread) => {
            thread.id = ThreadID.fromBytes(Buffer.from(thread.id as string, 'base64')).toString()
          })
        }
        resolve(msg)
      },
    )
  })
}

/**
 * Clients is a web-gRPC wrapper client for communicating with the web-gRPC enabled Threads API.
 */
export { Client, UserAuth, KeyInfo }
