/* eslint-disable @typescript-eslint/no-var-requires */
import { LogID } from "@textile/threads-core"
import { keys, PrivateKey } from "@textile/threads-crypto"
import { ThreadID } from "@textile/threads-id"
import { expect } from "chai"
import { MemoryDatastore } from "interface-datastore"
import { KeyBook } from "./keybook"

let kb: KeyBook
const tid: ThreadID = ThreadID.fromRandom(0, 24)
let log: LogID

describe("KeyBook", () => {
  beforeEach(() => {
    kb = new KeyBook(new MemoryDatastore())
  })
  after(async () => {
    await kb.close()
  })
  it("PrivKey", async () => {
    const privKey: PrivateKey = await keys.generateKeyPair("Ed25519")
    expect(privKey).to.not.be.undefined

    log = await LogID.fromPrivateKey(privKey)

    // No privkey exists yet
    const key = await kb.privKey(tid, log)
    expect(key).to.be.undefined

    // Add should not err
    const res = await kb.addPrivKey(tid, log, privKey)
    expect(res).to.be.undefined

    // Stored priv key should match
    const que = await kb.privKey(tid, log)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(que!.bytes).to.deep.equal(privKey!.bytes)

    const logs = await kb.logs(tid)
    const same = Array.from(logs).map((l) => log.equals(l))
    expect(same.every(Boolean)).to.be.true
  })
  it("PubKey", async () => {
    const privKey: PrivateKey = await keys.generateKeyPair("Ed25519")
    expect(privKey).to.not.be.undefined

    log = await LogID.fromPublicKey(privKey.public)

    // No pubKey exists yet
    const key = await kb.pubKey(tid, log)
    expect(key).to.be.undefined

    // Add should not err
    const res = await kb.addPubKey(tid, log, privKey.public)
    expect(res).to.be.undefined

    // Stored pub key should match
    const que = await kb.pubKey(tid, log)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(que!.bytes).to.deep.equal(privKey!.public.bytes)

    const logs = await kb.logs(tid)
    const same = Array.from(logs).map((l) => log.equals(l))
    expect(same.every(Boolean)).to.be.true
  })
  it("ReadKey", async () => {
    // No readKey exists yet
    const key = await kb.readKey(tid)
    expect(key).to.be.undefined

    const key128 = Buffer.from([
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
    ])

    // Add should not err
    const res = await kb.addReadKey(tid, key128)
    expect(res).to.be.undefined

    // Stored read key should match
    const que = await kb.readKey(tid)
    expect(que).to.eql(key128)
  })

  it("Service Key", async () => {
    // No readKey exists yet
    const key = await kb.serviceKey(tid)
    expect(key).to.be.undefined

    const key128 = Buffer.from([
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
    ])

    // Add should not err
    const res = await kb.addServiceKey(tid, key128)
    expect(res).to.be.undefined

    // Stored read key should match
    const que = await kb.serviceKey(tid)
    expect(que).to.eql(key128)
  })

  it("clear keys", async () => {
    const privKey: PrivateKey = await keys.generateKeyPair("Ed25519")
    log = await LogID.fromPublicKey(privKey.public)
    await kb.addPubKey(tid, log, privKey.public)

    const keyBefore = await kb.pubKey(tid, log)
    expect(keyBefore).to.not.be.undefined

    const logs = await kb.logs(tid)

    expect(logs.size).to.be.greaterThan(0)

    await kb.clearLogKeys(tid, log)
    const keyAfter = await kb.pubKey(tid, log)
    expect(keyAfter).to.be.undefined

    await kb.clearThreadKeys(tid)
    expect((await kb.threads()).size).to.equal(0)
  })
})
