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
    const j = ThreadID.fromEncoded(i.string())
    expect(i.string()).to.equal(j.string())
  })
  it('should be able to extract the encoding', () => {
    const i = ThreadID.fromRandom(Variant.Raw, 16)
    const e = ThreadID.isEncoded(i.string())
    expect(e).to.equal('base32')
  })
  it('should have a valid version number', () => {
    const i = ThreadID.fromRandom(Variant.Raw, 16)
    const v = i.version()
    expect(v).to.equal(V1)
  })
  it('should have a valid variant number', () => {
    let i = ThreadID.fromRandom(Variant.Raw, 16)
    let v = i.variant()
    expect(v).to.equal(Variant.Raw)

    i = ThreadID.fromRandom(Variant.AccessControlled, 32)
    v = i.variant()
    expect(v).to.equal(Variant.AccessControlled)
  })
  it('should be able to round-trip to and from bytes', () => {
    const i = ThreadID.fromRandom(Variant.Raw, 16)
    const b = i.bytes()
    const n = ThreadID.fromBytes(b)
    expect(n).to.deep.equal(i)
    expect(i.equals(n)).to.be.true
  })
})
