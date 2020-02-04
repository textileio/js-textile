// @todo: Move to using web-native crypto libs when run in browser
import crypto, { CipherGCMTypes } from 'crypto'
import { Block } from '@textile/threads-core'

export interface Options {
  codec: string
  algo: string
  cipher?: CipherGCMTypes
}

export const defaultOptions: Options = { codec: 'dag-cbor', algo: 'sha2-256', cipher: 'aes-256-gcm' }

/**
 * EncodeBlock returns a node by encrypting the block's raw bytes with key.
 * @param block The IPLD block to encrypt and encode.
 * @param keyiv A random key of length 44 bytes (32 bytes for key and 12 bytes for iv) to use for encryption.
 * @param opts Options to control encoding and encryption.
 * Defaults to CBOR encoding with the SHA256 hash function, and AES GCM 256-bit encryption.
 */
export function encodeBlock(block: Block, keyiv: Uint8Array, opts: Options = defaultOptions) {
  // Encode block as IPLD
  const data = block.encodeUnsafe()
  // Create key components to match Go version
  const sk = keyiv.slice(0, 32)
  const iv = keyiv.slice(32)
  const cipher = crypto.createCipheriv(opts.cipher || 'aes-256-gcm', sk, iv)
  let encrypted = cipher.update(data)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  const tag = cipher.getAuthTag()
  const payload = Buffer.concat([encrypted, tag])
  return Block.encoder(payload, opts.codec, opts.algo)
}

export function decodeBlock<T = any>(block: Block<Uint8Array>, keyiv: Uint8Array, opts: Options = defaultOptions) {
  // Start with Block node wrapping raw encrypted bytes
  const raw = block.decodeUnsafe()
  // Extract the tag from the payload
  const tag = raw.slice(raw.length - 16)
  const cipher = raw.slice(0, raw.length - 16)
  const sk = keyiv.slice(0, 32)
  const iv = keyiv.slice(32)

  const decipher = crypto.createDecipheriv(opts.cipher || 'aes-256-gcm', sk, iv)
  decipher.setAuthTag(tag)
  const decrypted = decipher.update(cipher)
  return Block.decoder<T>(decrypted, opts.codec, opts.algo)
}
