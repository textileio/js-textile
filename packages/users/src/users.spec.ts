import { ThreadID } from '@textile/threads-id'
import { grpc } from '@improbable-eng/grpc-web'
import { SignupResponse } from '@textile/hub-grpc/hub_pb'
import { expect } from 'chai'
import { Context } from '@textile/context'
import { PrivateKey } from '@textile/crypto'
import { Client } from '@textile/hub-threads-client'
import { expirationError } from '@textile/security'
import { signUp, createKey, createAPISig } from './spec.util'
import { Users } from './users'
import { Status, MailboxEvent } from './api'

// Settings for localhost development and testing
const addrApiurl = 'http://127.0.0.1:3007'
const addrGatewayUrl = 'http://127.0.0.1:8006'
const wrongError = new Error('wrong error!')
const sessionSecret = 'hubsession'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('Users...', () => {
  describe('getThread', () => {
    const ctx = new Context(addrApiurl)
    let dev: SignupResponse.AsObject
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
      const { keyInfo } = await createKey(tmp, 'KEY_TYPE_ACCOUNT')
      expect(keyInfo).not.undefined
      try {
        const user = new Users(ctx.withAPIKey(keyInfo?.key))
        await user.getThread('foo')
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.NotFound)
      }
      // Old key signature
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const sig = await createAPISig(keyInfo!.secret, new Date(Date.now() - 1000 * 60))
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
      const { keyInfo } = await createKey(tmp, 'KEY_TYPE_ACCOUNT')
      await ctx.withAPIKey(keyInfo?.key).withKeyInfo(keyInfo)
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
      const { keyInfo } = await createKey(tmp, 'KEY_TYPE_USER')
      await ctx.withAPIKey(keyInfo?.key).withKeyInfo(keyInfo)
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
      const identity = await PrivateKey.fromRandom()
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
    let dev: SignupResponse.AsObject
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
      const { keyInfo } = await createKey(tmp, 'KEY_TYPE_ACCOUNT')
      expect(keyInfo).not.undefined
      try {
        const user = new Users(ctx.withAPIKey(keyInfo?.key))
        await user.listThreads()
        throw wrongError
      } catch (err) {
        expect(err).to.equal(wrongError)
      }
      // Old key signature will fail
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const sig = await createAPISig(keyInfo!.secret, new Date(Date.now() - 1000 * 60))
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
      const { keyInfo } = await createKey(tmp.withSession(dev.session), 'KEY_TYPE_ACCOUNT')
      await ctx.withAPIKey(keyInfo?.key).withKeyInfo(keyInfo)
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
      const { keyInfo } = await createKey(tmp, 'KEY_TYPE_USER')
      await ctx.withAPIKey(keyInfo?.key).withKeyInfo(keyInfo)
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
      const identity = await PrivateKey.fromRandom()
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

  describe('mailbox', () => {
    const user1Id = PrivateKey.fromRandom()
    const user2Id = PrivateKey.fromRandom()
    const user1Ctx = new Context(addrApiurl)
    const user2Ctx = new Context(addrApiurl)
    let dev: SignupResponse.AsObject
    before(async function () {
      this.timeout(10000)
      const { user } = await signUp(user1Ctx, addrGatewayUrl, sessionSecret)
      if (user) dev = user
      const tmp = new Context(addrApiurl).withSession(dev.session)
      const { keyInfo } = await createKey(tmp, 'KEY_TYPE_USER')
      await user1Ctx.withAPIKey(keyInfo?.key).withKeyInfo(keyInfo)
      await user2Ctx.withAPIKey(keyInfo?.key).withKeyInfo(keyInfo)
    })
    it('should setup mailbox', async () => {
      const user = new Users(user1Ctx)
      // No token
      try {
        await user.setupMailbox()
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.code).to.equal(grpc.Code.Unauthenticated)
      }

      const token = await user.getToken(user1Id)
      user1Ctx.withToken(token) // to skip regen in later calls
      const mailboxID = await user.setupMailbox()
      expect(mailboxID).to.not.be.undefined

      // Should setup user2 mailbox without error
      const user2 = new Users(user2Ctx)
      const token2 = await user2.getToken(user2Id)
      user2Ctx.withToken(token2) // to skip regen in later calls
      await user2.setupMailbox()
    })
    it('should send a message to user2 and check sentbox', async () => {
      const user = new Users(user1Ctx)
      const encoder = new TextEncoder()
      const res = await user.sendMessage(user1Id, user2Id.public, encoder.encode('first'))
      expect(res.id).to.not.be.undefined

      const sent = await user.listSentboxMessages()
      expect(sent.length).to.equal(1)
    })
    it('should find and read a message', async () => {
      const user2 = new Users(user2Ctx)

      // Check inbox
      const rec = await user2.listInboxMessages()
      expect(rec.length).to.equal(1)

      // Check signature
      const msgBody = rec[0].body
      const sig = rec[0].signature
      const verify = await user1Id.public.verify(msgBody, sig)
      expect(verify).to.be.true

      // Check body
      const bodyBytes = await user2Id.decrypt(msgBody)
      const decoder = new TextDecoder()
      const body = decoder.decode(bodyBytes)
      expect(body).to.equal('first')

      // Clear the inbox
      await user2.readInboxMessage(rec[0].id)
      const rec2 = await user2.listInboxMessages({ status: Status.UNREAD })
      expect(rec2.length).to.equal(0)
    })
    it('should delete inbox messages', async () => {
      const user2 = new Users(user2Ctx)

      // Check inbox
      let rec = await user2.listInboxMessages()
      expect(rec.length).to.equal(1)

      // Delete
      await user2.deleteInboxMessage(rec[0].id)
      rec = await user2.listInboxMessages()
      expect(rec.length).to.equal(0)
    })
    it('should delete sentbox messages', async () => {
      const user1 = new Users(user1Ctx)

      // Check inbox
      let rec = await user1.listSentboxMessages()
      expect(rec.length).to.equal(1)

      // Delete
      await user1.deleteSentboxMessage(rec[0].id)
      rec = await user1.listSentboxMessages()
      expect(rec.length).to.equal(0)
    })
    it('mailboxID should exist', async () => {
      const user1 = new Users(user1Ctx)
      const mailboxID = await user1.getMailboxID()
      expect(mailboxID).to.not.be.undefined
    })

    it('inbox listen should return new messages', (done) => {
      const user1 = new Users(user1Ctx)
      let hitCallback = false
      const callback = async (reply?: MailboxEvent, err?: Error) => {
        expect(err).to.be.undefined
        expect(reply).to.not.be.undefined
        if (!reply || !reply.message) return done()
        expect(reply.type).to.equal('CREATE')

        const bodyBytes = await user1Id.decrypt(reply.message.body)
        const decoder = new TextDecoder()
        const body = decoder.decode(bodyBytes)
        expect(body).to.equal('watch')
        hitCallback = true
      }
      setTimeout(async () => {
        const mailboxID = await user1.getMailboxID()
        expect(mailboxID).to.not.be.undefined
        const closer = await user1.watchInbox(mailboxID, callback)
        const user2 = new Users(user2Ctx)
        await delay(100)
        await user2.sendMessage(user2Id, user1Id.public, new TextEncoder().encode('watch'))
        setTimeout(() => {
          closer.close()
          expect(hitCallback).to.be.true
          done()
        }, 350)
      }, 500)
    }).timeout(5000)

    it('sentbox listen should return new messages', (done) => {
      const user2 = new Users(user2Ctx)
      let hitCallback = false
      const callback = async (reply?: MailboxEvent, err?: Error) => {
        expect(err).to.be.undefined
        expect(reply).to.not.be.undefined
        if (!reply || !reply.message) return done()
        expect(reply.type).to.equal('CREATE')

        const bodyBytes = await user2Id.decrypt(reply.message.body)
        const decoder = new TextDecoder()
        const body = decoder.decode(bodyBytes)
        expect(body).to.equal('watch')
        hitCallback = true
      }
      setTimeout(async () => {
        const mailboxID = await user2.getMailboxID()
        expect(mailboxID).to.not.be.undefined
        const closer = await user2.watchSentbox(mailboxID, callback)
        await delay(100)
        await user2.sendMessage(user2Id, user1Id.public, new TextEncoder().encode('watch'))
        setTimeout(() => {
          closer.close()
          expect(hitCallback).to.be.true
          done()
        }, 350)
      }, 500)
    }).timeout(5000)

    it('sentbox listen should return deletes', (done) => {
      const user2 = new Users(user2Ctx)
      let hitCallback = false
      const callback = async (reply?: MailboxEvent, err?: Error) => {
        expect(err).to.be.undefined
        expect(reply).to.not.be.undefined
        if (!reply) return done()
        expect(reply.type).to.equal('DELETE')
        hitCallback = true
      }
      setTimeout(async () => {
        const mailboxID = await user2.getMailboxID()
        expect(mailboxID).to.not.be.undefined
        const closer = await user2.watchSentbox(mailboxID, callback)
        await delay(100)
        const sentMessages = await user2.listSentboxMessages()
        expect(sentMessages.length).to.be.greaterThan(0)
        await user2.deleteSentboxMessage(sentMessages[0].id)
        setTimeout(() => {
          closer.close()
          expect(hitCallback).to.be.true
          done()
        }, 350)
      }, 500)
    }).timeout(5000)

    it('inbox listen should return saves', (done) => {
      const user1 = new Users(user1Ctx)
      let hitCallback = false
      const callback = async (reply?: MailboxEvent, err?: Error) => {
        expect(err).to.be.undefined
        expect(reply).to.not.be.undefined
        if (!reply) return done()
        expect(reply.type).to.equal('SAVE')
        hitCallback = true
      }
      setTimeout(async () => {
        const mailboxID = await user1.getMailboxID()
        expect(mailboxID).to.not.be.undefined
        const closer = await user1.watchInbox(mailboxID, callback)
        await delay(100)
        const inbox = await user1.listInboxMessages()
        expect(inbox.length).to.be.greaterThan(0)
        await user1.readInboxMessage(inbox[0].id)
        setTimeout(() => {
          closer.close()
          expect(hitCallback).to.be.true
          done()
        }, 350)
      }, 500)
    }).timeout(5000)

    it('inbox listen should return deletes', (done) => {
      const user1 = new Users(user1Ctx)
      let hitCallback = false
      const callback = async (reply?: MailboxEvent, err?: Error) => {
        expect(err).to.be.undefined
        expect(reply).to.not.be.undefined
        if (!reply) return done()
        expect(reply.type).to.equal('DELETE')
        hitCallback = true
      }
      setTimeout(async () => {
        const mailboxID = await user1.getMailboxID()
        expect(mailboxID).to.not.be.undefined
        const closer = await user1.watchInbox(mailboxID, callback)
        await delay(100)
        const inbox = await user1.listInboxMessages()
        expect(inbox.length).to.be.greaterThan(0)
        await user1.deleteInboxMessage(inbox[0].id)
        setTimeout(() => {
          closer.close()
          expect(hitCallback).to.be.true
          done()
        }, 350)
      }, 500)
    }).timeout(5000)
  })
})
