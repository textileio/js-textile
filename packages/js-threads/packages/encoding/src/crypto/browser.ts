import Base58 from 'bs58'

export async function decodeBlock(block: Buffer, key: string) {
  // Extract the tag from the payload
  const tag = block.slice(block.length - 16)
  const data = block.slice(0, block.length - 16)
  const keyiv = Base58.decode(key)
  const sk = keyiv.slice(0, 32)
  const iv = keyiv.slice(32)
  // specify algorithm to use
  const alg = { name: 'AES-GCM', iv: new Uint8Array(iv), length: 256, additionalData: tag, tagLength: 16 }
  const decipher = await crypto.subtle.importKey('raw', new Uint8Array(sk), alg, false, ['decrypt'])
  const decrypted = await crypto.subtle.decrypt(alg, decipher, new Uint8Array(data))
  return decrypted
}
