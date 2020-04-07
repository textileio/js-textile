import { PublicKey, PrivateKey, randomBytes } from 'libp2p-crypto'
import multibase from 'multibase'

export const invalidKeyError = new Error('Invalid key')

// NonceBytes is the length of GCM nonce.
const nonceBytes = 12

// KeyBytes is the length of GCM key.
const keyBytes = 32

/**
 * keyFromString returns a key by decoding a base32-encoded string.
 * @param k Input base32-encoded string.
 */
export const keyFromString = (k: string) => {
  return multibase.decode(k)
}

/**
 * String returns the base32-encoded string representation of raw key bytes.
 * @param k Input key buffer.
 */
export const keyToString = (k: Buffer) => {
  return multibase.encode('base32', k).toString()
}

/**
 * Key is a thread encryption key with two components.
 * @param sk Network key is used to encrypt outer log record linkages.
 * @param rk Read key is used to encrypt inner record events.
 */
export class ThreadKey {
  constructor(readonly service: Buffer, readonly read?: Buffer) {}
  /**
   * Create a new set of keys.
   * @param withRead Whether to also include a random read key.
   */
  static fromRandom(withRead = true) {
    return new ThreadKey(randomBytes(keyBytes), withRead ? randomBytes(keyBytes) : undefined)
  }

  /**
   * Create Key from bytes.
   * @param bytes Input bytes of (possibly both) key(s).
   */
  static fromBytes(bytes: Buffer) {
    if (bytes.byteLength !== keyBytes && bytes.byteLength !== keyBytes * 2) {
      throw invalidKeyError
    }
    const sk = bytes.slice(0, keyBytes)
    let rk: Buffer | undefined
    if (bytes.byteLength === keyBytes * 2) {
      rk = bytes.slice(keyBytes)
    }
    return new ThreadKey(sk, rk)
  }

  /**
   * Create Key by decoding a base32-encoded string.
   * @param s The base32-encoded string.
   */
  static fromString(s: string) {
    const data = multibase.decode(s)
    return this.fromBytes(data)
  }

  isDefined() {
    return this.service !== undefined
  }

  canRead() {
    return this.read !== undefined
  }

  toBytes() {
    if (this.read !== undefined) return Buffer.concat([this.service, this.read])
    return this.service
  }

  /**
   * Return the base32-encoded string representation of raw key bytes.
   * For example:
   * Full: "brv7t5l2h55uklz5qwpntcat26csaasfchzof3emmdy6povabcd3a2to2qdkqdkto2prfhizerqqudqsdvwherbiy4nazqxjejgdr4oy"
   * Network: "bp2vvqody5zm6yqycsnazb4kpqvycbdosos352zvpsorxce5koh7q"
   */
  toString() {
    return multibase.encode('base32', this.toBytes()).toString()
  }
}
