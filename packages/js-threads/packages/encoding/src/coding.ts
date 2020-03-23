// @todo: Move to using web-native crypto libs when run in browser
import crypto, { CipherGCMTypes, randomBytes } from 'crypto'
import { Block } from '@textile/threads-core'

export interface Options {
  codec: string
  algo: string
  cipher?: CipherGCMTypes
}

// NonceBytes is the length of GCM nonce.
const nonceBytes = 12

const tagBytes = 16

// KeyBytes is the length of GCM key.
const keyBytes = 32

export const defaultOptions: Options = { codec: 'dag-cbor', algo: 'sha2-256', cipher: 'aes-256-gcm' }

/**
 * EncodeBlock returns a node by encrypting the block's raw bytes with key.
 * @param block The IPLD block to encrypt and encode.
 * @param key A random key of 32 bytes tto use for encryption.
 * @param opts Options to control encoding and encryption.
 * Defaults to CBOR encoding with the SHA256 hash function, and AES GCM 256-bit encryption.
 */
export function encodeBlock(block: Block, key: Uint8Array, opts: Options = defaultOptions) {
  // Encode block as IPLD
  const data = block.encodeUnsafe()
  // Create key components to match Go version
  const sk = key.slice(0, keyBytes)
  const iv = randomBytes(nonceBytes)
  const cipher = crypto.createCipheriv(opts.cipher || 'aes-256-gcm', sk, iv)
  let encrypted = cipher.update(data)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  const tag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, encrypted, tag])
  return Block.encoder(payload, opts.codec, opts.algo)
}

/**
 * DecodeBlock uses key to perform AES-256 GCM decryption on ciphertext.
 * @param block Ciphertext as Block.
 * @param key Encryption key.
 * @param opts Additional decoding options.
 */
export function decodeBlock<T = any>(block: Block<Uint8Array>, key: Uint8Array, opts: Options = defaultOptions) {
  // Start with Block node wrapping raw encrypted bytes
  const raw = block.decodeUnsafe()
  // Extract the tag from the payload
  const tag = raw.slice(raw.length - tagBytes)
  const cipher = raw.slice(nonceBytes, raw.length - tagBytes)
  const sk = key.slice(0, keyBytes)
  const iv = raw.slice(0, nonceBytes)

  const decipher = crypto.createDecipheriv(opts.cipher || 'aes-256-gcm', sk, iv)
  decipher.setAuthTag(tag)
  const decrypted = decipher.update(cipher)
  return Block.decoder<T>(decrypted, opts.codec, opts.algo)
}
