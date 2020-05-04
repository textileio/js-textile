/**
 * @packageDocumentation
 * @module @textile/threads-client/models
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { grpc } from '@improbable-eng/grpc-web'

/**
 * Configuration for Threads DB Client.
 */
export interface Config {
  host?: string
  transport?: grpc.TransportFactory
  debug?: boolean
  toJSON(): Record<string, any>

  [key: string]: any
}

/**
 * The default config required to connect to localhost Threads daemon
 */
export const defaultConfig: Config = {
  host: 'http://127.0.0.1:6007',
  transport: grpc.WebsocketTransport(),
  debug: false,
  toJSON() {
    return { ...this }
  },
}
