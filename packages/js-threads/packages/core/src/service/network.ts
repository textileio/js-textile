import PeerId from 'peer-id'
import CID from 'cids'
import Multiaddr from 'multiaddr'
import { ThreadID, ThreadInfo, KeyOptions } from '../thread'
import { ThreadRecord, LogRecord } from './record'

export interface Closer {
  close(): void
}

/**
 * Service is the network interface for thread orchestration.
 */
export interface Service extends API {
  /**
   * DAGService provides a DAG API to the network.
   * @todo: Would come from ipfs-lite
   */

  /**
   * Host provides a network identity.
   * @todo: Should be a libp2p host, but here we just use PeerId for now
   */
  host: PeerId
}

/**
 * API is the network interface for thread orchestration.
 */
export interface API {
  /**
   * getHostID returns the service's (remote) host peer ID.
   */
  getHostID(): Promise<PeerId>

  /**
   * createThread with id.
   * @param id The Thread id.
   * @param opts The set of keys to use when creating the Thread. All keys are "optional", though if no replicator key
   * is provided, one will be created (and returned). Similarly, if no LogKey is provided, then a private key will be
   * generated (and returned). If no ReadKey is provided, the service will be unable to write records (but it may be
   * able to return records).
   */
  createThread(id: ThreadID, opts: KeyOptions): Promise<ThreadInfo>

  /**
   * addThread from a multiaddress.
   * @param addr The Thread multiaddress.
   * @param opts The set of keys to use when adding the Thread.
   */
  addThread(addr: Multiaddr, opts: KeyOptions): Promise<ThreadInfo>

  /**
   * getThread with id.
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
   * @param addr The multiaddr of the replicator peer.
   */
  addReplicator(id: ThreadID, addr: Multiaddr): Promise<PeerId>

  /**
   * createRecord with body.
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
  addRecord(id: ThreadID, logID: PeerId, rec: LogRecord): Promise<void>

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
  subscribe(cb: (rec?: ThreadRecord, err?: Error) => void, ...threads: ThreadID[]): Closer
}
