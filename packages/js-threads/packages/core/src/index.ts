import { keys, PrivateKey, PublicKey } from 'libp2p-crypto'

export * from '@textile/threads-id'
export * from '@textile/multiaddr'
export * from './thread'
export * from './network'
export { Block } from './ipld'

export const marshalKey = (key: PublicKey | PrivateKey) => {
  return (key as PrivateKey).public
    ? keys.marshalPrivateKey(key as PrivateKey)
    : keys.marshalPublicKey(key as PublicKey)
}
