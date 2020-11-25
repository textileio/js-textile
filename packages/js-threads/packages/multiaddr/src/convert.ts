import { ThreadID } from "@textile/threads-id"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import varint from "varint"
import { protocols } from "./protocols"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Convert = require("multiaddr/src/convert")

function thread2bytes(str: string) {
  const buf = ThreadID.fromString(str).toBytes()
  const size = varint.encode(buf.length)
  return Uint8Array.from([...size, ...buf])
}

function bytes2thread(buf: Uint8Array) {
  const size = varint.decode(buf as any)
  buf = buf.slice(varint.decode.bytes)

  if (buf.length !== size) {
    throw new Error("inconsistent lengths")
  }

  return ThreadID.fromBytes(buf).toString()
}

export function toString(prt: string | number, buf: Uint8Array): string {
  const proto = (protocols as any)(prt)
  switch (proto.code) {
    case 406:
      return bytes2thread(buf)
    default:
      return Convert.toString(prt, buf)
  }
}

export function toBytes(prt: string | number, str: string): Uint8Array {
  const proto = (protocols as any)(prt)
  switch (proto.code) {
    case 406:
      return thread2bytes(str)
    default:
      return Convert.toBytes(prt, str)
  }
}
