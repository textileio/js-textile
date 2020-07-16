import sha256 from "fast-sha256"
import { encode } from "varint"

export function multihash(
  digest: Uint8Array,
  code: number,
  length?: number
): Uint8Array {
  const a = new Uint8Array(encode(code))
  const b = new Uint8Array(encode(length ?? digest.length))
  const full = new Uint8Array(a.length + b.length + digest.length)
  full.set(a)
  full.set(b, a.length)
  full.set(digest, a.length + b.length)
  return full
}

/**
 * Basic multihash implementation that only supports sha256.
 * @param bytes The bytes to wrap with multihash.
 */
export function sha256Multihash(bytes: Uint8Array): Uint8Array {
  const digest = sha256(bytes)
  const code = 0x12 // sha2-256
  return multihash(digest, code)
}

export function ensureKey(key: Uint8Array, length: number): Uint8Array {
  if (!(key instanceof Uint8Array) || key.length < length)
    throw new Error(
      `Key must be a Uint8Array (or Buffer) of length >= ${length}`
    )
  return key
}
