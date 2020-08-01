import { ThreadID } from '@textile/threads-id'
import { grpc } from '@improbable-eng/grpc-web'
import { SignupReply } from '@textile/hub-grpc/hub_pb'
import { expect } from 'chai'
import { Libp2pCryptoIdentity } from '@textile/threads-core'
import { Context } from '@textile/context'
import { PrivateKey } from '@textile/crypto'
import { Client } from '@textile/hub-threads-client'
import { expirationError } from '@textile/security'
import { signUp, createKey, createAPISig } from './spec.util'
import { Users } from './users'

// Settings for localhost development and testing
const addrApiurl = 'http://127.0.0.1:3007'
const addrGatewayUrl = 'http://127.0.0.1:8006'
const wrongError = new Error('wrong error!')
const sessionSecret = 'hubsession'

describe('Users...', () => {
  describe('getThread', () => {
    const ctx = new Context(addrApiurl)
    let dev: SignupReply.AsObject
    before(async function () {
      this.timeout(10000)
      const { user } = await signUp(ctx, addrGatewayUrl, sessionSecret)
      if (user) dev = user
    })
    it('should handle missing user group keys', async () => {
      /**
       * No key will fail with unauthorized since a key is the minimum
       * authorization
       */
      try {
        const user = new Users(ctx)
        await user.getThread('foo')
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.Unauthenticated)
      }
    })
    it('should handle bad user group key signature', async () => {
      /**
       * No key signature
       * This will fail with NotFound due to it needing to know the key's
       * security status before it knows if it's authorized or not.
       */
      const tmp = new Context(addrApiurl).withSession(dev.session)
      const key = await createKey(tmp, 'ACCOUNT')
      try {
        const user = new Users(ctx.withAPIKey(key.key))
        await user.getThread('foo')
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.NotFound)
      }
      // Old key signature
      const sig = await createAPISig(key.secret, new Date(Date.now() - 1000 * 60))
      try {
        const user = new Users(ctx.withAPISig(sig))
        await user.getThread('foo')
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
        const user = new Users(ctx)
        await user.getThread('foo')
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.NotFound)
      }
      // All good
      const id = ThreadID.fromRandom()
      const db = new Client(ctx)
      const user = new Users(ctx)
      await db.newDB(id, 'foo')
      const res = await user.getThread('foo')
      expect(res.name).to.equal('foo')
    })

    it('should handle user keys', async () => {
      // Reset client context (just for the tests)
      const ctx = new Context(addrApiurl)
      const user = new Users(ctx)
      const tmp = new Context(addrApiurl).withSession(dev.session)
      const key = await createKey(tmp, 'USER')
      await ctx.withAPIKey(key.key).withKeyInfo(key)
      // No token
      try {
        await user.getThread('foo')
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
        await user.getThread('foo')
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.NotFound)
      }
      // All good
      const id = ThreadID.fromRandom()
      await db.newDB(id, 'foo')
      const res = await user.getThread('foo')
      expect(res.name).to.equal('foo')
    })
  })

  describe('listThreads', () => {
    const ctx = new Context(addrApiurl)
    let dev: SignupReply.AsObject
    before(async function () {
      this.timeout(10000)
      const { user } = await signUp(ctx, addrGatewayUrl, sessionSecret)
      if (user) dev = user
    })
    it('should handle bad keys', async () => {
      // No key
      try {
        const user = new Users(ctx)
        await user.listThreads()
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
        const user = new Users(ctx.withAPIKey(key.key))
        await user.listThreads()
        throw wrongError
      } catch (err) {
        expect(err).to.equal(wrongError)
      }
      // Old key signature will fail
      const sig = await createAPISig(key.secret, new Date(Date.now() - 1000 * 60))
      try {
        const user = new Users(ctx.withAPISig(sig))
        await user.listThreads()
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
      const user = new Users(ctx)
      let res = await user.listThreads()
      expect(res).to.have.length(0)
      // Got one
      const id = ThreadID.fromRandom()
      const db = new Client(ctx)
      await db.newDB(id)
      res = await user.listThreads()
      expect(res).to.have.length(1)
    })

    it('should handle user keys', async () => {
      // Reset client context (just for the tests)
      const ctx = new Context(addrApiurl)
      const user = new Users(ctx)
      const tmp = new Context(addrApiurl).withSession(dev.session)
      const key = await createKey(tmp, 'USER')
      await ctx.withAPIKey(key.key).withKeyInfo(key)
      // No token
      try {
        await user.listThreads()
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.Unauthenticated)
      }
      // Empty
      const db = new Client(ctx)
      const identity = await Libp2pCryptoIdentity.fromRandom()
      await db.getToken(identity)
      let res = await user.listThreads()
      expect(res).to.have.length(0)
      // Got one
      const id = ThreadID.fromRandom()
      await db.newDB(id, 'foo')
      res = await user.listThreads()
      expect(res).to.have.length(1)
      expect(res[0].name).to.equal('foo')
    })
  })

  describe('mailbox', async () => {
    const userId1 = await PrivateKey.fromRandom()
    const userId2 = await PrivateKey.fromRandom()
    const ctx = new Context(addrApiurl)
    const ctx2 = new Context(addrApiurl)
    let dev: SignupReply.AsObject
    before(async function () {
      this.timeout(10000)
      const { user } = await signUp(ctx, addrGatewayUrl, sessionSecret)
      if (user) dev = user
      const tmp = new Context(addrApiurl).withSession(dev.session)
      const key = await createKey(tmp, 'USER')
      await ctx.withAPIKey(key.key).withKeyInfo(key)
      await ctx2.withAPIKey(key.key).withKeyInfo(key)
    })
    it('should setup mailbox', async () => {
      const user = new Users(ctx)
      // No token
      try {
        await user.setupMailbox()
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.Unauthenticated)
      }

      const token = await user.getToken(userId1)
      ctx.withToken(token) // to skip regen in later calls
      const res = await user.setupMailbox()
      expect(res.mailboxID).to.not.be.undefined
      
      // Should setup user2 mailbox without error
      const user2 = new Users(ctx2)
      const token2 = await user2.getToken(userId2)
      ctx2.withToken(token2) // to skip regen in later calls
    })
    it('should send a message to user2', async () => {
      const user = new Users(ctx)
      const nowish = Math.floor(new Date().getTime())
      const encoder = new TextEncoder()
      const res = await user.sendMessage(userId1, userId2.public, encoder.encode('first'))
      const sentish = Math.floor(res.createdAt)
      expect(res.id).to.not.be.undefined
      expect(Math.abs(sentish - nowish)).to.be.lessThan(3000)
    })
  })
})
