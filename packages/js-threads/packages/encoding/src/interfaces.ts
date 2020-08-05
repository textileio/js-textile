import type { LogID } from "@textile/threads-core"
import type { ThreadID } from "@textile/threads-id"
import type CID from "cids"
import type { Block } from "./ipld"

/**
 * Event is a Block node representing an event.
 */
export interface Event {
  /**
   * The node structure of the event.
   */
  value: Block<EventNode>
  /**
   * The header content for the event.
   */
  header: Block<Uint8Array>
  /**
   * The body content for the event.
   */
  body: Block<Uint8Array>
  /**
   * The underlying event node.
   */
  obj?: EventNode
}

/**
 * Node defines the node structure of an event.
 */
export interface EventNode {
  /**
   * CID of body block
   */
  body: CID
  /**
   * CID of header block
   */
  header: CID
}

/**
 * Header defines the node structure of an event header.
 */
export interface EventHeader {
  /**
   * Single-use symmetric key
   */
  key?: Uint8Array
}

/**
 * LogRecord is an Block node representing a record.
 */
export interface LogRecord {
  /**
   * The node structure of the record.
   */
  value: Block<Uint8Array>
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
  sig: Uint8Array
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
  pubKey?: Uint8Array
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
