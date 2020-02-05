import { keys, PublicKey, PrivateKey } from 'libp2p-crypto'

export * from './thread'
export * from './service'
export { Block } from './ipld'

export const marshalKey = (key: PublicKey | PrivateKey) => {
  const marshalled = (key as PrivateKey).public
    ? keys.marshalPrivateKey(key as PrivateKey)
    : keys.marshalPublicKey(key as PublicKey)
  return marshalled
}
