import CID from 'cids'
import Multiaddr from 'multiaddr'
import { PublicKey, PrivateKey } from 'libp2p-crypto'
import { LogID } from './id'

/**
 * LogInfo holds known info about a log.
 */
export interface LogInfo {
  /**
   * The logs ID. @todo: switch to using PeerId?
   */
  id: LogID
  /**
   * The logs public key used to check signatures.
   */
  pubKey: PublicKey
  /**
   * The logs private key, used to sign content when available.
   */
  privKey?: PrivateKey
  /**
   * The set of Multiaddrs associated with this log.
   */
  addrs?: Set<Multiaddr>
  /**
   * The set of heads for this log.
   */
  heads?: Set<CID>
}
