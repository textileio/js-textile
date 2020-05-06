import { PrivateKey, PublicKey, keys } from 'libp2p-crypto'
import { ThreadID } from '@textile/threads-id'
import multibase from 'multibase'
import { LogInfo } from './log'
import { ThreadKey } from './key'
import { Multiaddr } from '@textile/multiaddr'

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
   * Symmetric encryption keys.
   */
  key?: ThreadKey

  /**
   * The thread addrs.
   */
  addrs?: Set<Multiaddr>
}

/**
 * ThreadToken is a concrete type for a JWT token string, which provides a claim to an identity.
 * It is a base64 encoded string.
 * @todo: We don't need to create or verify these on the client (yet).
 */
export type ThreadToken = string

/**
 * ThreadOptions stores options for creating / adding a thread.
 */
export interface ThreadOptions {
  /**
   * Token stores the thread token for authorizing a new Thread.
   */
  token?: ThreadToken
}

export interface NewThreadOptions extends ThreadOptions {
  /**
   * Set of symmetric encryption keys.Can be generated with Key.fromRandom().
   */
  threadKey?: ThreadKey
  /**
   * Asymmetric encryption key (pair). Can be either a public or private key. If a public key is specified, this
   * limits the types of operations the receiving Thread network can perform.
   */
  logKey?: PublicKey | PrivateKey
}
