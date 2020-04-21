import { encode, decode } from 'varint'
import randomBytes from '@consento/sync-randombytes'
import multibase, { name as Name } from 'multibase'

/**
 * ThreadID represents a self-describing Thread identifier.
 * It is formed by a Version, a Variant, and a random number of a given length.
 */
class ThreadID {
  constructor(private buf: Buffer) {}
  /**
   * fromRandom creates a new random ID object.
   * @param variant The Thread variant to use. @see Variant
   * @param size The size of the random component to use. Defaults to 32 bytes.
   */
  static fromRandom(variant: ThreadID.Variant = ThreadID.Variant.Raw, size = 32) {
    // two 8 bytes (max) numbers plus random bytes
    const bytes = Buffer.concat([
      Buffer.from(encode(ThreadID.V1)),
      Buffer.from(encode(variant)),
      randomBytes(Buffer.alloc(size)),
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
  static fromString(v: string | Buffer) {
    if (v.length < 2) {
      throw new Error('id too short')
    }
    const data = multibase.decode(v)
    return ThreadID.fromBytes(data)
  }

  /**
   * fromBytes takes an ID data slice, parses it and returns an ID.
   * For IDV1, the data buffer is in the form:
   *    <version><variant><random-number>
   * Please use fromEncoded when parsing a regular ID string, as fromBytes does not
   * expect multibase-encoded data. fromBytes accepts the output of ID.bytes().
   * @param data The input Thread ID bytes.
   */
  static fromBytes(data: Buffer) {
    let copy = Buffer.from(data)
    const version = decode(copy)
    if (version != 1) {
      throw new Error(`expected 1 as the id version number, got: ${version}.`)
    }
    copy = copy.slice(decode.bytes, copy.length)
    const variant = decode(copy)
    if (!(variant in ThreadID.Variant)) {
      throw new Error('invalid variant.')
    }
    const id = copy.slice(decode.bytes, copy.length)
    if (id.length < 16) {
      throw new Error('random component too small.')
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
      throw new Error('Too Short')
    }
    const encoding = multibase.isEncoded(v)
    // check encoding is valid
    if (encoding === false) {
      throw new Error('Invalid Encoding')
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
  toBytes(): Buffer {
    return this.buf
  }

  /**
   * equals checks that two IDs are the same.
   * @param o The other Thread ID.
   */
  equals(o: ThreadID): boolean {
    return this.buf.equals(o.buf)
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
    let copy = Buffer.from(this.buf)
    decode(copy)
    copy = copy.slice(decode.bytes)
    return decode(copy)
  }

  /**
   * toString returns the (multibase encoded) string representation of an ID.
   * @param base Name of the base to use for encoding. Defaults to 'base32'.
   */
  toString(base: Name = 'base32'): string {
    switch (this.version()) {
      case ThreadID.V1:
        return multibase.encode(base, this.buf).toString()
      default:
        throw new Error('unknown ID version.')
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace ThreadID {
  /**
   * Versions. Currently only V1 is supported.
   */
  export const V1 = 0x01

  /**
   * Variant denotes Thread variant. Currently only two variants are supported.
   */
  export enum Variant {
    Raw = 0x55,
    AccessControlled = 0x70, // Supports access control lists
  }
}

export { ThreadID }
