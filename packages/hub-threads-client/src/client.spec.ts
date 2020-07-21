import { ThreadID } from '@textile/threads-id'
import { grpc } from '@improbable-eng/grpc-web'
import { SignupReply } from '@textile/hub-grpc/hub_pb'
import { expect } from 'chai'
import { Libp2pCryptoIdentity } from '@textile/threads-core'
import { Context } from '@textile/context'
import { expirationError } from '@textile/security'
import { signUp, createKey, createAPISig } from './spec.util'
import { Client } from './client'

// Settings for localhost development and testing
const addrApiurl = 'http://127.0.0.1:3007'
const addrGatewayUrl = 'http://127.0.0.1:8006'
const wrongError = new Error('wrong error!')
const sessionSecret = 'hubsession'

describe('Threads Client...', () => {
  describe('getThread', () => {
    const ctx = new Context(addrApiurl)
    const client = new Client(ctx)
    let dev: SignupReply.AsObject
    before(async function () {
      this.timeout(10000)
      const { user } = await signUp(ctx, addrGatewayUrl, sessionSecret)
      if (user) dev = user
    })
    it('should handle bad user group keys', async () => {
      /**
       * No key will fail with unauthorized since a key is the minimum
       * authorization
       */
      try {
        await client.getThread('foo', ctx)
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.Unauthenticated)
      }
      /**
       * No key signature
       * This will fail with NotFound due to it needing to know the key's
       * security status before it knows if it's authorized or not.
       */
      const tmp = new Context(addrApiurl).withSession(dev.session)
      const key = await createKey(tmp, 'ACCOUNT')
      try {
        await client.getThread('foo', ctx.withAPIKey(key.key))
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.NotFound)
      }
      // Old key signature
      const sig = await createAPISig(key.secret, new Date(Date.now() - 1000 * 60))
      try {
        await client.getThread('foo', ctx.withAPISig(sig))
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err).to.equal(expirationError)
      }
    })
    it('should handle account keys', async () => {
      const tmp = new Context(addrApiurl).withSession(dev.session)
      const key = await createKey(tmp, 'ACCOUNT')
      await ctx.withAPIKey(key.key).withKeyInfo(key)
      // Not found
      try {
        await client.getThread('foo')
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.NotFound)
      }
      // All good
      const id = ThreadID.fromRandom()
      const db = new Client(ctx)
      await db.newDB(id, 'foo')
      const res = await client.getThread('foo')
      expect(res.name).to.equal('foo')
    })

    it('should handle users keys', async () => {
      // Reset client context (just for the tests)
      const ctx = new Context(addrApiurl)
      client.context = ctx
      const tmp = new Context(addrApiurl).withSession(dev.session)
      const key = await createKey(tmp, 'USER')
      await ctx.withAPIKey(key.key).withKeyInfo(key)
      // No token
      try {
        await client.getThread('foo')
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.Unauthenticated)
      }
      // Not found
      const db = new Client(ctx)
      const identity = await Libp2pCryptoIdentity.fromRandom()
      await db.getToken(identity)
      try {
        await client.getThread('foo')
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.NotFound)
      }
      // All good
      const id = ThreadID.fromRandom()
      await db.newDB(id, 'foo')
      const res = await client.getThread('foo')
      expect(res.name).to.equal('foo')
    })
  })

  describe('listThreads', () => {
    const ctx = new Context(addrApiurl)
    const client = new Client(ctx)
    let dev: SignupReply.AsObject
    before(async function () {
      this.timeout(10000)
      const { user } = await signUp(ctx, addrGatewayUrl, sessionSecret)
      if (user) dev = user
    })
    it('should handle bad keys', async () => {
      // No key
      try {
        await client.listThreads()
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.Unauthenticated)
      }
      /**
       * No key signature will pass because default security is null
       */
      const tmp = new Context(addrApiurl).withSession(dev.session)
      const key = await createKey(tmp, 'ACCOUNT')
      try {
        await client.listThreads(ctx.withAPIKey(key.key))
        throw wrongError
      } catch (err) {
        expect(err).to.equal(wrongError)
      }
      // Old key signature will fail
      const sig = await createAPISig(key.secret, new Date(Date.now() - 1000 * 60))
      try {
        await client.listThreads(ctx.withAPISig(sig))
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err).to.equal(expirationError)
      }
    })
    it('should handle account keys', async () => {
      const tmp = new Context(addrApiurl)
      const key = await createKey(tmp.withSession(dev.session), 'ACCOUNT')
      await ctx.withAPIKey(key.key).withKeyInfo(key)
      // Empty
      let res = await client.listThreads()
      expect(res.listList).to.have.length(0)
      // Got one
      const id = ThreadID.fromRandom()
      const db = new Client(ctx)
      await db.newDB(id)
      res = await client.listThreads()
      expect(res.listList).to.have.length(1)
    })

    it('should handle users keys', async () => {
      // Reset client context (just for the tests)
      const ctx = new Context(addrApiurl)
      client.context = ctx
      const tmp = new Context(addrApiurl).withSession(dev.session)
      const key = await createKey(tmp, 'USER')
      await ctx.withAPIKey(key.key).withKeyInfo(key)
      // No token
      try {
        await client.listThreads()
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.Unauthenticated)
      }
      // Empty
      const db = new Client(ctx)
      const identity = await Libp2pCryptoIdentity.fromRandom()
      await db.getToken(identity)
      let res = await client.listThreads()
      expect(res.listList).to.have.length(0)
      // Got one
      const id = ThreadID.fromRandom()
      await db.newDB(id, 'foo')
      res = await client.listThreads()
      expect(res.listList).to.have.length(1)
      expect(res.listList[0].name).to.equal('foo')
    })
  })
})
