import { keys, PrivateKey, PublicKey } from "@textile/threads-crypto"

export * from "./identity"
export * from "./thread"

export const marshalKey = (key: PublicKey | PrivateKey): Uint8Array => {
  return (key as PrivateKey).public
    ? keys.marshalPrivateKey(key as PrivateKey)
    : keys.marshalPublicKey(key as PublicKey)
}
