import PeerId from 'peer-id'
import CID from 'cids'
import { Multiaddr } from '@textile/multiaddr'
import { ThreadID } from '@textile/threads-id'
import { ThreadInfo, NewThreadOptions, LogID } from '../thread'
import { Identity } from '../identity'
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
  getToken(identity: Identity): Promise<string>

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
   */
  getThread(id: ThreadID): Promise<ThreadInfo>

  /**
   * pullThread for new records.
   * @param id The Thread ID.
   */
  pullThread(id: ThreadID): Promise<void>

  /**
   * deleteThread with id.
   * @param id The Thread ID.
   */
  deleteThread(id: ThreadID): Promise<void>

  /**
   * addReplicator to a thread.
   * @param id The Thread ID.
   * @param addr The multiaddress of the replicator peer.
   */
  addReplicator(id: ThreadID, addr: Multiaddr): Promise<PeerId>

  /**
   * createRecord from body.
   * @param id The Thread ID.
   * @param body The body to add as content.
   */
  createRecord(id: ThreadID, body: any): Promise<ThreadRecord | undefined>

  /**
   * addRecord to the given log.
   * @param id The Thread ID.
   * @param logID The Log ID.
   * @param rec The log record to add.
   */
  addRecord(id: ThreadID, logID: LogID, rec: LogRecord): Promise<void>

  /**
   * GetRecord returns the record at cid.
   * @param id The Thread ID.
   * @param rec The record's CID.
   */
  getRecord(id: ThreadID, rec: CID): Promise<LogRecord>

  /**
   * subscribe to new record events in the given threads.
   * @param cb The callback to call on each new thread record.
   * @param threads A (variadic) set of threads to subscribe to.
   */
  subscribe(cb: (rec?: ThreadRecord, err?: Error) => void, threads?: ThreadID[]): Closer
}
