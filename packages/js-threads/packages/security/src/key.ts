import randombytes from "@consento/sync-randombytes"
import multibase from "multibase"

export const invalidKeyError = new Error("Invalid key")

export const randomBytes = (byteLength: number): Uint8Array => {
  return randombytes(new Uint8Array(byteLength))
}

// KeyBytes is the length of GCM key.
const keyBytes = 32

/**
 * keyFromString returns a key by decoding a base32-encoded string.
 * @param k Input base32-encoded string.
 */
export const keyFromString = (k: string): Uint8Array => {
  return multibase.decode(k)
}

/**
 * String returns the base32-encoded string representation of raw key bytes.
 * @param k Input key bytes.
 */
export const keyToString = (k: Uint8Array): string => {
  const decoder = new TextDecoder()
  return decoder.decode(multibase.encode("base32", k))
}

/**
 * Key is a thread encryption key with two components.
 * @param sk Network key is used to encrypt outer log record linkages.
 * @param rk Read key is used to encrypt inner record events.
 */
export class ThreadKey {
  constructor(readonly service: Uint8Array, readonly read?: Uint8Array) {}
  /**
   * Create a new set of keys.
   * @param withRead Whether to also include a random read key.
   */
  static fromRandom(withRead = true): ThreadKey {
    return new ThreadKey(
      randomBytes(keyBytes),
      withRead ? randomBytes(keyBytes) : undefined
    )
  }

  /**
   * Create Key from bytes.
   * @param bytes Input bytes of (possibly both) key(s).
   */
  static fromBytes(bytes: Uint8Array): ThreadKey {
    if (bytes.byteLength !== keyBytes && bytes.byteLength !== keyBytes * 2) {
      throw invalidKeyError
    }
    const sk = bytes.slice(0, keyBytes)
    let rk: Uint8Array | undefined
    if (bytes.byteLength === keyBytes * 2) {
      rk = bytes.slice(keyBytes)
    }
    return new ThreadKey(sk, rk)
  }

  /**
   * Create Key by decoding a base32-encoded string.
   * @param s The base32-encoded string.
   */
  static fromString(s: string): ThreadKey {
    const data = multibase.decode(s)
    return this.fromBytes(data)
  }

  isDefined(): boolean {
    return this.service !== undefined
  }

  canRead(): boolean {
    return this.read !== undefined
  }

  toBytes(): Uint8Array {
    if (this.read !== undefined) {
      const full = new Uint8Array(
        this.service.byteLength + (this.read.byteLength ?? 0)
      )
      full.set(this.service)
      this.read && full.set(this.read, this.service.byteLength)
      return full
    }
    return this.service
  }

  /**
   * Return the base32-encoded string representation of raw key bytes.
   * For example:
   * Full: "brv7t5l2h55uklz5qwpntcat26csaasfchzof3emmdy6povabcd3a2to2qdkqdkto2prfhizerqqudqsdvwherbiy4nazqxjejgdr4oy"
   * Network: "bp2vvqody5zm6yqycsnazb4kpqvycbdosos352zvpsorxce5koh7q"
   */
  toString(): string {
    return keyToString(this.toBytes())
  }
}
