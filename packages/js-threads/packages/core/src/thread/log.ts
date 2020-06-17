import CID from 'cids'
import { PublicKey, PrivateKey, multihash, keys } from '@textile/threads-crypto'
import { Multiaddr } from '@textile/multiaddr'
import multibase from 'multibase'

function areEqual(a: Uint8Array, b: Uint8Array) {
  if (a.byteLength !== b.byteLength) return false
  return a.every((val, i) => val === b[i])
}

const computeDigest = (pubKey: PublicKey) => {
  if (pubKey.bytes.length <= 42) {
    return multihash(pubKey.bytes, 0x00)
  } else {
    return pubKey.hash()
  }
}

const computeLogId = async (privKey?: PrivateKey, pubKey?: PublicKey) => {
  const key = pubKey ?? privKey?.public
  if (key === undefined) throw new Error('Valid public or private key required')
  const digest = await computeDigest(key)
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return new LogID(digest, privKey, pubKey)
}

/**
 * LogID represents a simplified PeerID used for tracking thread logs.
 * It is a minimal implementation of PeerID useful mostly for marshaling and unmarshaling.
 */
export class LogID {
  constructor(
    readonly id: Uint8Array,
    readonly privKey?: PrivateKey,
    readonly pubKey: PublicKey | undefined = privKey?.public,
  ) {
    if (!(id instanceof Uint8Array)) {
      throw new Error('invalid id provided')
    }
    if (privKey && pubKey && !areEqual(privKey.public.bytes, pubKey.bytes)) {
      throw new Error('inconsistent arguments')
    }
  }

  static async fromRandom(bytesLength?: number) {
    const key = await keys.generateKeyPair('Ed25519', bytesLength)
    return computeLogId(key)
  }

  static fromBytes(buf: Uint8Array) {
    return new LogID(buf)
  }

  static fromB58String(str: string) {
    const cid = new CID(str)
    // supported: 'libp2p-key' (CIDv1) and 'dag-pb' (CIDv0 converted to CIDv1)
    if (!(cid.codec === 'libp2p-key' || cid.codec === 'dag-pb')) {
      throw new Error('Invalid multicodec')
    }
    return new LogID(cid.multihash)
  }

  static fromPublicKey(key: PublicKey | Uint8Array) {
    if (key instanceof Uint8Array) {
      return computeLogId(undefined, keys.unmarshalPublicKey(key))
    }
    return computeLogId(undefined, key)
  }

  static async fromPrivateKey(key: PrivateKey | Uint8Array) {
    if (key instanceof Uint8Array) {
      return computeLogId(await keys.unmarshalPrivateKey(key))
    }
    return computeLogId(key)
  }

  // Return the protobuf version of the public key, matching go ipfs formatting
  marshalPubKey() {
    if (this.pubKey) {
      return keys.marshalPublicKey(this.pubKey)
    }
  }

  // Return the protobuf version of the private key, matching go ipfs formatting
  marshalPrivKey() {
    if (this.privKey) {
      return keys.marshalPrivateKey(this.privKey)
    }
  }

  toBytes() {
    return this.id
  }

  toB58String() {
    return multibase.encode('base58btc', Buffer.from(this.id)).toString().slice(1)
  }

  // Return self-describing String representation
  toString() {
    const cid = new CID(1, 'libp2p-key', Buffer.from(this.id), 'base32')
    return cid.toBaseEncodedString('base32')
  }

  /**
   * Checks the equality of `this` peer against a given LogID.
   */
  equals(id: Uint8Array | LogID) {
    if (id instanceof Uint8Array) {
      return areEqual(this.id, id)
    } else if (id.id) {
      return areEqual(this.id, id.id)
    } else {
      throw new Error('not valid Id')
    }
  }

  /*
   * Check if this LogID instance is valid (privKey -> pubKey -> Id)
   */
  isValid() {
    return Boolean(
      this.privKey &&
        this.privKey.public &&
        this.privKey.public.bytes &&
        this.pubKey?.bytes instanceof Uint8Array &&
        areEqual(this.privKey.public.bytes, this.pubKey.bytes),
    )
  }
}

export const PeerId = {
  BytesToString: (buf: Uint8Array) => new LogID(buf).toB58String(),
}

/**
 * LogInfo holds known info about a log.
 */
export interface LogInfo {
  /**
   * The logs ID.
   */
  id: LogID
  /**
   * The logs public key used to check signatures.
   */
  pubKey?: PublicKey
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
  head?: CID
}
