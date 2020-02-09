import { grpc } from '@improbable-eng/grpc-web'

export interface BaseConfig {
  /**
   * The local/remote host url.
   */
  host?: string
  /**
   * The default transport to use when making web-gRPC calls.
   */
  transport?: grpc.TransportFactory
}

/**
 * Config controls the remote API settings.
 */
export class Config {
  /**
   * The local/remote host url.
   */
  public host: string
  /**
   * The default transport to use when making web-gRPC calls.
   */
  public transport: grpc.TransportFactory
  /**
   * The active session token.
   */
  public session?: string

  /**
   * Create a new Config object.
   * @param host The local/remote host url. Defaults to 'https:127.0.0.1:5007'.
   * @param transport The default transport to use when making web-gRPC calls. Defaults to WebSockets.
   */
  constructor(host?: string, transport?: grpc.TransportFactory) {
    this.host = host || 'http://127.0.0.1:5007'
    this.transport = transport || grpc.WebsocketTransport()
  }

  _wrapMetadata(values?: { [key: string]: any }): { [key: string]: any } | undefined {
    if (!this.session) {
      return values
    }
    const response = values ?? {}
    if ('Authorization' in response || 'authorization' in response) {
      return response
    }
    response['Authorization'] = `Bearer ${this.session}`
    return response
  }

  _wrapBrowserHeaders(values: grpc.Metadata): grpc.Metadata {
    if (!this.session) {
      return values
    }
    values.set('Authorization', `Bearer ${this.session}`)
    return values
  }
}
