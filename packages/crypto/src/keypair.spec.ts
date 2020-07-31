import { expect } from 'chai'
import { PrivateKey, PublicKey } from './keypair'
import { encrypt, decrypt } from './utils'

describe('Keypair', () => {
  it('should be able to serialize and recover identities', async () => {
    const id = PrivateKey.fromRandom()
    const str = id.toString()
    const back = PrivateKey.fromString(str)
    expect(id).to.deep.equal(back)
  })

  describe('Signatures', () => {
    it('should be able to verify signature', async () => {
      const id = PrivateKey.fromRandom()
      const msg = new TextEncoder().encode('teststring')
      const sig = await id.sign(msg)
      const verify = await id.public.verify(msg, sig)
      expect(verify).to.be.true
    })
  })

  describe('Encryption', () => {
    const id = PrivateKey.fromRandom()
    it('should be able to encrypt/decrypt using keypair/identity', async () => {
      const msg = new TextEncoder().encode('teststring')
      const ciphertext = await id.public.encrypt(msg)
      const plaintext = await id.decrypt(ciphertext)
      expect(plaintext).to.deep.equal(msg)
    })

    it('should be able to encrypt/decrypt using separate keys', async () => {
      // Someone else
      const privKey = PrivateKey.fromRandom()

      // They send me this...
      const publicKey = privKey.public.toString()

      // I encode a message...
      const msg = new TextEncoder().encode('howdy!')

      // I decode their key...
      const pubKey = PublicKey.fromString(publicKey)

      // I encrypt it...
      const ciphertext = await encrypt(msg, pubKey.pubKey) // Don't use bytes!

      // They decrypt it...
      const plaintext = await decrypt(ciphertext, privKey.privKey)

      expect(plaintext).to.deep.equal(msg)
    })
  })
})
