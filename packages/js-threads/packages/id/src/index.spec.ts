import { expect } from "chai"
import { ThreadID } from "."

describe("Thread ID", () => {
  it("should be able to create a random ID", () => {
    const i = ThreadID.fromRandom(ThreadID.Variant.Raw, 16)
    expect(i).to.not.be.undefined
    expect(i.toBytes()).to.have.length(18)
    expect(i.isDefined()).to.be.true
  })
  it("should decode an ID from a base-32 encoded string", () => {
    const i = ThreadID.fromRandom(ThreadID.Variant.Raw, 32)
    const j = ThreadID.fromString(i.toString())
    expect(i.toString()).to.equal(j.toString())
  })
  it("should be able to extract the encoding", () => {
    const i = ThreadID.fromRandom(ThreadID.Variant.Raw, 16)
    const e = ThreadID.getEncoding(i.toString())
    expect(e).to.equal("base32")
  })
  it("should have a valid version number", () => {
    const i = ThreadID.fromRandom(ThreadID.Variant.Raw, 16)
    const v = i.version()
    expect(v).to.equal(ThreadID.V1)
  })
  it("should have a valid variant number", () => {
    let i = ThreadID.fromRandom(ThreadID.Variant.Raw, 16)
    let v = i.variant()
    expect(v).to.equal(ThreadID.Variant.Raw)

    i = ThreadID.fromRandom(ThreadID.Variant.AccessControlled, 32)
    v = i.variant()
    expect(v).to.equal(ThreadID.Variant.AccessControlled)
  })
  it("should be able to round-trip to and from bytes", () => {
    const i = ThreadID.fromRandom(ThreadID.Variant.Raw, 16)
    const b = i.toBytes()
    const n = ThreadID.fromBytes(b)
    expect(n).to.deep.equal(i)
    expect(i.equals(n)).to.be.true
  })
})
