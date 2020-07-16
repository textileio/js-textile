;(global as any).WebSocket = require("isomorphic-ws")

import { InitReply } from "@textile/buckets-grpc/buckets_pb"
import { Context } from "@textile/context"
import { isBrowser, isNode } from "browser-or-node"
import { expect } from "chai"
import fs from "fs"
import path from "path"
import { Buckets } from "./buckets"
import { signUp } from "./spec.util"

// Settings for localhost development and testing
const addrApiurl = "http://127.0.0.1:3007"
const addrGatewayUrl = "http://127.0.0.1:8006"
const wrongError = new Error("wrong error!")
const sessionSecret = "hubsession"

describe("Buckets...", () => {
  const ctx = new Context(addrApiurl)
  const client = new Buckets(ctx)
  let buck: InitReply.AsObject
  let fileSize: number

  before(async () => {
    const user = await signUp(ctx, addrGatewayUrl, sessionSecret)
    ctx.withSession(user.user?.session)
  })

  it("should open a bucket by name without thread info", async () => {
    const root = await client.open("initbuck")
    expect(root).to.have.ownProperty("key")
    expect(root).to.have.ownProperty("path")
    expect(root).to.have.ownProperty("createdat")
    expect(root).to.have.ownProperty("updatedat")
  })

  it("should init a new bucket on open thread", async () => {
    // Check that we're empty
    const list = await client.list()
    expect(list).to.have.length(1)
    // Now initialize a bucket
    buck = await client.init("mybuck")
    expect(buck).to.have.ownProperty("root")
    expect(buck.root).to.have.ownProperty("key")
    expect(buck.root).to.have.ownProperty("path")
    expect(buck.root).to.have.ownProperty("createdat")
    expect(buck.root).to.have.ownProperty("updatedat")
  })

  it("should list buckets", async () => {
    const roots = await client.list()
    expect(roots).to.have.length(2)
    const index = roots[0].key === buck.root?.key ? 0 : 1
    const root = roots[index]
    expect(root).to.have.ownProperty("key", buck.root?.key)
    expect(root).to.have.ownProperty("path", buck.root?.path)
    expect(root).to.have.ownProperty("createdat", buck.root?.createdat)
    expect(root).to.have.ownProperty("updatedat", buck.root?.updatedat)
  })

  it("should list empty bucket content at path", async () => {
    // Mostly empty
    const res = await client.listPath(buck.root?.key || "", "")
    expect(res).to.have.ownProperty("root")
    expect(res.root).to.not.be.undefined
    expect(res.item?.isdir).to.be.true
    // @todo: Should we rename itemsList to just be items?
    expect(res.item?.itemsList).to.have.length(1) // Includes .textileseed
  })

  it("should push data from filesystem on node", async function () {
    if (isBrowser) return this.skip()
    const pth = path.join(__dirname, "../../..", "testdata")
    fileSize = fs.statSync(path.join(pth, "file1.jpg")).size
    let stream = fs.createReadStream(path.join(pth, "file1.jpg"))
    const rootKey = buck.root?.key || ""
    let length = 0

    // Bucket path
    const res = await client.pushPath(rootKey, "dir1/file1.jpg", stream, {
      progress: (num) => (length = num || 0),
    })
    expect(length).to.equal(fileSize)
    expect(res.path).to.not.be.undefined
    expect(res.root).to.not.be.undefined

    // Nested bucket path
    stream = fs.createReadStream(path.join(pth, "file2.jpg"))
    const { root } = await client.pushPath(rootKey, "path/to/file2.jpg", stream)
    expect(root).to.not.be.undefined

    // Root dir
    const rep = await client.listPath(rootKey, "")
    expect(rep.item?.isdir).to.be.true
    expect(rep.item?.itemsList).to.have.length(3) // Includes .textileseed
  })

  it("should push data from file API in browser", async function () {
    if (isNode) return this.skip()
    const parts = [
      new Blob(["you construct a file..."], { type: "text/plain" }),
      " Same way as you do with blob",
      new Uint16Array([33]),
    ]
    // Construct a file
    const file = new File(parts, "file1.txt")
    const rootKey = buck.root?.key || ""
    let length = 0

    // Bucket path
    const res = await client.pushPath(rootKey, "dir1/file1.jpg", file, {
      progress: (num) => (length = num || 0),
    })
    expect(length).to.equal(54)
    expect(res.path).to.not.be.undefined
    expect(res.root).to.not.be.undefined

    // Nested bucket path
    // @note: We're reusing file here...
    const { root } = await client.pushPath(rootKey, "path/to/file2.jpg", file)
    expect(root).to.not.be.undefined

    // Root dir
    const rep = await client.listPath(rootKey, "")
    expect(rep.item?.isdir).to.be.true
    expect(rep.item?.itemsList).to.have.length(3)
  })

  it("should list (nested) files within a bucket", async () => {
    const rootKey = buck.root?.key || ""

    // Nested dir
    let rep = await client.listPath(rootKey, "dir1")
    expect(rep.item?.isdir).to.be.true
    expect(rep.item?.itemsList).to.have.length(1)

    // File
    rep = await client.listPath(rootKey, "dir1/file1.jpg")
    expect(rep.item?.path.endsWith("file1.jpg")).to.be.true
    expect(rep.item?.isdir).to.be.false
  })

  it("should pull files by path and write to file on node", async function () {
    if (isBrowser) return this.skip()
    // Bucket path
    const rootKey = buck.root?.key || ""
    let length = 0

    // Bucket path
    const chunks = client.pullPath(rootKey, "dir1/file1.jpg", {
      progress: (num) => (length = num || 0),
    })
    const pth = path.join(__dirname, "../../..", "testdata")
    const stream = fs.createWriteStream(path.join(pth, "output.jpg"))
    // Should be an AsyncIterable
    for await (const chunk of chunks) {
      stream.write(chunk)
    }
    stream.close()
    expect(length).to.equal(fileSize)
    // const stored = fs.statSync(path.join(pth, "file1.jpg"))
    // const written = fs.statSync(path.join(pth, "output.jpg"))
    // expect(stored.size).to.equal(written.size)
    fs.unlinkSync(path.join(pth, "output.jpg"))

    // Should throw correctly when the file isn't available
    try {
      const more = client.pullPath(rootKey, "dir1/nope.jpg")
      for await (const chk of more) {
        expect(chk).to.not.be.undefined
      }
      throw wrongError
    } catch (err) {
      expect(err).to.not.equal(wrongError)
      expect(err.toString()).to.include("nope.jpg")
    }

    // Should be an AsyncIterator
    const more = client.pullPath(rootKey, "dir1/file1.jpg")
    const { value } = await more.next()
    expect(value).to.not.be.undefined
  })

  it("should remove files by path", async () => {
    const rootKey = buck.root?.key || ""
    await client.removePath(rootKey, "path/to/file2.jpg")
    try {
      await client.listPath(rootKey, "path/to/file2.jpg")
      throw wrongError
    } catch (err) {
      expect(err).to.not.equal(wrongError)
    }
    let list = await client.listPath(rootKey, "")
    expect(list.item?.itemsList).to.have.length(3) // Includes .textileseed
    await client.removePath(rootKey, "path")
    try {
      await client.listPath(rootKey, "path")
      throw wrongError
    } catch (err) {
      expect(err).to.not.equal(wrongError)
    }
    list = await client.listPath(rootKey, "")
    expect(list.item?.itemsList).to.have.length(2) // Includes .textileseed
  })

  it("should list bucket links", async () => {
    const rootKey = buck.root?.key || ""

    const rep = await client.links(rootKey)
    expect(rep.url).to.not.equal("")
    expect(rep.ipns).to.not.equal("")
  })

  it("should remove an entire bucket", async () => {
    const rootKey = buck.root?.key || ""
    const rep = await client.listPath(rootKey, "dir1/file1.jpg")
    expect(rep).to.not.be.undefined
    await client.remove(rootKey)
    try {
      await client.listPath(rootKey, "dir1/file1.jpg")
      throw wrongError
    } catch (err) {
      expect(err).to.not.equal(wrongError)
    }
  })
})
