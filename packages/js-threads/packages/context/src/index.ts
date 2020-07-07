import { grpc } from '@improbable-eng/grpc-web'
import { createAPISig, UserAuth, KeyInfo, expirationError } from '@textile/security'

/**
 * The set of host strings used by any gPRC clients.
 */
export type HostString =
  | 'https://api.textile.io:3447'
  | 'https://api.staging.textile.io:3447'
  | 'http://127.0.0.1:3007'
  | string
export const defaultHost: HostString = 'https://api.textile.io:3447'

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
  withKeyInfo(key?: KeyInfo, date?: Date): Promise<ContextInterface>
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
  toMetadata(ctx?: ContextInterface): Promise<grpc.Metadata>
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
  public _context: Partial<Record<keyof ContextKeys, any>> = {}
  public authCallback?: () => Promise<UserAuth>

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

  static fromUserAuth(
    auth: UserAuth,
    host: HostString = defaultHost,
    debug = false,
    transport: grpc.TransportFactory = grpc.WebsocketTransport(),
  ) {
    const ctx = new Context(host, debug, transport)
    const { key, token, ...sig } = auth
    return ctx.withAPIKey(key).withAPISig(sig).withToken(token)
  }

  static fromUserAuthCallback(
    authCallback: () => Promise<UserAuth>,
    host: HostString = defaultHost,
    debug = false,
    transport: grpc.TransportFactory = grpc.WebsocketTransport(),
  ) {
    const ctx = new Context(host, debug, transport)
    // @todo: Should we now callback right away?
    ctx.authCallback = authCallback
    return ctx
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

  async withKeyInfo(key?: KeyInfo, date?: Date) {
    if (key === undefined) return this
    // Enables the use of insecure / non-signing keys
    if (!key.secret) return this.withAPIKey(key.key)
    const sig = await createAPISig(key.secret, date)
    return this.withAPIKey(key.key).withAPISig(sig)
  }

  withContext(value?: ContextInterface) {
    if (value === undefined) return this
    // Spread to copy rather than reference
    this._context = value.toJSON()
    return this
  }

  /**
   * Returns true if this Context contains an api sig msg, and that msg has expired, or if
   * it does _not_ have an api sig msg, but it _does_ have an auth callback.
   */
  get isExpired() {
    const msg = this.get('x-textile-api-sig-msg')
    const notAuthed = msg === undefined && this.authCallback !== undefined
    const isExpired = msg !== undefined && new Date(msg) <= new Date()
    return isExpired || notAuthed
  }

  /**
   * Refresh user auth with provided callback.
   * If callback is not specified, attempts to use existing callback specified at initialization.
   */
  async refreshUserAuth(authCallback?: () => Promise<UserAuth>) {
    // If we have a new one, use it...
    if (authCallback !== undefined) {
      this.authCallback = authCallback
    }
    // If we still don't have a callback, throw...
    if (this.authCallback === undefined) {
      throw new Error('Missing authCallback. See Context.fromUserAuthCallback for details.')
    }
    // Now do the renewal and return self...
    const { key, token, ...sig } = await this.authCallback()
    return this.withAPIKey(key).withAPISig(sig).withToken(token)
  }

  /**
   * Convert Context to plain JSON object.
   * @throws If this Context has expired.
   * @see toMetadata for an alternative for gRPC clients that supports auto-renewal.
   */
  toJSON() {
    // Strip out transport
    // @todo: Phase out transport out entirely
    const { transport, ...json } = this._context
    // If we're expired, throw...
    if (this.isExpired) {
      throw expirationError
    }
    return json
  }

  /**
   * Convert Context to grpc Metadata object.
   * Will automatically call the auth callback if available.
   * @param ctx Additional context object that will be merged with this prior to conversion.
   * @see toJSON for an alternative that returns a plain object, and throws when expired.
   */
  async toMetadata(ctx?: Context) {
    const context = new Context()
    if (this.isExpired && this.authCallback !== undefined) {
      const { key, token, ...sig } = await this.authCallback()
      // We do want to mutate this here because we want to update our auth sig
      this.withAPIKey(key).withAPISig(sig).withToken(token)
    }
    // We merge this context and ctx with the empty context so as to avoid mutating this with ctx
    return new grpc.Metadata(context.withContext(this).withContext(ctx).toJSON())
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
