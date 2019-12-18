/* eslint-disable @typescript-eslint/no-var-requires */
import { encode, decode } from 'varint'

// @todo: find or create types for these
const multibase = require('multibase')
const randomBytes = require('iso-random-stream/src/random')

// Versions.
export const V1 = 0x01

// Variants denotes Thread variants. Currently only two variants are supported.
export enum Variants {
  Raw = 0x55,
  AccessControlled = 0x70, // Supports access control lists
}

// ID represents a self-describing thread identifier.
// It is formed by a Version, a Variant, and a random number of a given length.
export class ID {
  constructor(private buf: Buffer) {}
  static newRandom(variant: number, size: number) {
    // two 8 bytes (max) numbers plus random bytes
    const bytes = Buffer.concat([Buffer.from(encode(V1)), Buffer.from(encode(variant)), randomBytes(size)])
    return new ID(bytes)
  }

  // Decode parses an ID-encoded string and returns an ID object.
  // For IDV1, an ID-encoded string is primarily a multibase string:
  //
  //     <multibase-type-code><base-encoded-string>
  //
  // The base-encoded string represents a:
  //
  // <version><variant><random-number>
  static fromEncoded(v: string | Buffer): ID {
    if (v.length < 2) {
      throw new Error('id too short')
    }
    const data = multibase.decode(v)
    return ID.fromBytes(data)
  }

  // Cast takes an ID data slice, parses it and returns an ID.
  // For IDV1, the data buffer is in the form:
  //
  //     <version><variant><random-number>
  //
  // Please use fromEncoded when parsing a regular ID string, as fromBytes does not
  // expect multibase-encoded data. fromBytes accepts the output of ID.bytes().
  static fromBytes(data: Buffer): ID {
    let copy = Buffer.from(data)
    const version = decode(copy)
    if (version != 1) {
      throw new Error(`expected 1 as the id version number, got: ${version}.`)
    }
    copy = copy.slice(decode.bytes, copy.length)
    const variant = decode(copy)
    if (!(variant in Variants)) {
      throw new Error('invalid variant.')
    }
    const id = copy.slice(decode.bytes, copy.length)
    if (id.length < 16) {
      throw new Error('random component too small.')
    }
    return new ID(data)
  }

  // IsEncoded returns the multibase encoding for a multibase encoded string.
  // Returns the name of the encoding if it is encoded, and throws an error otherwise.
  static isEncoded(v: string): string {
    if (v.length < 2) {
      throw new Error('ID is too short.')
    }
    const encoding = multibase.isEncoded(v)
    // check encoding is valid
    if (encoding === false) {
      throw new Error('ID is not multibase encoded.')
    }
    return encoding
  }

  // Defined returns true if an ID is defined.
  // Calling any other methods on an undefined ID will result in undefined behavior.
  defined(): boolean {
    return this.buf.length > 0
  }

  // Bytes returns the byte representation of an ID.
  // The output of bytes can be parsed back into an ID with fromBytes().
  bytes(): Buffer {
    return this.buf
  }

  // Equals checks that two IDs are the same.
  equals(o: ID): boolean {
    return this.buf == o.buf
  }

  // toString returns the binary representation of the ID as a string.
  toString(): string {
    return this.buf.toString()
  }

  // Version returns the ID version.
  version(): number {
    return decode(this.buf)
  }

  // Variant returns the variant of an ID.
  variant(): number {
    let copy = Buffer.from(this.buf)
    decode(copy)
    copy = copy.slice(decode.bytes)
    return decode(copy)
  }

  // String returns the default string representation of an ID.
  // Currently, Base32 is used as the encoding for the multibase string.
  string(): string {
    switch (this.version()) {
      case V1:
        return multibase.encode('base32', this.buf).toString()
      default:
        throw new Error('unknown ID version')
    }
  }

  // String returns the string representation of an ID encoded is selected base.
  stringOfBase(base: string | number): string {
    switch (this.version()) {
      case V1:
        return multibase.encode(base, this.buf).toString()
      default:
        throw new Error('unknown ID version.')
    }
  }
}

// Undef can be used to represent a nil or undefined ID, using ID{} directly is also acceptable.
export const Undef = new ID(Buffer.alloc(0))
