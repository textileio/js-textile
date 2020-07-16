import { Block, EventHeader, RecordNode } from "@textile/threads-core"
import { keys, randomBytes } from "@textile/threads-crypto"
import { expect } from "chai"
import { decodeBlock, defaultOptions } from "./coding"
import { createEvent } from "./event"
import { createRecord } from "./record"

const readKey = randomBytes(32)
const replicatorKey = randomBytes(32)
const raw = { txt: "hello world" }

describe("Encoding...", () => {
  describe("Event...", () => {
    it("should encode and encrypt log events", async () => {
      const key = randomBytes(32)
      const body = Block.encoder(raw, defaultOptions.codec)
      const obj = await createEvent(body, readKey, key)
      expect(obj).to.have.haveOwnProperty("value")
      expect(obj).to.have.haveOwnProperty("body")
      expect(obj).to.have.haveOwnProperty("header")
      const decodedBody = await decodeBlock(obj.body, key)
      expect(decodedBody.decodeUnsafe()).to.deep.equal(raw)
      const decodedHeader = await decodeBlock<EventHeader>(obj.header, readKey)
      const header = decodedHeader.decodeUnsafe()
      expect(header).to.haveOwnProperty("key")
      expect(header.key).to.deep.equal(key)
    })
  })

  describe("Record...", () => {
    it("should encode and encrypt a log record", async () => {
      const privKey = await keys.generateKeyPair("Ed25519", 32)
      const body = Block.encoder(raw, defaultOptions.codec)
      const event = await createEvent(body, readKey)
      // We just use the public key from the private key here for testing
      const pubKey = privKey.public
      const { value } = await createRecord(event, {
        privKey,
        servKey: replicatorKey,
        pubKey,
      })
      const decoded = (
        await decodeBlock<RecordNode>(value, replicatorKey)
      ).decode()
      expect(decoded.prev).to.be.undefined
      expect(decoded).to.haveOwnProperty("block")
      expect(decoded).to.haveOwnProperty("sig")
    })
  })
})
