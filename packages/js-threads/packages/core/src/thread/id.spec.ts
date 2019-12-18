import { expect } from 'chai'
import { ID, Variants, V1 } from './id'

describe('Thread ID', () => {
  it('should be able to create a random ID', async () => {
    const i = ID.newRandom(Variants.Raw, 16)
    expect(i).to.not.be.undefined
    expect(i.bytes()).to.have.length(18)
    expect(i.defined()).to.be.true
  })
  it('should decode an ID from a base-32 encoded string', async () => {
    const i = ID.newRandom(Variants.Raw, 32)
    console.log(`New ID: ${i.string()}`)
    const j = ID.fromEncoded(i.string())
    console.log(`Decoded ID: ${j.string()}`)
    expect(i.string()).to.equal(j.string())
  })
  it('should be able to extract the encoding', async () => {
    const i = ID.newRandom(Variants.Raw, 16)
    const e = ID.isEncoded(i.string())
    expect(e).to.equal('base32')
    console.log(`Encoding: ${e}`)
  })
  it('should have a valid version number', async () => {
    const i = ID.newRandom(Variants.Raw, 16)
    const v = i.version()
    expect(v).to.equal(V1)
    console.log(`Version: ${v}`)
  })
  it('should have a valid variant number', async () => {
    let i = ID.newRandom(Variants.Raw, 16)
    let v = i.variant()
    expect(v).to.equal(Variants.Raw)
    console.log(`Variant: ${v}`)

    i = ID.newRandom(Variants.AccessControlled, 32)
    v = i.variant()
    expect(v).to.equal(Variants.AccessControlled)
    console.log(`Variant: ${v}`)
  })
  it('should be able to round-trip to and from bytes', async () => {
    const i = ID.newRandom(Variants.Raw, 16)
    const b = i.bytes()
    const n = ID.fromBytes(b)
    expect(n).to.deep.equal(i)
    expect(i.equals(n)).to.be.true
  })
})
