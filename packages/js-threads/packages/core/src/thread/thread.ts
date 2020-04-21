import { PrivateKey, PublicKey, keys } from 'libp2p-crypto'
import { ThreadID } from '@textile/threads-id'
import multibase from 'multibase'
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
}

/**
 * Identity represents an entity capable of signing a message.
 * This is a simple 'private key' interface that must be capable of returning the associated public key for
 * verification. In many cases, this will just be a private key, but callers can use any setup that suits their needs.
 * The interface is currently modeled after libp2p-crypto PrivateKey.
 */
export type Identity = Pick<PrivateKey, 'sign' | 'public'>

/**
 * Create a random Ed25519 PrivateKey to be used as an Identity.
 */
export function randomIdentity() {
  return keys.supportedKeys.ed25519.generateKeyPair()
}

export function publicKeyToString(key: PublicKey) {
  return multibase.encode('base32', key.bytes).toString()
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
