import { ThreadID } from "@textile/threads-id"
import { Buffer } from "buffer"
import varint from "varint"
import { protocols } from "./protocols"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Convert = require("multiaddr/src/convert")

function thread2buf(str: string) {
  // const buf = Buffer.from(str)
  const buf = ThreadID.fromString(str).toBytes()
  const size = Buffer.from(varint.encode(buf.length))
  return Buffer.concat([size, buf])
}

function buf2thread(buf: Buffer) {
  const size = varint.decode(buf)
  buf = buf.slice(varint.decode.bytes)

  if (buf.length !== size) {
    throw new Error("inconsistent lengths")
  }

  return ThreadID.fromBytes(buf).toString()
}

export function toString(prt: string | number, buf: Buffer): string {
  const proto = protocols(prt)
  switch (proto.code) {
    case 406:
      return buf2thread(buf)
    default:
      return Convert.toString(prt, buf)
  }
}

export function toBuffer(prt: string | number, str: string): Buffer {
  const proto = protocols(prt)
  switch (proto.code) {
    case 406:
      return thread2buf(str)
    default:
      return Convert.toBuffer(prt, str)
  }
}
