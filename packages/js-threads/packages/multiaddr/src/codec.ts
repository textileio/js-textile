/* eslint-disable @typescript-eslint/no-use-before-define */
import varint from "varint"
import * as convert from "./convert"
import { Protocol, protocols } from "./protocols"

// string -> [[str name, str addr]... ]
export function stringToStringTuples(str: string): string[][] {
  const tuples = []
  const parts = str.split("/").slice(1) // skip first empty elem
  if (parts.length === 1 && parts[0] === "") {
    return []
  }

  for (let p = 0; p < parts.length; p++) {
    const part = parts[p]
    const proto = protocols(part)

    if (proto.size === 0) {
      tuples.push([part])
      continue
    }

    p++ // advance addr part
    if (p >= parts.length) {
      throw ParseError("invalid address: " + str)
    }

    // if it's a path proto, take the rest
    if (proto.path) {
      tuples.push([
        part,
        // TODO: should we need to check each path part to see if it's a proto?
        // This would allow for other protocols to be added after a unix path,
        // however it would have issues if the path had a protocol name in the path
        cleanPath(parts.slice(p).join("/")),
      ])
      break
    }

    tuples.push([part, parts[p]])
  }

  return tuples
}

// [[str name, str addr]... ] -> string
export function stringTuplesToString(tuples: string[][]): string {
  const parts: string[] = []
  tuples.map((tup) => {
    const proto = protoFromTuple(tup)
    parts.push(proto.name)
    if (tup.length > 1) {
      parts.push(tup[1])
    }
  })

  return cleanPath(parts.join("/"))
}

// [[str name, str addr]... ] -> [[int code, Buffer]... ]
export function stringTuplesToTuples(tuples: string[][]): any[][] {
  return tuples.map((tup) => {
    if (!Array.isArray(tup)) {
      tup = [tup]
    }
    const proto = protoFromTuple(tup)
    if (tup.length > 1) {
      return [proto.code, convert.toBuffer(proto.code, tup[1])]
    }
    return [proto.code]
  })
}

// [[int code, Buffer]... ] -> [[str name, str addr]... ]
export function tuplesToStringTuples(tuples: any[][]): any[][] {
  return tuples.map((tup) => {
    const proto = protoFromTuple(tup)
    if (tup.length > 1) {
      return [proto.code, convert.toString(proto.code, tup[1])]
    }
    return [proto.code]
  })
}

// [[int code, Buffer ]... ] -> Buffer
export function tuplesToBuffer(tuples: any[][]): Buffer {
  return fromBuffer(
    Buffer.concat(
      tuples.map((tup) => {
        const proto = protoFromTuple(tup)
        let buf = Buffer.from(varint.encode(proto.code))

        if (tup.length > 1) {
          buf = Buffer.concat([buf, tup[1]]) // add address buffer
        }

        return buf
      })
    )
  )
}

export function sizeForAddr(p: Protocol, addr: number[] | Buffer): number {
  if (p.size > 0) {
    return p.size / 8
  } else if (p.size === 0) {
    return 0
  } else {
    const size = varint.decode(addr)
    return size + varint.decode.bytes
  }
}

// Buffer -> [[int code, Buffer ]... ]
export function bufferToTuples(buf: Buffer): (number | Buffer)[][] {
  const tuples = []
  let i = 0
  while (i < buf.length) {
    const code = varint.decode(buf, i)
    const n = varint.decode.bytes

    const p = protocols(code)

    const size = sizeForAddr(p, buf.slice(i + n))

    if (size === 0) {
      tuples.push([code])
      i += n
      continue
    }

    const addr = buf.slice(i + n, i + n + size)

    i += size + n

    if (i > buf.length) {
      // did not end _exactly_ at buffer.length
      throw ParseError("Invalid address buffer: " + buf.toString("hex"))
    }

    // ok, tuple seems good.
    tuples.push([code, addr])
  }

  return tuples
}

// Buffer -> String
export function bufferToString(buf: Buffer): string {
  const a = bufferToTuples(buf)
  const b = tuplesToStringTuples(a)
  return stringTuplesToString(b)
}

// String -> Buffer
export function stringToBuffer(str: string): Buffer {
  str = cleanPath(str)
  const a = stringToStringTuples(str)
  const b = stringTuplesToTuples(a)

  return tuplesToBuffer(b)
}

// String -> Buffer
export function fromString(str: string): Buffer {
  return stringToBuffer(str)
}

// Buffer -> Buffer
export function fromBuffer(buf: Buffer): Buffer {
  const err = validateBuffer(buf)
  if (err) throw err
  return Buffer.from(buf) // copy
}

function validateBuffer(buf: Buffer): any {
  try {
    bufferToTuples(buf) // try to parse. will throw if breaks
  } catch (err) {
    return err
  }
}

export function isValidBuffer(buf: Buffer): boolean {
  return validateBuffer(buf) === undefined
}

export function cleanPath(str: string): string {
  return (
    "/" +
    str
      .trim()
      .split("/")
      .filter((a) => a)
      .join("/")
  )
}

export function ParseError(str: string): Error {
  return new Error("Error parsing address: " + str)
}

export function protoFromTuple(tup: any[]): Protocol {
  const proto = protocols(tup[0])
  return proto
}
