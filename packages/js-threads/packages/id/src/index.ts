import randomBytes from "@consento/sync-randombytes"
import multibase, { BaseNameOrCode } from "multibase"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore // Only used internally, so we can ignore types here
import { decode, encode } from "varint"

/**
 * Returns true if the two passed Uint8Arrays have the same content
 * @see {@link https://github.com/achingbrain/uint8arrays/blob/master/equals.js}
 */
function equals(a: Uint8Array, b: Uint8Array): boolean {
  if (a === b) {
    return true
  }

  if (a.byteLength !== b.byteLength) {
    return false
  }

  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }

  return true
}

/**
 * Variant denotes Thread variant. Currently only two variants are supported.
 * @public
 */
export enum Variant {
  Raw = 0x55,
  AccessControlled = 0x70, // Supports access control lists
}

/**
 * ThreadID represents a self-describing Thread identifier.
 *
 * It is formed by a Version, a Variant, and a random number of a given length.
 * @public
 *
 * @example
 * Create a new random ThreadID
 * ```typescript
 * import { ThreadID } from '@textile/threads'
 *
 * const id = ThreadID.fromRandom()
 *
 * console.log(id)
 * ```
 *
 * @example
 * Convert a ThreadID to/from a Base32 string
 * ```typescript
 * import { ThreadID } from '@textile/threads'
 *
 * const id = ThreadID.fromRandom()
 * const str = id.toString()
 * const restored = ThreadID.fromString(str)
 * ```
 */
export class ThreadID {
  constructor(readonly buf: Uint8Array) {}

  /**
   * Versions. Currently only V1 is supported.
   */
  static V1 = 0x01

  static Variant = Variant

  /**
   * fromRandom creates a new random ID object.
   * @param variant The Thread variant to use. @see Variant
   * @param size The size of the random component to use. Defaults to 32 bytes.
   */
  static fromRandom(
    variant: Variant = ThreadID.Variant.Raw,
    size = 32
  ): ThreadID {
    // two 8 bytes (max) numbers plus random bytes
    const bytes = Uint8Array.from([
      ...encode(ThreadID.V1),
      ...encode(variant),
      ...randomBytes(new Uint8Array(size)),
    ])
    return new ThreadID(bytes)
  }

  /**
   * fromString parses an ID-encoded string and returns an ID object.
   * For IDV1, an ID-encoded string is primarily a multibase string:
   *    <multibase-type-code><base-encoded-string>
   * The base-encoded string represents a:
   *    <version><variant><random-number>
   * @param v The input encoded Thread ID.
   */
  static fromString(v: string | Uint8Array): ThreadID {
    if (v.length < 2) {
      throw new Error("id too short")
    }
    const data = multibase.decode(v)
    return ThreadID.fromBytes(data)
  }

  /**
   * fromBytes takes an ID data slice, parses it and returns an ID.
   * For IDV1, the data bytes are arranged as:
   *    <version><variant><random-number>
   * Please use fromEncoded when parsing a regular ID string, as fromBytes does not
   * expect multibase-encoded data. fromBytes accepts the output of ID.bytes().
   * @param data The input Thread ID bytes.
   */
  static fromBytes(data: Uint8Array): ThreadID {
    let copy = new Uint8Array(data)
    const version = decode(copy)
    if (version != 1) {
      throw new Error(`expected 1 as the id version number, got: ${version}.`)
    }
    copy = copy.slice(decode.bytes, copy.length)
    const variant = decode(copy)
    if (!(variant in ThreadID.Variant)) {
      throw new Error("invalid variant.")
    }
    const id = copy.slice(decode.bytes, copy.length)
    if (id.length < 16) {
      throw new Error("random component too small.")
    }
    return new ThreadID(data)
  }

  /**
   * getEncoding returns the multibase encoding for a multibase encoded string.
   * Returns the name of the encoding if it is encoded, and throws an error otherwise.
   * @param v The Thread ID to check.
   */
  static getEncoding(v: string): string {
    if (v.length < 2) {
      throw new Error("Too Short")
    }
    const encoding = multibase.isEncoded(v)
    // check encoding is valid
    if (encoding === false) {
      throw new Error("Invalid Encoding")
    }
    return encoding
  }

  /**
   * isDefined returns true if an ID is defined.
   * Calling any other methods on an undefined ID will result in undefined behavior.
   */
  isDefined(): boolean {
    return this.buf.length > 0
  }

  /**
   * toBytes returns the byte representation of an ID.
   * The output of bytes can be parsed back into an ID with fromBytes.
   */
  toBytes(): Uint8Array {
    return this.buf // These should not be mutated directly!
  }

  /**
   * equals checks that two IDs are the same.
   * @param o The other Thread ID.
   */
  equals(o: ThreadID): boolean {
    return equals(this.buf, o.buf)
  }

  /**
   * version returns the ID version.
   */
  version(): number {
    return decode(this.buf)
  }

  /**
   * variant returns the variant of an ID.
   */
  variant(): number {
    let copy = new Uint8Array(this.buf)
    decode(copy)
    copy = copy.slice(decode.bytes)
    return decode(copy)
  }

  /**
   * toString returns the (multibase encoded) string representation of an ID.
   * @param base Name of the base to use for encoding. Defaults to 'base32'.
   */
  toString(base: BaseNameOrCode = "base32"): string {
    const decoder = new TextDecoder()
    switch (this.version()) {
      case ThreadID.V1:
        return decoder.decode(multibase.encode(base, this.buf))
      default:
        throw new Error("unknown ID version.")
    }
  }
}

export default ThreadID
