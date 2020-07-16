import randombytes from "@consento/sync-randombytes"

export * as sha256 from "fast-sha256"
export * as aes from "micro-aes-gcm"
export * from "./interfaces"
export * as keys from "./keys"
export { multihash, sha256Multihash } from "./utils"

export const randomBytes = (byteLength: number): Uint8Array => {
  return randombytes(new Uint8Array(byteLength))
}
