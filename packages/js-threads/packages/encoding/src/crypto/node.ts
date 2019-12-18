/* eslint-disable @typescript-eslint/no-var-requires */
import crypto from 'crypto'
import Base58 from 'bs58'

// @todo: Find or create types for this package
const Block = require('@ipld/block')

export interface CodecOptions {
  codec: string
  algo: string
}

export const defaultCodecOpts = { codec: 'dag-cbor', algo: 'sha2-256' }

export async function decodeBlock(data: Buffer, key: string, opts: CodecOptions = defaultCodecOpts) {
  // Start with an IPLD node wrapping raw encrypted bytes
  const cipherText: Buffer = Block.decoder(data, opts.codec, opts.algo).decode()
  // Extract the tag from the payload
  const tag = cipherText.slice(cipherText.length - 16)
  const cipher = cipherText.slice(0, cipherText.length - 16)
  const keyiv = Base58.decode(key)
  const sk = keyiv.slice(0, 32)
  const iv = keyiv.slice(32)

  const decipher = crypto.createDecipheriv('aes-256-gcm', sk, iv)
  decipher.setAuthTag(tag)
  const decrypted = decipher.update(cipher)
  // Return decoded IPLD Node as an object
  return Block.decoder(decrypted, opts.codec, opts.algo).decode()
}

export async function encodeBlock(obj: any, key?: string, opts: CodecOptions = defaultCodecOpts) {
  const data = Block.encoder(obj, opts.codec, opts.algo).encode()

  const keyiv = key ? Base58.decode(key) : crypto.randomBytes(44)
  const sk = keyiv.slice(0, 32)
  const iv = keyiv.slice(32)

  const cipher = crypto.createCipheriv('aes-256-gcm', sk, iv)
  let encrypted = cipher.update(data)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  const tag = cipher.getAuthTag()
  const payload = Buffer.concat([encrypted, tag])
  return Block.encoder(payload, opts.codec, opts.algo)
}

export async function createEvent(body: any, readKey: string, key?: string, opts: CodecOptions = defaultCodecOpts) {
  const keyiv = key ? key : Base58.encode(crypto.randomBytes(44))
  const codedBody = await encodeBlock(body, keyiv)
  const header = {
    key: Base58.decode(keyiv), // Single-use symmetric key
    time: Math.round(new Date().getTime() / 1000), // Unix seconds since epoch
  }
  const codedHeader = await encodeBlock(header, readKey, opts)
  return { body: codedBody, header: codedHeader }
}
