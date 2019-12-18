import Buffer from 'buffer'
import CID from 'cids'

export { ID, Variants } from './thread/id'

export interface Block {
  data: Buffer
  cid: CID
}

export interface BaseRecord {
  event_node?: string
  header_node?: string
  body_node?: string
  record_node?: string
}
export interface LogRecord extends BaseRecord {
  id: string
  log_id?: string
  thread_id: string
}

export interface HeaderNode {
  key: Buffer
  time: number
}

export interface EventNode {
  header: any
  body: any
}

export interface RecordNode {
  sig: Buffer
  prev: any
  block: any
}
