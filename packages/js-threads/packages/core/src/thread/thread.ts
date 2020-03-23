import { ThreadID } from './id'
import { LogInfo } from './log'
import { Key } from './key'

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
  key?: Key
}
