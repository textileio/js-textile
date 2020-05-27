import { grpc } from '@improbable-eng/grpc-web'
import { HMAC } from 'fast-sha256'
import multibase from 'multibase'

/**
 * The set of host strings used by any gPRC clients.
 */
type HostString =
  | 'https://api.textile.io:3447'
  | 'https://api.staging.textile.io:3447'
  | 'http://127.0.0.1:3007'
  | string
export const defaultHost: HostString = 'https://api.textile.io:3447'

/**
 * Interface describing the required shape of input user group/account keys.
 */
type KeyInfo = {
  /**
   * API key. Can be embedded/shared within an app.
   */
  key: string
  /**
   * User group/account secret. Should not be embedded/shared publicly.
   */
  secret: string
  /**
   * Key type. One of ACCOUNT or USER
   */
  type: 0 | 1
}

export const expirationError = new Error(
  'Context expired. Consider calling withUserKey or withAPISig to refresh.',
)

/**
 * Generate an authorization signature and message.
 * By default, this will use a Date one minute from `Date.now` as the message. Subsequent calls to
 * the gRPC APIs will throw (or return an authorization error) if the message date has passed.
 * @note This function is provided for app developers, but it should NOT be used client-side,
 * as it requires a key secret.
 * @param secret The key secret to generate the signature. See KeyInfo for details.
 * @param date An optinal future Date to use as signature message. Once `date` has passed, this
 * authorization signature and message will expire. Defaults to one minute from `Date.now`.
 */
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

/**
 * Interface describing the set of default context keys.
 */
export interface ContextKeys {
  /**
   * Thread name. Specifies a mapping between human-readable name and a ThreadID.
   */
  ['x-textile-thread-name']?: string
  /**
   * ThreadID as a string. Should be generated with `ThreadID.toString()` method.
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
   * API key. Used for user group/account authentication.
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
   * The service host address/url. Defaults to https://api.textile.io.
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
   * ContextKeys may also contain any number of additional custom keys.
   */
  [key: string]: any
}

/**
 * Interface describing the required methods for a full ContextInterface.
 * Users of ContextInterface may only require a subset of these methods, in which case, they should
 * specify their own interface, ensuring that ContextInterface is able to satisfy it.
 */
export interface ContextInterface {
  /**
   * The service host address/url. Defaults to https://api.textile.io.
   */
  host: HostString
  /**
   * Whether to enable debugging output during gRPC calls.
   */
  debug: boolean
  /**
   * The transport to use for gRPC calls. Defaults to web-sockets.
   */
  transport: grpc.TransportFactory
  /**
   * Set the session key. Used for various session contexts.
   */
  withSession(value?: string): ContextInterface
  /**
   * Set the thread ID as a string. Should be generated with `ThreadID.toString()` method.
   */
  withThread(value?: string): ContextInterface
  /**
   * Set the thread name. Specifies a mapping between human-readable name and a ThreadID.
   */
  withThreadName(value?: string): ContextInterface
  /**
   * Set the org slug/name. Used for various org session operations.
   */
  withOrg(value?: string): ContextInterface
  /**
   * Set the authorization token for interacting with remote APIs.
   */
  withToken(value?: string): ContextInterface
  /**
   * Set the API key. Used for user group/account authentication.
   */
  withAPIKey(value?: string): ContextInterface
  /**
   * Set the API signature used to authenticate with remote APIs.
   */
  withAPISig(value?: { sig: string; msg: string }): ContextInterface
  /**
   * Compute the API signature and message.
   * @param key User group/account key information.
   * @param date Optional future Date for computing the authorization signature.
   */
  withUserKey(key?: KeyInfo, date?: Date): Promise<ContextInterface>
  /**
   * Merge another context with this one.
   */
  withContext(value?: ContextInterface): ContextInterface
  /**
   * Export this context to a JS Object useful for exporting to JSON.
   */
  toJSON(): any
  /**
   * Export this context as gRPC Metadata.
   */
  toMetadata(): grpc.Metadata
  /**
   * Set arbitrary key/value context pairs.
   * @param key The key to set.
   * @param value The value to specify under `key`.
   */
  set(key: keyof ContextKeys, value?: any): ContextInterface
  /**
   * Get arbitrary key/value context pairs.
   * @param key The key to get.
   */
  get(key: keyof ContextKeys): any
}

/**
 * Context provides context management for gRPC credentials and config settings.
 * It is the default implementation for the ContextInterface interface.
 */
export class Context implements ContextInterface {
  // Internal context variables
  private _context: Partial<Record<keyof ContextKeys, any>> = {}

  /**
   * Construct a new Context object.
   * @param host The remote gRPC host. This input exists to comply with the Config interface.
   * @param debug For testing and debugging purposes.
   * @param transport To comply with Config interface. Should be left as websocket transport.
   */
  constructor(
    host: HostString = defaultHost,
    debug = false,
    transport = grpc.WebsocketTransport(),
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

  withThread(value?: string) {
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

  async withUserKey(key?: KeyInfo, date?: Date) {
    if (key === undefined) return this
    const sig = await createAPISig(key.secret, date)
    return this.withAPIKey(key.key).withAPISig(sig)
  }

  withContext(value?: ContextInterface) {
    if (value === undefined) return this
    // Spread to copy rather than reference
    this._context = value.toJSON()
    return this
  }

  toJSON() {
    // Strip out transport. @todo: phase out transport out entirely
    const { transport, ...context } = this._context
    const msg = context['x-textile-api-sig-msg']
    if (msg && new Date(msg) <= new Date()) {
      throw expirationError
    }
    return context
  }

  toMetadata() {
    return new grpc.Metadata(this.toJSON())
  }

  /**
   * Import various ContextInterface API properties from JSON.
   * @param json The JSON object.
   * @param host Optional host string.
   * @param debug Optional debug setting.
   * @param transport Optional transport option.
   */
  static fromJSON(
    json: ContextKeys,
    host: HostString = defaultHost,
    debug = false,
    transport: grpc.TransportFactory = grpc.WebsocketTransport(),
  ) {
    const newContext = { ...json }
    newContext['host'] = host
    newContext['transport'] = transport
    newContext['debug'] = debug
    const ctx = new Context()
    ctx._context = newContext
    return ctx
  }
}
