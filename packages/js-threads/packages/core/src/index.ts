import { keys, PrivateKey, PublicKey } from "@textile/threads-crypto"

export * from "@textile/multiaddr"
export * from "@textile/threads-id"
export * from "./identity"
export { Block } from "./ipld"
export * from "./network"
export * from "./thread"

export const marshalKey = (key: PublicKey | PrivateKey): Uint8Array => {
  return (key as PrivateKey).public
    ? keys.marshalPrivateKey(key as PrivateKey)
    : keys.marshalPublicKey(key as PublicKey)
}
