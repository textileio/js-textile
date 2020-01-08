import EventEmitter from 'events'
import CID from 'cids'
import Multiaddr from 'multiaddr'
import { LogID, ThreadID, LogInfo, ThreadInfo, Log } from '../thread'
import { Closer, Block } from '../utils'
// @todo: Replace this with actual peer-id types
import { PeerID } from '../external'

export interface ThreadRecord {
  value: RecordNode
  threadID: ThreadID
  logID: LogID
}

export interface RecordNode {
  sig: Buffer
  prev: CID
  block: CID
}

// @todo: Add all the books
export interface LogStore extends Closer {
  close(): Promise<void>
  threads(): Promise<Set<ThreadID>>
  logs(id: ThreadID): Promise<Set<LogID>>
  addThread(info: ThreadInfo): Promise<void>
  threadInfo(id: ThreadID): Promise<ThreadInfo>
  addLog(id: ThreadID, info: LogInfo): Promise<void>
  logInfo(id: ThreadID, log: string): Promise<LogInfo>
}

export type Events = {
  record: (record: ThreadRecord) => void
}

export interface Service extends EventEmitter, Closer {
  store: LogStore
  host: PeerID
  // dag: DAGService
  close(): Promise<void>
  addThread(addr: Multiaddr, replicatorKey: Buffer, readKey?: Buffer): Promise<ThreadInfo | undefined>
  pullThread(id: ThreadID): Promise<void>
  deleteThread(id: ThreadID): Promise<void>
  addReplicator(id: ThreadID, peer: string): Promise<void>
  addRecord(id: ThreadID, body: Block): Promise<ThreadRecord | undefined>
  getRecord(id: ThreadID, rid: CID): Promise<ThreadRecord | undefined>
}

// Record is a thread record containing link data.
export interface Record {
  // recordNode is the top-level node's raw data.
  recordnode: Uint8Array | string
  // eventNode is the event node's raw data.
  eventnode: Uint8Array | string
  // headerNode is the header node's raw data.
  headernode: Uint8Array | string
  // bodyNode is the body node's raw data.
  bodynode: Uint8Array | string
}

// LogEntry represents a single log.
export interface LogEntry {
  // logID of this entry.
  ID: LogID
  // records returned for this entry.
  records: Record[]
  // log contains new log info that was missing from the request.
  log?: Log
}

export interface Network {
  // GetLogs from a peer.
  getLogs(id: ThreadID, replicatorKey: Buffer): Promise<Log[]>
  // PushLog to a peer.
  pushLog(id: ThreadID, log: LogInfo, replicatorKey: Buffer, readKey?: Buffer): Promise<void>
  // GetRecords from a peer.
  getRecords(id: ThreadID, replicatorKey: Buffer, offsets?: Map<LogID, CID>, limit?: number): Promise<LogEntry[]>
  // PushRecord to a peer.
  // pushRecord(id: ThreadID, log: LogID, record: Record): Promise<void>
}
