import CID from 'cids'
import { Block } from '../ipld'

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
