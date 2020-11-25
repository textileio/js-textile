import { expect } from "chai"
import { ThreadKey } from "./key"

describe("ThreadKey", function () {
  it("should be able to create a random ThreadKey", function () {
    const k = ThreadKey.fromRandom()
    expect(k).to.have.ownProperty("service")
    expect(k).to.have.ownProperty("read")
  })

  it("should be able to create a network only key", function () {
    const k = ThreadKey.fromRandom(false)
    expect(k).to.have.ownProperty("service")
    expect(k.read).to.be.undefined
  })

  it("should be able to create a full key from input bytes", function () {
    const k1 = ThreadKey.fromRandom()
    const b = k1.toBytes()
    const k2 = ThreadKey.fromBytes(b)
    expect(k1.service).to.eql(k2.service)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(k1.read).to.eql(k2.read)
  })

  it("should be able to create a network key from input bytes", function () {
    const k1 = ThreadKey.fromRandom(false)
    const b = k1.toBytes()
    const k2 = ThreadKey.fromBytes(b)
    expect(k1.service).to.eql(k2.service)
    expect(k1.read).to.be.undefined
  })

  it("should be able to create a full key from an input string", function () {
    const k1 = ThreadKey.fromRandom()
    const b = k1.toString()
    const k2 = ThreadKey.fromString(b)
    expect(k1.service).to.eql(k2.service)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(k1.read).to.eql(k2.read)
  })

  it("should be able to create a network key from an input string", function () {
    const k1 = ThreadKey.fromRandom(false)
    const b = k1.toString()
    const k2 = ThreadKey.fromString(b)
    expect(k1.service).to.eql(k2.service)
    expect(k1.read).to.be.undefined
  })
})
