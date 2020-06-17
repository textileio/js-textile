import randombytes from '@consento/sync-randombytes'

export * as keys from './keys'
export * from './interfaces'
export * as aes from 'micro-aes-gcm'
export * as sha256 from 'fast-sha256'
export { multihash, sha256Multihash } from './utils'

export const randomBytes = (byteLength: number) => {
  return randombytes(new Uint8Array(byteLength))
}
