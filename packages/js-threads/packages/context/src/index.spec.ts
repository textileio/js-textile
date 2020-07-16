import { expirationError } from "@textile/security"
import { expect } from "chai"
import { Context, ContextInterface } from "./index"

describe("Context", () => {
  let validJson = {}
  let validMsg = ""
  it("should throw an exception when working with an expired msg", async () => {
    const context: ContextInterface = new Context()
    try {
      context.withAPISig({
        sig: "fake",
        // Create msg date in the past
        msg: new Date(Date.now() - 1000 * 60).toUTCString(),
      })
      context.toJSON()
      throw new Error("should have thrown")
    } catch (err) {
      expect(err).to.equal(expirationError)
    }
    validMsg = new Date(Date.now() + 1000 * 60).toUTCString()
    context.withAPISig({
      sig: "fake",
      msg: validMsg,
    })
    validJson = context.toJSON()
    expect(validJson).to.haveOwnProperty("x-textile-api-sig-msg", validMsg)
  })

  it("should callback when working with expired tag and callback is available", async () => {
    const pastDate = new Date(Date.now() - 1000 * 60)
    const futureDate = new Date(Date.now() + 1000 * 60)
    const context: ContextInterface = Context.fromUserAuthCallback(async () => {
      return {
        sig: "fake",
        msg: futureDate.toUTCString(),
        token: "fake",
        key: "fake",
      }
    })
    context.withAPISig({
      sig: "fake",
      // Create msg date in the past
      msg: pastDate.toUTCString(),
    })
    // Should throw
    try {
      context.toJSON()
      throw new Error("should have thrown")
    } catch (err) {
      expect(err).to.equal(expirationError)
    }
    // Should renew
    const metadata = await context.toMetadata()
    expect(metadata.get("x-textile-api-sig-msg")[0]).to.equal(
      futureDate.toUTCString()
    )
  })

  it("should not throw when creating fromUserAuth", async () => {
    const msg = new Date(Date.now() + 1000 * 60).toUTCString()
    const context = Context.fromUserAuth({
      sig: "fake",
      msg,
      token: "fake",
      key: "fake",
    })
    const json = context.toJSON()
    expect(json).to.haveOwnProperty("x-textile-api-sig-msg", msg)
  })
  it("should not throw when creating from valid JSON", async () => {
    const context = Context.fromJSON(validJson)
    const json = context.toJSON()
    expect(json).to.haveOwnProperty("x-textile-api-sig-msg", validMsg)
  })
  it("should throw when creating from invalid JSON", async () => {
    const context: ContextInterface = new Context()
    context.withAPISig({
      sig: "fake",
      // Create msg that will be valid for 1 second
      msg: new Date(Date.now() + 1000).toUTCString(),
    })
    const json = context.toJSON()
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms))
    await sleep(1000)

    try {
      const context = Context.fromJSON(json)
      context.toJSON()
      throw new Error("should have thrown")
    } catch (err) {
      expect(err).to.equal(expirationError)
    }
  })
})
