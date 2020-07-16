import { expect } from "chai"
import { Libp2pCryptoIdentity } from "./identity"

describe("Identity", () => {
  it("should be able to serialize and recover identities", async () => {
    const id = await Libp2pCryptoIdentity.fromRandom()
    const str = id.toString()
    const back = await Libp2pCryptoIdentity.fromString(str)
    expect(id).to.deep.equal(back)
  })
  it("signatures should verify", async () => {
    const id = await Libp2pCryptoIdentity.fromRandom()
    const msg = Buffer.from("teststring")
    const sig = await id.sign(msg)
    const verify = await id.public.verify(msg, sig)
    expect(verify).to.be.true
  })
})
