import { PrivateKey, PublicKey, keys } from 'libp2p-crypto'
import { ThreadID } from '@textile/threads-id'
import multibase from 'multibase'
import { Multiaddr } from '@textile/multiaddr'
import { LogInfo } from './log'
import { ThreadKey } from './key'

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

export interface NewThreadOptions {
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
