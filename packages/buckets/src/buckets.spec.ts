import fs from 'fs'
import { Context } from '@textile/context'
import { PrivateKey } from '@textile/crypto'
import { SignupResponse } from '@textile/hub-grpc/hub_pb'
import { isBrowser, isNode } from 'browser-or-node'
import { expect } from 'chai'
import path from 'path'
import { CreateObject } from './api'
import { Buckets } from './buckets'
import { createKey, signUp } from './spec.util'

// Settings for localhost development and testing
const addrApiurl = 'http://127.0.0.1:3007'
const addrGatewayUrl = 'http://127.0.0.1:8006'
const wrongError = new Error('wrong error!')
const rightError = new Error('right error!')
const sessionSecret = 'hubsession'

describe('Buckets...', function () {
  const ctx = new Context(addrApiurl)
  const client = new Buckets(ctx)
  let buck: CreateObject
  let fileSize: number

  let dev: SignupResponse.AsObject
  const apiKeyInfo = { key: '' }

  before(async function () {
    const user = await signUp(ctx, addrGatewayUrl, sessionSecret)
    ctx.withSession(user.user?.session)
    if (!user.user) throw new Error('user signup error')
    dev = user.user
    const tmp = new Context(addrApiurl).withSession(dev.session)
    const { keyInfo } = await createKey(tmp, 'KEY_TYPE_USER')
    if (!keyInfo) return
    apiKeyInfo.key = keyInfo.key
  })

  describe('editing', function () {
    it('should open a bucket by name without thread info', async function () {
      const { root, threadID } = await client.getOrCreate('createbuck')
      expect(threadID).to.not.be.undefined
      expect(root).to.have.ownProperty('key')
      expect(root).to.have.ownProperty('path')
      expect(root).to.have.ownProperty('createdAt')
      expect(root).to.have.ownProperty('updatedAt')
    })

    it('should create a new bucket on open thread', async function () {
      // Check that we're empty
      const list = await client.list()
      expect(list).to.have.length(1)
      // Now create a bucket
      buck = await client.create('mybuck')
      expect(buck).to.have.ownProperty('root')
      expect(buck.root).to.have.ownProperty('key')
      expect(buck.root).to.have.ownProperty('path')
      expect(buck.root).to.have.ownProperty('createdAt')
      expect(buck.root).to.have.ownProperty('updatedAt')
    })

    it('should list buckets', async function () {
      const roots = await client.list()
      expect(roots).to.have.length(2)
      const index = roots[0].key === buck.root?.key ? 0 : 1
      const root = roots[index]
      expect(root).to.have.ownProperty('key', buck.root?.key)
      expect(root).to.have.ownProperty('path', buck.root?.path)
      expect(root).to.have.ownProperty('createdAt', buck.root?.createdAt)
      expect(root).to.have.ownProperty('updatedAt', buck.root?.updatedAt)
    })

    it('should list empty bucket content at path', async function () {
      // Mostly empty
      const res = await client.listPath(buck.root?.key || '', '')
      expect(res).to.have.ownProperty('root')
      expect(res.root).to.not.be.undefined
      expect(res.item?.isDir).to.be.true
      expect(res.item?.items).to.have.length(1) // Includes .textileseed
    })

    it('should push data from filesystem on node', async function () {
      if (isBrowser) return this.skip()
      const pth = path.join(__dirname, '../../..', 'testdata')
      fileSize = fs.statSync(path.join(pth, 'file1.jpg')).size
      let stream = fs.createReadStream(path.join(pth, 'file1.jpg'))
      const rootKey = buck.root?.key || ''
      let length = 0

      // Bucket path
      const res = await client.pushPath(rootKey, 'dir1/file1.jpg', stream, {
        progress: (num) => (length = num || 0),
      })
      expect(length).to.equal(fileSize)
      expect(res.path).to.not.be.undefined
      expect(res.root).to.not.be.undefined

      // Nested bucket path
      stream = fs.createReadStream(path.join(pth, 'file2.jpg'))
      const { root } = await client.pushPath(rootKey, 'path/to/file2.jpg', stream)
      expect(root).to.not.be.undefined

      // Root dir
      const rep = await client.listPath(rootKey, '')
      expect(rep.item?.isDir).to.be.true
      expect(rep.item?.items).to.have.length(3) // Includes .textileseed
    })

    it('should push data from file API in browser', async function () {
      if (isNode) return this.skip()
      const parts = [
        new Blob(['you construct a file...'], { type: 'text/plain' }),
        ' Same way as you do with blob',
        new Uint16Array([33]),
      ]
      // Construct a file
      const file = new File(parts, 'file1.txt')
      const rootKey = buck.root?.key || ''
      let length = 0

      // Bucket path
      const res = await client.pushPath(rootKey, 'dir1/file1.jpg', file, {
        progress: (num) => (length = num || 0),
      })
      expect(length).to.equal(54)
      expect(res.path).to.not.be.undefined
      expect(res.root).to.not.be.undefined

      // Nested bucket path
      // @note: We're reusing file here...
      const { root } = await client.pushPath(rootKey, 'path/to/file2.jpg', file)
      expect(root).to.not.be.undefined

      // Root dir
      const rep = await client.listPath(rootKey, '')
      expect(rep.item?.isDir).to.be.true
      expect(rep.item?.items).to.have.length(3)
    })

    it('should list (nested) files within a bucket', async function () {
      const rootKey = buck.root?.key || ''

      // Nested dir
      let rep = await client.listPath(rootKey, 'dir1')
      expect(rep.item?.isDir).to.be.true
      expect(rep.item?.items).to.have.length(1)

      // File
      rep = await client.listPath(rootKey, 'dir1/file1.jpg')
      expect(rep.item?.path.endsWith('file1.jpg')).to.be.true
      expect(rep.item?.isDir).to.be.false

      // Recursive dir
      rep = await client.listPath(rootKey, '', 3)
      expect(rep.item?.isDir).to.be.true
      expect(rep.item?.items).to.have.length(3)

      // Recursive dir
      // [
      //   '.textileseed',
      //   'dir1',
      //   'dir1/file1.jpg',
      //   'path',
      //   'path/to',
      //   'path/to/file2.jpg'
      // ]
      let list = await client.listPathFlat(rootKey, '')
      expect(list).to.have.length(6)
      expect(list).to.contain('dir1/file1.jpg')

      list = await client.listPathFlat(rootKey, '', false)
      expect(list).to.have.length(3)
    })

    it('should pull files by path and write to file on node', async function () {
      if (isBrowser) return this.skip()
      // Bucket path
      const rootKey = buck.root?.key || ''
      let length = 0

      // Bucket path
      const chunks = client.pullPath(rootKey, 'dir1/file1.jpg', {
        progress: (num) => (length = num || 0),
      })
      const pth = path.join(__dirname, '../../..', 'testdata')
      const stream = fs.createWriteStream(path.join(pth, 'output.jpg'))
      // Should be an AsyncIterable
      for await (const chunk of chunks) {
        stream.write(chunk)
      }
      stream.close()
      expect(length).to.equal(fileSize)
      // const stored = fs.statSync(path.join(pth, 'file1.jpg'))
      // const written = fs.statSync(path.join(pth, 'output.jpg'))
      // expect(stored.size).to.equal(written.size)
      fs.unlinkSync(path.join(pth, 'output.jpg'))

      // Should throw correctly when the file isn't available
      try {
        const more = client.pullPath(rootKey, 'dir1/nope.jpg')
        for await (const chk of more) {
          expect(chk).to.not.be.undefined
        }
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.toString()).to.include('nope.jpg')
      }

      // Should be an AsyncIterator
      const more = client.pullPath(rootKey, 'dir1/file1.jpg')
      const { value } = await more.next()
      expect(value).to.not.be.undefined
    })

    it('should remove files by path', async function () {
      const rootKey = buck.root?.key || ''
      await client.removePath(rootKey, 'path/to/file2.jpg')
      try {
        await client.listPath(rootKey, 'path/to/file2.jpg')
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
      }
      let list = await client.listPath(rootKey, '')
      expect(list.item?.items).to.have.length(3) // Includes .textileseed
      await client.removePath(rootKey, 'path')
      try {
        await client.listPath(rootKey, 'path')
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
      }
      list = await client.listPath(rootKey, '')
      expect(list.item?.items).to.have.length(2) // Includes .textileseed
    })

    it('should list bucket links', async function () {
      const rootKey = buck.root?.key || ''

      const rep = await client.links(rootKey)
      expect(rep.url).to.not.equal('')
      expect(rep.ipns).to.not.equal('')
    })

    it('should remove an entire bucket', async function () {
      const rootKey = buck.root?.key || ''
      const rep = await client.listPath(rootKey, 'dir1/file1.jpg')
      expect(rep).to.not.be.undefined
      await client.remove(rootKey)
      try {
        await client.listPath(rootKey, 'dir1/file1.jpg')
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
      }
    })
  })
  describe('sharing', function () {
    const bob = PrivateKey.fromRandom()
    const bobPubKey = bob.public.toString()
    const alice = PrivateKey.fromRandom()
    let aliceBuckets: Buckets | undefined
    let bobBuckets: Buckets | undefined
    let aliceThread: string | undefined
    let rootKey: string | undefined
    const sharedPath = 'path/to'
    const sharedFile = 'path/to/file2.jpg'
    const privatePath = 'dir1/file1.jpg'
    const pth = path.join(__dirname, '../../..', 'testdata')
    before(async function () {
      this.timeout(10000)
      if (isBrowser) return this.skip()
      aliceBuckets = await Buckets.withKeyInfo(apiKeyInfo, { host: addrApiurl })
      await aliceBuckets.getToken(alice)
      bobBuckets = await Buckets.withKeyInfo(apiKeyInfo, { host: addrApiurl })
      await bobBuckets.getToken(bob)
      const { root, threadID } = await aliceBuckets.getOrCreate('createbuck')
      aliceThread = threadID

      // scope bob's client to the same thread
      bobBuckets.withThread(aliceThread)

      if (!root) throw Error('bucket creation failed')
      rootKey = root.key

      // Push private file for only alice
      let stream = fs.createReadStream(path.join(pth, 'file1.jpg'))
      await aliceBuckets.pushPath(rootKey, privatePath, stream)

      // Push file to be shared with bob
      stream = fs.createReadStream(path.join(pth, 'file2.jpg'))
      await aliceBuckets.pushPath(rootKey, sharedFile, stream)
    })

    it('grant peer2 write access', async function () {
      if (isBrowser) return this.skip()
      if (!aliceThread || !rootKey) throw Error('setup failed')

      aliceBuckets = await Buckets.withKeyInfo(apiKeyInfo, { host: addrApiurl })
      await aliceBuckets.getToken(alice)
      aliceBuckets.withThread(aliceThread)

      // Update access roles to grant bob access
      const roles = new Map()
      roles.set(bobPubKey, 2)
      // Grants access at 'path/to'
      await aliceBuckets.pushPathAccessRoles(rootKey, sharedPath, roles)

      // Check that our pulled permissions are as expected
      const shared = await aliceBuckets.pullPathAccessRoles(rootKey, sharedPath)
      expect(shared.get(bobPubKey)).to.equal(2)
    })

    it('add a new file into a shared path should fail', async function () {
      if (isBrowser) return this.skip()
      if (!aliceThread || !rootKey) throw Error('setup failed')

      bobBuckets = await Buckets.withKeyInfo(apiKeyInfo, { host: addrApiurl })
      await bobBuckets.getToken(bob)
      bobBuckets.withThread(aliceThread)

      try {
        const stream = fs.createReadStream(path.join(pth, 'file2.jpg'))
        await bobBuckets.pushPath(rootKey, 'path/to/bobby.jpg', stream)
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.message).to.include('permission denied')
      }
    })

    it('remove a file in shared path', async function () {
      if (isBrowser) return this.skip()
      if (!aliceThread || !rootKey) throw Error('setup failed')

      bobBuckets = await Buckets.withKeyInfo(apiKeyInfo, { host: addrApiurl })
      await bobBuckets.getToken(bob)
      bobBuckets.withThread(aliceThread)

      try {
        await bobBuckets.removePath(rootKey, sharedFile)
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.message).to.include('permission denied')
      }
    })

    it('overwrite an existing shared file', async function () {
      if (isBrowser) return this.skip()
      if (!aliceThread || !rootKey) throw Error('setup failed')

      bobBuckets = await Buckets.withKeyInfo(apiKeyInfo, { host: addrApiurl })
      await bobBuckets.getToken(bob)
      bobBuckets.withThread(aliceThread)

      // Test that bob sees the same permissions, including himself
      const perms = await bobBuckets.pullPathAccessRoles(rootKey, sharedPath)
      expect(perms.get(bobPubKey)).to.equal(2)

      // Over-write the file in the shared path
      const stream = fs.createReadStream(path.join(pth, 'file2.jpg'))
      // Pushing to an existing shared file works: sharedFile = 'path/to/file2.jpg'
      try {
        await bobBuckets.pushPath(rootKey, sharedFile, stream)
        throw rightError
      } catch (err) {
        expect(err).to.equal(rightError)
      }
    })
  })
})
