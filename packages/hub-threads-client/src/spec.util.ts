import { ContextInterface } from "@textile/context"
import { WebsocketTransport } from "@textile/grpc-transport"
import * as pb from "@textile/hub-grpc/hub_pb"
import { APIClient, ServiceError } from "@textile/hub-grpc/hub_pb_service"
import axios from "axios"
import delay from "delay"
import { HMAC } from "fast-sha256"
import multibase from "multibase"

export const createUsername = (size = 12): string => {
  return Array(size)
    .fill(0)
    .map(() => Math.random().toString(36).charAt(2))
    .join("")
}

export const createEmail = (): string => {
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

export const createKey = (
  ctx: ContextInterface,
  kind: keyof pb.KeyTypeMap
): Promise<pb.GetKeyReply.AsObject> => {
  return new Promise<pb.GetKeyReply.AsObject>((resolve, reject) => {
    const req = new pb.CreateKeyRequest()
    req.setType(pb.KeyType[kind])
    const client = new APIClient(ctx.host, { transport: WebsocketTransport() })
    ctx.toMetadata().then((meta) => {
      return client.createKey(
        req,
        meta,
        (err: ServiceError | null, message: pb.GetKeyReply | null) => {
          if (err) reject(err)
          resolve(message?.toObject())
        }
      )
    })
  })
}

export const signUp = (
  ctx: ContextInterface,
  addrGatewayUrl: string,
  sessionSecret: string
): Promise<{
  user: pb.SignupReply.AsObject | undefined
  username: string
  email: string
}> => {
  const username = createUsername()
  const email = createEmail()
  return new Promise<{
    user: pb.SignupReply.AsObject | undefined
    username: string
    email: string
  }>((resolve, reject) => {
    const req = new pb.SignupRequest()
    req.setEmail(email)
    req.setUsername(username)
    const client = new APIClient(ctx.host, { transport: WebsocketTransport() })
    ctx.toMetadata().then((meta) => {
      client.signup(
        req,
        meta,
        (err: ServiceError | null, message: pb.SignupReply | null) => {
          if (err) reject(err)
          resolve({ user: message?.toObject(), username, email })
        }
      )
      confirmEmail(addrGatewayUrl, sessionSecret).catch((err) => reject(err))
    })
  })
}

export const createAPISig = async (
  secret: string,
  date: Date = new Date(Date.now() + 1000 * 60)
): Promise<{
  sig: string
  msg: string
}> => {
  const sec = multibase.decode(secret)
  const msg = (date ?? new Date()).toISOString()
  const hash = new HMAC(sec)
  const mac = hash.update(Buffer.from(msg)).digest()
  const sig = multibase.encode("base32", Buffer.from(mac)).toString()
  return { sig, msg }
}
