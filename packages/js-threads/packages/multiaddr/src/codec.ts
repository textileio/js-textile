/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
// @ts-ignore
import varint from "varint"
import * as convert from "./convert"
import { protocols } from "./protocols"

// string -> [[str name, str addr]... ]
function stringToStringTuples(str: string) {
  const tuples = []
  const parts = str.split("/").slice(1) // skip first empty elem
  if (parts.length === 1 && parts[0] === "") {
    return []
  }

  for (let p = 0; p < parts.length; p++) {
    const part = parts[p]
    const proto = (protocols as any)(part)

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
function stringTuplesToString(tuples: any[]) {
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

// [[str name, str addr]... ] -> [[int code, Uint8Array]... ]
function stringTuplesToTuples(tuples: any[]) {
  return tuples.map((tup) => {
    if (!Array.isArray(tup)) {
      tup = [tup]
    }
    const proto = protoFromTuple(tup)
    if (tup.length > 1) {
      return [proto.code, convert.toBytes(proto.code, tup[1])]
    }
    return [proto.code]
  })
}

// [[int code, Uint8Array]... ] -> [[str name, str addr]... ]
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function tuplesToStringTuples(tuples: any): [number, string | number][] {
  return tuples.map((tup: any) => {
    const proto = protoFromTuple(tup)
    if (tup.length > 1) {
      return [proto.code, convert.toString(proto.code, tup[1])]
    }
    return [proto.code]
  })
}

// [[int code, Uint8Array ]... ] -> Uint8Array
function tuplesToBytes(tuples: any[]) {
  return fromBytes(
    new Uint8Array(
      tuples.flatMap((tup) => {
        const proto = protoFromTuple(tup)
        let buf = Uint8Array.from(varint.encode(proto.code))
        if (tup.length > 1) {
          buf = new Uint8Array([...buf, ...tup[1]]) // add address bytes
        }
        return [...buf]
      })
    )
  )
}

function sizeForAddr(p: any, addr: any) {
  if (p.size > 0) {
    return p.size / 8
  } else if (p.size === 0) {
    return 0
  } else {
    const size = varint.decode(addr)
    return size + varint.decode.bytes
  }
}

// Uint8Array -> [[int code, Uint8Array ]... ]
export function bytesToTuples(buf: Uint8Array): [number, Uint8Array][] {
  const tuples: [number, Uint8Array][] = []
  let i = 0
  while (i < buf.length) {
    const code = varint.decode(buf, i)
    const n = varint.decode.bytes

    const p = (protocols as any)(code)

    const size = sizeForAddr(p, buf.slice(i + n))

    if (size === 0) {
      tuples.push([code] as any)
      i += n
      continue
    }

    const addr = buf.slice(i + n, i + n + size)

    i += size + n

    if (i > buf.length) {
      // did not end _exactly_ at buf.length
      throw ParseError("Invalid address Uint8Array")
    }

    // ok, tuple seems good.
    tuples.push([code, addr])
  }

  return tuples
}

// Uint8Array -> String
export function bytesToString(buf: Uint8Array): string {
  const a = bytesToTuples(buf)
  const b = tuplesToStringTuples(a)
  return stringTuplesToString(b)
}

// String -> Uint8Array
function stringToBytes(str: string) {
  str = cleanPath(str)
  const a = stringToStringTuples(str)
  const b = stringTuplesToTuples(a)

  return tuplesToBytes(b)
}

// String -> Uint8Array
export function fromString(str: string): Uint8Array {
  return stringToBytes(str)
}

// Uint8Array -> Uint8Array
export function fromBytes(buf: Uint8Array): Uint8Array {
  const err = validateBytes(buf)
  if (err) throw err
  return Uint8Array.from(buf) // copy
}

function validateBytes(buf: Uint8Array) {
  try {
    bytesToTuples(buf) // try to parse. will throw if breaks
  } catch (err) {
    return err
  }
}

function cleanPath(str: string) {
  return (
    "/" +
    str
      .trim()
      .split("/")
      .filter((a) => a)
      .join("/")
  )
}

function ParseError(str: string) {
  return new Error("Error parsing address: " + str)
}

function protoFromTuple(tup: (string | number)[]) {
  const proto = (protocols as any)(tup[0])
  return proto
}
