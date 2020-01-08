import { expect } from 'chai'
import { ThreadID, Variant, V1 } from './id'

describe('Thread ID', () => {
  it('should be able to create a random ID', () => {
    const i = ThreadID.fromRandom(Variant.Raw, 16)
    expect(i).to.not.be.undefined
    expect(i.bytes()).to.have.length(18)
    expect(i.defined()).to.be.true
  })
  it('should decode an ID from a base-32 encoded string', () => {
    const i = ThreadID.fromRandom(Variant.Raw, 32)
    // console.log(`New ID: ${i.string()}`)
    const j = ThreadID.fromEncoded(i.string())
    // console.log(`Decoded ID: ${j.string()}`)
    expect(i.string()).to.equal(j.string())
  })
  it('should be able to extract the encoding', () => {
    const i = ThreadID.fromRandom(Variant.Raw, 16)
    const e = ThreadID.isEncoded(i.string())
    expect(e).to.equal('base32')
    // console.log(`Encoding: ${e}`)
  })
  it('should have a valid version number', () => {
    const i = ThreadID.fromRandom(Variant.Raw, 16)
    const v = i.version()
    expect(v).to.equal(V1)
    // console.log(`Version: ${v}`)
  })
  it('should have a valid variant number', () => {
    let i = ThreadID.fromRandom(Variant.Raw, 16)
    let v = i.variant()
    expect(v).to.equal(Variant.Raw)
    // console.log(`Variant: ${v}`)

    i = ThreadID.fromRandom(Variant.AccessControlled, 32)
    v = i.variant()
    expect(v).to.equal(Variant.AccessControlled)
    // console.log(`Variant: ${v}`)
  })
  it('should be able to round-trip to and from bytes', () => {
    const i = ThreadID.fromRandom(Variant.Raw, 16)
    const b = i.bytes()
    const n = ThreadID.fromBytes(b)
    expect(n).to.deep.equal(i)
    expect(i.equals(n)).to.be.true
  })
})
