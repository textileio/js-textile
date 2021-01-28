/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ContextInterface } from '@textile/context'
import { WebsocketTransport } from '@textile/grpc-transport'
import * as pb from '@textile/hub-grpc/api/hubd/pb/hubd_pb'
import {
  APIServiceClient,
  ServiceError,
} from '@textile/hub-grpc/api/hubd/pb/hubd_pb_service'
import axios from 'axios'
import { createUsername } from '@textile/testing'

const delay = (time: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, time))

export const createEmail = () => {
  return `${createUsername()}@doe.com`
}

export const confirmEmail = async (gurl: string, secret: string) => {
  await delay(500)
  const resp = await axios.get(`${gurl}/confirm/${secret}`)
  if (resp.status !== 200) {
    throw new Error(resp.statusText)
  }
  return true
}

export const createKey = (ctx: ContextInterface, kind: keyof pb.KeyTypeMap) => {
  return new Promise<pb.CreateKeyResponse.AsObject>((resolve, reject) => {
    const req = new pb.CreateKeyRequest()
    req.setType(pb.KeyType[kind])
    const client = new APIServiceClient(ctx.host, {
      transport: WebsocketTransport(),
    })
    ctx.toMetadata().then((meta) => {
      return client.createKey(
        req,
        meta,
        (err: ServiceError | null, message: pb.CreateKeyResponse | null) => {
          if (err) reject(err)
          resolve(message?.toObject())
        },
      )
    })
  })
}

export const signUp = (
  ctx: ContextInterface,
  addrGatewayUrl: string,
  sessionSecret: string,
) => {
  const username = createUsername()
  const email = createEmail()
  return new Promise<{
    user: pb.SignupResponse.AsObject | undefined
    username: string
    email: string
  }>((resolve, reject) => {
    const req = new pb.SignupRequest()
    req.setEmail(email)
    req.setUsername(username)
    const client = new APIServiceClient(ctx.host, {
      transport: WebsocketTransport(),
    })
    ctx.toMetadata().then((meta) => {
      client.signup(
        req,
        meta,
        (err: ServiceError | null, message: pb.SignupResponse | null) => {
          if (err) reject(err)
          resolve({ user: message?.toObject(), username, email })
        },
      )
      confirmEmail(addrGatewayUrl, sessionSecret).catch((err) => reject(err))
    })
  })
}
