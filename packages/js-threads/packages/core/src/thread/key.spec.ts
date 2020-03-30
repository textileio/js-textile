import { expect } from 'chai'
import { Key } from './key'

describe('Thread Key', () => {
  it('should be able to create a random Key', () => {
    const k = Key.fromRandom()
    expect(k).to.have.ownProperty('service')
    expect(k).to.have.ownProperty('read')
  })

  it('should be able to create a network only key', () => {
    const k = Key.fromRandom(false)
    expect(k).to.have.ownProperty('service')
    expect(k.read).to.be.undefined
  })

  it('should be able to create a full key from an input Buffer', () => {
    const k1 = Key.fromRandom()
    const b = k1.toBytes()
    const k2 = Key.fromBytes(b)
    expect(k1.service.equals(k2.service)).to.be.true
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(k1.read?.equals(k2.read!)).to.be.true
  })

  it('should be able to create a network key from an input Buffer', () => {
    const k1 = Key.fromRandom(false)
    const b = k1.toBytes()
    const k2 = Key.fromBytes(b)
    expect(k1.service.equals(k2.service)).to.be.true
    expect(k1.read).to.be.undefined
  })

  it('should be able to create a full key from an input string', () => {
    const k1 = Key.fromRandom()
    const b = k1.toString()
    const k2 = Key.fromString(b)
    expect(k1.service.equals(k2.service)).to.be.true
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(k1.read?.equals(k2.read!)).to.be.true
  })

  it('should be able to create a network key from an input string', () => {
    const k1 = Key.fromRandom(false)
    const b = k1.toString()
    const k2 = Key.fromString(b)
    expect(k1.service.equals(k2.service)).to.be.true
    expect(k1.read).to.be.undefined
  })
})
