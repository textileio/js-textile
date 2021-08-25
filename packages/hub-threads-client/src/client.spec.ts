import { grpc } from '@improbable-eng/grpc-web'
import { Context, errors } from '@textile/context'
import { PrivateKey } from '@textile/crypto'
import { SignupResponse } from '@textile/hub-grpc/api/hubd/pb/hubd_pb'
import { createAPISig } from '@textile/security'
import {
  addrApiurl,
  addrGatewayUrl,
  createKey,
  sessionSecret,
  signUp,
} from '@textile/testing'
import { ThreadID } from '@textile/threads-id'
import { expect } from 'chai'
import { Client, GetThreadResponse } from './client'

const wrongError = new Error('wrong error!')

describe('Hub Threads Client', () => {
  describe('getThread', () => {
    const ctx = new Context(addrApiurl)
    const client = new Client(ctx)
    let dev: SignupResponse.AsObject
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
      const { keyInfo } = await createKey(tmp, 'KEY_TYPE_ACCOUNT')
      expect(keyInfo).not.undefined
      try {
        await client.getThread('foo', ctx.withAPIKey(keyInfo?.key))
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.NotFound)
      }
      // Old key signature
      const sig = await createAPISig(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        keyInfo!.secret,
        new Date(Date.now() - 1000 * 60),
      )
      try {
        await client.getThread('foo', ctx.withAPISig(sig))
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err).to.equal(errors.expirationError)
      }
    })
    it('should handle account keys', async () => {
      const tmp = new Context(addrApiurl).withSession(dev.session)
      const { keyInfo } = await createKey(tmp, 'KEY_TYPE_ACCOUNT')
      await ctx.withAPIKey(keyInfo?.key).withKeyInfo(keyInfo)
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
      const { keyInfo } = await createKey(tmp, 'KEY_TYPE_USER')
      await ctx.withAPIKey(keyInfo?.key).withKeyInfo(keyInfo)
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
      const identity = await PrivateKey.fromRandom()
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
    }).timeout(5000) // Make sure our test doesn't timeout
  })

  describe('listDBs', () => {
    const ctx = new Context(addrApiurl)
    const client = new Client(ctx)
    let dev: SignupResponse.AsObject
    before(async function () {
      this.timeout(5000)
      const { user } = await signUp(ctx, addrGatewayUrl, sessionSecret)
      if (user) dev = user
    })
    it('should handle errors on hub', async () => {
      // Reset client context (just for the tests)
      const ctx = new Context(addrApiurl)
      client.context = ctx
      const tmp = new Context(addrApiurl).withSession(dev.session)
      const { keyInfo } = await createKey(tmp, 'KEY_TYPE_USER')
      await ctx.withAPIKey(keyInfo?.key).withKeyInfo(keyInfo)
      // No token
      try {
        await client.listDBs()
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.Unauthenticated)
      }
      // Empty
      const db = new Client(ctx)
      const identity = PrivateKey.fromRandom()
      await db.getToken(identity)
      let res = await client.listDBs()
      expect(res).to.have.length(0)
      // Got one
      const id = ThreadID.fromRandom()
      await db.newDB(id, 'foo')
      res = await client.listDBs()
      expect(res).to.have.length(1)
      expect(res.pop()?.name).to.equal('foo')
      // No signature
      client.context.set('x-textile-api-sig', undefined)
      try {
        await client.listDBs()
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.message).to.include('If using Hub')
      }
    }).timeout(5000) // Make sure our test doesn't timeout
  })

  describe('listThreads', () => {
    const ctx = new Context(addrApiurl)
    const client = new Client(ctx)
    let dev: SignupResponse.AsObject
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
      const { keyInfo } = await createKey(tmp, 'KEY_TYPE_ACCOUNT')
      expect(keyInfo).not.undefined
      await client.listThreads(ctx.withAPIKey(keyInfo?.key))
      // Old key signature will fail
      const sig = await createAPISig(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        keyInfo!.secret,
        new Date(Date.now() - 1000 * 60),
      )
      try {
        await client.listThreads(ctx.withAPISig(sig))
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err).to.equal(errors.expirationError)
      }
    })
    it('should handle account keys', async () => {
      const tmp = new Context(addrApiurl)
      const { keyInfo } = await createKey(
        tmp.withSession(dev.session),
        'KEY_TYPE_ACCOUNT',
      )
      await ctx.withAPIKey(keyInfo?.key).withKeyInfo(keyInfo)
      // Empty
      let res: Array<GetThreadResponse> = await client.listThreads()
      expect(res).to.have.length(0)
      // Got one
      const id = ThreadID.fromRandom()
      const db = new Client(ctx)
      await db.newDB(id)
      res = await client.listThreads()
      expect(res).to.have.length(1)
    })

    it('should handle users keys', async () => {
      // Reset client context (just for the tests)
      const ctx = new Context(addrApiurl)
      client.context = ctx
      const tmp = new Context(addrApiurl).withSession(dev.session)
      const { keyInfo } = await createKey(tmp, 'KEY_TYPE_USER')
      await ctx.withAPIKey(keyInfo?.key).withKeyInfo(keyInfo)
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
      const identity = await PrivateKey.fromRandom()
      await db.getToken(identity)
      let res: Array<GetThreadResponse> = await client.listThreads()
      expect(res).to.have.length(0)
      // Got one
      const id = ThreadID.fromRandom()
      await db.newDB(id, 'foo')
      res = await client.listThreads()
      expect(res).to.have.length(1)
      expect(res[0].name).to.equal('foo')
    }).timeout(5000) // Make sure our test doesn't timeout
  })
})
