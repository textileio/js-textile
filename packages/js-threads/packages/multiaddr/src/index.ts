import Multiaddr from "multiaddr"
import * as codec from "./codec"

export function bytesFromAddr(
  addr: string | Uint8Array | Multiaddr
): Uint8Array {
  // default
  if (addr == null) {
    addr = ""
  }

  let bytes: Uint8Array = new Uint8Array(0)

  if (addr instanceof Uint8Array) {
    bytes = codec.fromBytes(addr)
  } else if (typeof addr === "string") {
    if (addr.length > 0 && addr.charAt(0) !== "/") {
      throw new Error(`multiaddr "${addr}" must start with a "/"`)
    }
    bytes = codec.fromString(addr)
  } else if (addr.bytes && addr.protos && addr.protoCodes) {
    // Multiaddr
    bytes = codec.fromBytes(addr.bytes) // validate + copy bytes
  } else {
    throw new Error("addr must be a string, Uint8Array, or another Multiaddr")
  }
  return bytes
}

export function stringFromBytes(bytes: Uint8Array): string {
  return codec.bytesToString(bytes)
}

export function bytesToTuples(bytes: Uint8Array): [number, string | number][] {
  const t = codec.bytesToTuples(bytes)
  return codec.tuplesToStringTuples(t)
}

export function bytesToOptions(
  bytes: Uint8Array
): {
  family: string
  host: string
  transport: string
  port: number
} {
  const parsed = stringFromBytes(bytes).split("/")
  const opts = {
    family: parsed[1] === "ip4" ? "ipv4" : "ipv6",
    host: parsed[2],
    transport: parsed[3],
    port: parseInt(parsed[4]),
  }
  return opts
}
