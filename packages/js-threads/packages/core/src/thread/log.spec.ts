import { expect } from 'chai'
import { keys } from '@textile/threads-crypto'
import { LogID } from './log'

describe('LogID', () => {
  it('create a new id', async () => {
    const id = await LogID.fromRandom(64)
    expect(id.toB58String().length).to.equal(52)
  })

  it('round-trip bytes', async () => {
    const id1 = await LogID.fromRandom(64)
    const bytes = id1.toBytes()
    const id2 = LogID.fromBytes(bytes)
    expect(id1.toB58String()).to.equal(id2.toB58String())
    expect(id2.toBytes()).to.deep.equal(id1.toBytes())
  })

  it('rount-trip string', async () => {
    const id1 = await LogID.fromRandom(64)
    const string = id1.toB58String()
    const id2 = LogID.fromB58String(string)
    expect(id1.toB58String()).to.equal(id2.toB58String())
    expect(id2.toBytes()).to.deep.equal(id1.toBytes())
  })

  it('rount-trip public key', async () => {
    const key = await keys.generateKeyPair('Ed25519')
    const id1 = await LogID.fromPublicKey(key.public)
    expect(id1.marshalPubKey()).to.deep.equal(key.public.bytes)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const id2 = await LogID.fromPublicKey(id1.marshalPubKey()!)
    expect(id1.id).to.deep.equal(id2.id)
  })

  it('round-trip private key', async () => {
    const key = await keys.generateKeyPair('Ed25519')
    const id = await LogID.fromPrivateKey(key)
    expect(id.marshalPrivKey()).to.deep.equal(key.bytes)
  })

  it('Works with default options', async function () {
    const id = await LogID.fromRandom()
    expect(id.toB58String().length).to.equal(52)
  })

  it('Non-default # of bytes', async function () {
    const shortId = await LogID.fromRandom(64)
    const longId = await LogID.fromRandom(128)
    expect(shortId.privKey?.bytes.length).is.below(longId.privKey?.bytes.length ?? Infinity)
  })

  it('equals', async () => {
    const ids = await Promise.all([LogID.fromRandom(64), LogID.fromRandom(64)])

    expect(ids[0].equals(ids[0])).to.equal(true)
    expect(ids[0].equals(ids[1])).to.equal(false)
    expect(ids[0].equals(ids[0].id)).to.equal(true)
    expect(ids[0].equals(ids[1].id)).to.equal(false)
  })
})
