import { PublicKey, PrivateKey } from 'libp2p-crypto'
import { ThreadID } from './id'
import { LogInfo } from './log'

/**
 * KeyOptions defines options for keys when creating / adding a thread.
 */
export interface KeyOptions {
  /**
   * Symmetric encryption key. Should be 44 bytes in length. Can be generated with crypto.randomBytes().
   */
  replicatorKey?: Uint8Array
  /**
   * Symmetric encryption key. Should be 44 bytes in length. Can be generated with crypto.randomBytes().
   */
  readKey?: Uint8Array
  /**
   * Asymmetric encryption key (pair). Can be either a public or private key. If a public key is specified, this
   * limits the types of operations the receiving Thread service can perform.
   */
  logKey?: PublicKey | PrivateKey
}

// Thread protocol version
const version = '0.0.1'
// Thread protocol name
const name = 'thread'

/**
 * ThreadProtocol describes the default Threads Protocol parameters
 */
export const ThreadProtocol = {
  /**
   * Name is the protocol slug.
   */
  name,
  /**
   * Code is the protocol code.
   */
  code: 406,
  /**
   * Version is the current protocol version.
   */
  version,
  /**
   * Protocol is the threads protocol tag.
   */
  protocol: `/${name}/${version}`,
}

/**
 * ThreadInfo holds a thread ID associated known logs.
 */
export interface ThreadInfo {
  /**
   * Thread ID.
   */
  id: ThreadID
  /**
   * Set of log information.
   */
  logs?: Set<LogInfo>
  /**
   * Symmetric encryption key.
   */
  replicatorKey?: Uint8Array
  /**
   * Symmetric encryption key.
   */
  readKey?: Uint8Array
}
