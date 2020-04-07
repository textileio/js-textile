import PeerId from 'peer-id'
import CID from 'cids'
import {
  ThreadID,
  ThreadInfo,
  ThreadOptions,
  NewThreadOptions,
  ThreadToken,
  Identity,
  LogID,
} from '../thread'
import { Multiaddr } from '../multiaddr'
import { ThreadRecord, LogRecord } from './record'

export interface Closer {
  close(): void
}

/**
 * Network is the network interface for thread orchestration.
 */
export interface Network {
  /**
   * getHostID returns the network's (remote) host peer ID.
   */
  getHostID(): Promise<PeerId>

  /**
   * getToken returns a signed token representing an identity.
   * @param identity The thread identity.
   */
  getToken(identity: Identity): Promise<ThreadToken>

  /**
   * createThread with credentials.
   * @param id The Thread id.
   * @param opts The set of keys and options to use when creating the Thread.
   * All keys are "optional", though if no thread key is provided, one will be created (and returned).
   * Similarly, if no log key is provided, then a private key will be generated (and returned).
   */
  createThread(id: ThreadID, opts: NewThreadOptions): Promise<ThreadInfo>

  /**
   * addThread with credentials from a multiaddress.
   * @param addr The Thread multiaddress.
   * @param opts The set of keys and options to use when adding the Thread.
   */
  addThread(addr: Multiaddr, opts: NewThreadOptions): Promise<ThreadInfo>

  /**
   * getThread with credentials.
   * @param id The Thread ID.
   * @param opts Thread options.
   */
  getThread(id: ThreadID, opts?: ThreadOptions): Promise<ThreadInfo>

  /**
   * pullThread for new records.
   * @param id The Thread ID.
   * @param opts Thread options.
   */
  pullThread(id: ThreadID, opts?: ThreadOptions): Promise<void>

  /**
   * deleteThread with id.
   * @param id The Thread ID.
   * @param opts Thread options.
   */
  deleteThread(id: ThreadID, opts?: ThreadOptions): Promise<void>

  /**
   * addReplicator to a thread.
   * @param id The Thread ID.
   * @param addr The multiaddress of the replicator peer.
   * @param opts Thread options.
   */
  addReplicator(id: ThreadID, addr: Multiaddr, opts?: ThreadOptions): Promise<PeerId>

  /**
   * createRecord from body.
   * @param id The Thread ID.
   * @param body The body to add as content.
   * @param opts Thread options.
   */
  createRecord(id: ThreadID, body: any, opts?: ThreadOptions): Promise<ThreadRecord | undefined>

  /**
   * addRecord to the given log.
   * @param id The Thread ID.
   * @param logID The Log ID.
   * @param rec The log record to add.
   * @param opts Thread options.
   */
  addRecord(id: ThreadID, logID: LogID, rec: LogRecord, opts?: ThreadOptions): Promise<void>

  /**
   * GetRecord returns the record at cid.
   * @param id The Thread ID.
   * @param rec The record's CID.
   * @param opts Thread options.
   */
  getRecord(id: ThreadID, rec: CID, opts?: ThreadOptions): Promise<LogRecord>

  /**
   * subscribe to new record events in the given threads.
   * @param cb The callback to call on each new thread record.
   * @param threads A (variadic) set of threads to subscribe to.
   * @param opts Thread options.
   */
  subscribe(
    cb: (rec?: ThreadRecord, err?: Error) => void,
    threads?: ThreadID[],
    opts?: ThreadOptions,
  ): Closer
}
