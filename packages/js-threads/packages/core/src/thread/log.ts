import CID from 'cids'
import Multiaddr from 'multiaddr'
import { PublicKey, PrivateKey } from '../external'
import { LogID, ThreadID } from './id'

// LogInfo holds known info about a log.
export interface LogInfo {
  id: LogID
  pubKey: PublicKey
  privKey?: PrivateKey
  addrs?: Set<Multiaddr>
  heads?: Set<CID>
}

// Log represents a thread log.
export interface Log {
  // ID of the log.
  id: LogID
  // pubKey of the log.
  pubKey: Buffer
  // privKey of the log.
  privKey?: Buffer
  // addrs of the log.
  addrs: Array<Multiaddr>
  // heads of the log.
  heads: Array<CID>
}
