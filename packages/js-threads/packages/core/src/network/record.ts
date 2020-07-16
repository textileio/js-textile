import { ThreadID } from "@textile/threads-id"
import CID from "cids"
import { Block } from "../ipld"
import { LogID } from "../thread"
import { Event } from "./event"

/**
 * LogRecord is an Block node representing a record.
 */
export interface LogRecord {
  /**
   * The node structure of the record.
   */
  value: Block<Buffer>
  /**
   * The underlying event block.
   */
  block: Event
  /**
   * The underlying record node.
   */
  obj?: RecordNode
}

/**
 * Node defines the node structure of a record.
 */
export interface RecordNode {
  /**
   * Signature of current and previous blocks from the log key.
   */
  sig: Buffer
  /**
   * CID of inner block.
   */
  block: CID
  /**
   * CID of previous record.
   */
  prev?: CID

  /**
   * Public of the identity used to author this record.
   */
  pubKey?: Buffer
}

/**
 * ThreadRecord wraps a LogRecord within a thread and log context.
 */
export interface ThreadRecord {
  /**
   * The underlying LogRecord.
   */
  record?: LogRecord
  /**
   * The Thread to which this record belongs.
   */
  threadID: ThreadID
  /**
   * To Log to which this record belongs.
   */
  logID: LogID
}
