import { ThreadID, LogID } from './id'

const version = '0.0.1'
const name = 'thread'

// ThreadProtocol describes the default Threads Protocol parameters
export const ThreadProtocol = {
  // Name is the protocol slug.
  name,
  // Code is the protocol code.
  code: 406,
  // Version is the current protocol version.
  version,
  // Protocol is the threads protocol tag.
  protocol: `/${name}/${version}`,
}

// ThreadInfo holds a thread ID associated known logs.
export interface ThreadInfo {
  id: ThreadID
  logs?: Set<LogID>
  replicatorKey?: Buffer
  readKey?: Buffer
}
