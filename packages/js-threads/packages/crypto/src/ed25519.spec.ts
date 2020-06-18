import chai, { expect } from 'chai'
import dirtyChai from 'dirty-chai'
import * as ed25519 from './ed25519'
import * as fixtures from './spec.fixtures'
import * as crypto from './index'

chai.use(dirtyChai)

describe('ed25519', function () {
  let key: crypto.PrivateKey
  before(async () => {
    key = await crypto.keys.generateKeyPair('Ed25519')
  })

  it('generates a valid key', async () => {
    expect(key).to.be.an.instanceof(ed25519.Ed25519PrivateKey)
    const digest = await key.hash()
    expect(digest).to.have.length(34)
  })

  it('signs', async () => {
    const text = crypto.randomBytes(512)
    const sig = await key.sign(text)
    const res = await key.public.verify(text, sig)
    expect(res).to.be.eql(true)
  })

  it('encoding', async () => {
    const keyMarshal = key.marshal()
    const key2 = await ed25519.unmarshalEd25519PrivateKey(keyMarshal)
    const keyMarshal2 = key2.marshal()

    expect(keyMarshal).to.eql(keyMarshal2)

    expect(key.equals(key2)).to.eql(true)

    const pk = key.public
    const pkMarshal = pk.marshal()
    const pk2 = ed25519.unmarshalEd25519PublicKey(pkMarshal)
    const pkMarshal2 = pk2.marshal()

    expect(pkMarshal).to.eql(pkMarshal2)
  })

  it('key id', async () => {
    const id = await key.id()
    expect(id).to.exist()
    expect(id).to.be.a('string')
  })

  describe('key equals', () => {
    it('equals itself', () => {
      expect(key.equals(key)).to.eql(true)

      expect(key.public.equals(key.public)).to.eql(true)
    })

    it('not equals other key', async () => {
      const key2 = await crypto.keys.generateKeyPair('Ed25519')
      expect(key.equals(key2)).to.eql(false)
      expect(key2.equals(key)).to.eql(false)
      expect(key.public.equals(key2.public)).to.eql(false)
      expect(key2.public.equals(key.public)).to.eql(false)
    })
  })

  it('sign and verify', async () => {
    const data = Buffer.from('hello world')
    const sig = await key.sign(data)
    const valid = await key.public.verify(data, sig)
    expect(valid).to.eql(true)
  })

  it('fails to verify for different data', async () => {
    const data = Buffer.from('hello world')
    const sig = await key.sign(data)
    const valid = await key.public.verify(Buffer.from('hello'), sig)
    expect(valid).to.be.eql(false)
  })

  describe('go interop', () => {
    let privateKey: crypto.PrivateKey

    before(async () => {
      privateKey = await crypto.keys.unmarshalPrivateKey(new Uint8Array(fixtures.verify.privateKey))
    })

    it('marshals the same as go', async () => {
      const key = new Uint8Array(fixtures.verify.privateKey)
      const out1 = crypto.keys.marshalPrivateKey(privateKey, 'ED25519')
      const out2 = privateKey.bytes
      // Slice hack to check only the key bytes
      expect(out1.slice(4, 68)).to.eql(key.slice(4))
      expect(key.slice(4)).to.eql(out2.slice(4, 68))
    })

    it('verifies with data from go', async () => {
      const key = crypto.keys.unmarshalPublicKey(new Uint8Array(fixtures.verify.publicKey))
      const data = new Uint8Array(fixtures.verify.data)
      const sig = new Uint8Array(fixtures.verify.signature)
      const ok1 = await key.verify(data, sig)
      expect(ok1).to.eql(true)

      const ok2 = await privateKey.public.verify(data, sig)
      expect(ok2).to.eql(true)
    })

    it('generates the same signature as go', async () => {
      const sig = await privateKey.sign(new Uint8Array(fixtures.verify.data))
      expect(sig).to.eql(new Uint8Array(fixtures.verify.signature))
    })
  })
})
