import { aes } from '@textile/threads-crypto'
import { Block } from '@textile/threads-core'

export interface Options {
  codec: string
  algo: string
}

// NonceBytes is the length of GCM nonce.
export const nonceBytes = 12

// TagBytes is the length of the GCM tag component.
export const tagBytes = 16

// KeyBytes is the length of GCM key.
const keyBytes = 32

export const defaultOptions: Options = {
  codec: 'dag-cbor',
  algo: 'sha2-256',
}

/**
 * EncodeBlock returns a node by encrypting the block's raw bytes with key.
 * @param block The IPLD block to encrypt and encode.
 * @param key A random key of 32 bytes tto use for encryption.
 * @param opts Options to control encoding and encryption.
 * Defaults to CBOR encoding with the SHA256 hash function, and AES GCM 256-bit encryption.
 */
export async function encodeBlock(block: Block, key: Uint8Array, opts: Options = defaultOptions) {
  const plaintext = block.encodeUnsafe()
  const sk = key.slice(0, keyBytes)
  const ciphertext = await aes.encrypt(sk, plaintext)
  return Block.encoder(Buffer.from(ciphertext), opts.codec, opts.algo)
}

/**
 * DecodeBlock uses key to perform AES-256 GCM decryption on ciphertext.
 * @param block Ciphertext as Block.
 * @param key Encryption key.
 * @param opts Additional decoding options.
 */
export async function decodeBlock<T = any>(
  block: Block<Uint8Array>,
  key: Uint8Array,
  opts: Options = defaultOptions,
) {
  // Start with Block node wrapping raw encrypted bytes
  const ciphertext = block.decodeUnsafe()
  const sk = key.slice(0, keyBytes)
  const plaintext = await aes.decrypt(sk, ciphertext)
  return Block.decoder<T>(Buffer.from(plaintext), opts.codec, opts.algo)
}
