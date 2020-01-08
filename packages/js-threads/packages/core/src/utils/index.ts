import Buffer from 'buffer'
import CID from 'cids'
import { ThreadID, LogID } from '../thread'

export interface Block {
  data: Buffer
  cid: CID
}

export interface LogsThreads {
  // logs returns a list of log IDs for a thread.
  logs(id: ThreadID): Promise<Set<LogID>>
  // threads returns a list of threads referenced in the book.
  threads(): Promise<Set<ThreadID>>
}

export interface Closer {
  close(): Promise<void>
}
