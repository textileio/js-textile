import { keys, PrivateKey, PublicKey } from 'libp2p-crypto'

export * from '@textile/threads-id'
export * from './thread'
export * from './network'
export { Multiaddr } from './multiaddr'
export { Block } from './ipld'

export const marshalKey = (key: PublicKey | PrivateKey) => {
  return (key as PrivateKey).public
    ? keys.marshalPrivateKey(key as PrivateKey)
    : keys.marshalPublicKey(key as PublicKey)
}
