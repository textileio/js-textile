import { grpc } from '@improbable-eng/grpc-web'
import { ThreadID } from '@textile/threads-id'
import { HMAC } from 'fast-sha256'
import multibase from 'multibase'

type HostString =
  | 'https://api.textile.io:3447'
  | 'https://api.staging.textile.io:3447'
  | 'http://127.0.0.1:3007'
  | string
export const defaultHost: HostString = 'https://api.textile.io:3447'

type KeyInfo = {
  key: string
  secret: string
  // ACCOUNT, USER
  type: 0 | 1
}

export const createAPISig = async (
  secret: string,
  date: Date = new Date(Date.now() + 1000 * 60),
) => {
  const sec = multibase.decode(secret)
  const msg = (date ?? new Date()).toISOString()
  const hash = new HMAC(sec)
  const mac = hash.update(Buffer.from(msg)).digest()
  const sig = multibase.encode('base32', Buffer.from(mac)).toString()
  return { sig, msg }
}

export interface ContextKeys {
  /**
   * Thread name. Specifies a mapping between human-readable name and a Thread ID.
   */
  ['x-textile-thread-name']?: string
  /**
   * Thread ID as a string. Should be generated with `ThreadID.toString()` method.
   */
  ['x-textile-thread']?: string
  /**
   * Session key. Used for various session contexts.
   */
  ['x-textile-session']?: string

  /**
   * Org slug/name. Used for various org session operations.
   */
  ['x-textile-org']?: string

  /**
   * API key. Used for user authentication.
   */
  ['x-textile-api-key']?: string

  /**
   * Authorization token for interacting with remote APIs.
   */
  authorization?: string

  /**
   * API signature used to authenticate with remote APIs.
   */
  ['x-textile-api-sig']?: string

  /**
   * Raw message (date as ISO string) used to generate API signature.
   */
  ['x-textile-api-sig-msg']?: string

  /**
   * The service host address/url. Defaults to https://hub.textile.io.
   */
  host?: HostString
  /**
   * The transport to use for gRPC calls. Defaults to web-sockets.
   */
  transport?: grpc.TransportFactory

  /**
   * Whether to enable debugging output during gRPC calls.
   */
  debug?: boolean

  /**
   * Extras
   */
  [key: string]: any
}

/**
 * Context provides context management for gRPC credentials and config settings.
 */
export class Context {
  // Internal context variables
  private _context: Partial<Record<keyof ContextKeys, any>> = {}

  constructor(
    // To comply with Config interface
    host: HostString = defaultHost,
    // To comply with Config interface
    transport: grpc.TransportFactory = grpc.WebsocketTransport(),
    // For testing and debugging purposes.
    debug = false,
  ) {
    this._context['host'] = host
    this._context['transport'] = transport
    this._context['debug'] = debug
  }

  get host() {
    return this._context['host']
  }

  get transport() {
    return this._context['transport']
  }

  get debug() {
    return this._context['debug']
  }

  set(key: keyof ContextKeys, value?: any) {
    this._context[key] = value
    return this
  }

  get(key: keyof ContextKeys) {
    return this._context[key]
  }

  withSession(value?: string) {
    if (value === undefined) return this
    this._context['x-textile-session'] = value
    return this
  }

  withThread(value?: ThreadID) {
    if (value === undefined) return this
    this._context['x-textile-thread'] = value.toString()
    return this
  }

  withThreadName(value?: string) {
    if (value === undefined) return this
    this._context['x-textile-thread-name'] = value
    return this
  }

  withOrg(value?: string) {
    if (value === undefined) return this
    this._context['x-textile-org'] = value
    return this
  }

  withToken(value?: string) {
    if (value === undefined) return this
    this._context['authorization'] = `bearer ${value}`
    return this
  }

  withAPIKey(value?: string) {
    if (value === undefined) return this
    this._context['x-textile-api-key'] = value
    return this
  }

  withAPISig(value?: { sig: string; msg: string }) {
    if (value === undefined) return this
    const { sig, msg } = value
    this._context['x-textile-api-sig-msg'] = msg
    this._context['x-textile-api-sig'] = sig
    return this
  }

  withContext(value?: Context) {
    if (value === undefined) return this
    this._context = value._context
    return this
  }

  toJSON() {
    return this._context
  }

  toMetadata() {
    return new grpc.Metadata(this.toJSON())
  }

  static fromJSON(json: ContextKeys) {
    const ctx = new Context()
    ctx._context = json
    return ctx
  }

  async withUserKey(key?: KeyInfo) {
    if (key === undefined) return this
    const sig = await createAPISig(key.secret) // Defaults to 1 minute from now
    return this.withAPIKey(key.key).withAPISig(sig)
  }
}
