import { Context } from '@textile/context'
import { PrivateKey, PublicKey } from '@textile/crypto'
import {
  acceptInvite,
  addrApiurl,
  addrGatewayUrl,
  createEmail,
  createUsername,
  sessionSecret,
} from '@textile/testing'
import { expect } from 'chai'
import { Admin } from './admin'
import { SigninOrSignupResponse } from './api'
import { signin, signup } from './spec.utils'

const wrongError = new Error('wrong error!')

describe('Hub Admin...', function () {
  // Freeze context for rehydration use only
  const ctx = Object.freeze(new Context(addrApiurl))
  let dev: SigninOrSignupResponse
  const email = createEmail()
  const username = createUsername()

  before(async function () {
    this.timeout(10000)
    const admin = new Admin(ctx)
    dev = await signup(admin, username, email, addrGatewayUrl, sessionSecret)
  })

  context('Account creation', function () {
    it('should already be signed up', function () {
      expect(dev.key).to.not.be.undefined
      expect(dev.session).to.not.be.undefined
    })

    it('should sign out', async function () {
      let admin = new Admin(ctx)
      try {
        // Without session
        await admin.signOut()
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.message).to.include('Session or API key required')
      }
      // With session
      admin = new Admin(new Context(addrApiurl).withSession(dev.session))
      const res = await admin.signOut()
      expect(res).to.be.undefined
    })

    it('should sign in', async function () {
      let admin = new Admin(new Context(addrApiurl).withSession(dev.session))
      // Sign in first (previous test signed out)
      const user = await signin(admin, username, addrGatewayUrl, sessionSecret)
      expect(user.key).to.not.be.undefined
      expect(user.session).to.not.be.undefined
      const creds = new Context(addrApiurl).withSession(user.session)
      // Sign back out before sign in again
      admin = new Admin(creds)
      await admin.signOut()
      // Reassign to dev for the next set of tests
      dev = await signin(admin, username, addrGatewayUrl, sessionSecret)
      expect(user.key).to.not.be.undefined
      expect(user.session).to.not.be.undefined
    })

    it('should get session info', async function () {
      let admin = new Admin(ctx)
      try {
        // Without session
        await admin.getSessionInfo()
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.message).to.include('Session or API key required')
      }
      // With session
      const creds = new Context(addrApiurl).withSession(dev.session)
      // Sign back out before sign in again
      admin = new Admin(creds)
      const res = await admin.getSessionInfo()
      expect(res.key).to.equal(dev.key)
      expect(res.username).to.equal(username)
      expect(res.email).to.equal(email)
    })

    it('should get identity', async function () {
      let admin = new Admin(ctx)
      try {
        // Without session
        await admin.getIdentity()
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.message).to.include('Session or API key required')
      }
      // With session
      const creds = new Context(addrApiurl).withSession(dev.session)
      admin = new Admin(creds)
      const res = await admin.getIdentity()
      const priv = PrivateKey.fromString(res)
      const pub = PublicKey.fromString(dev.key)
      expect(pub.toString()).to.equal(priv.public.toString())
    })
  })

  context('Keys', function () {
    it('should create keys', async function () {
      let admin = new Admin(ctx)
      try {
        // Without session
        await admin.createKey()
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.message).to.include('Session or API key required')
      }
      // With session
      const creds = new Context(addrApiurl).withSession(dev.session)
      admin = new Admin(creds)
      const key = await admin.createKey()
      expect(key).to.have.ownProperty('key')
      expect(key).to.have.ownProperty('secret')
    })

    it('should invalidate keys', async function () {
      const creds = new Context(addrApiurl).withSession(dev.session)
      const admin = new Admin(creds)
      const key = await admin.createKey()
      try {
        // Without session
        const nope = new Admin(ctx)
        await nope.invalidateKey(key.key)
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.message).to.include('Session or API key required')
      }
      // With session
      await admin.invalidateKey(key.key)
      const list = await admin.listKeys()
      expect(list.length).to.be.greaterThan(0)
      // Expect there to be only one invalid key, note the reversed `?` check
      expect(
        list.reduce((sum, curr) => sum + (curr.valid ? 0 : 1), 0),
      ).to.equal(1)
    })

    it('should list keys', async function () {
      const creds = new Context(addrApiurl).withSession(dev.session)
      const admin = new Admin(creds)

      // Initial, should be empty or more depending on test run
      const existing = (await admin.listKeys()).length

      await admin.createKey()
      await admin.createKey()

      // Not empty
      const list = await admin.listKeys()
      expect(list.length).to.equal(existing + 2)
    })
  })

  context('Orgs...', function () {
    it('should create an org', async function () {
      let admin = new Admin(ctx)
      const name = createUsername()
      try {
        // Without session
        await admin.createOrg(name)
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.message).to.include('Session or API key required')
      }
      // With session
      const creds = new Context(addrApiurl).withSession(dev.session)
      admin = new Admin(creds)
      const key = await admin.createOrg(name)
      expect(key).to.have.ownProperty('key')
      expect(key).to.have.ownProperty('name')
    })

    it('should get org', async function () {
      this.timeout(5000)
      const name = createUsername()
      const creds = new Context(addrApiurl).withSession(dev.session)
      const admin = new Admin(creds)
      const org = await admin.createOrg(name)
      try {
        // Bad org (should mutate in place, returning just for good measure)
        await admin.getOrg('bad')
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.message).to.include('not an org member')
      }
      // Good org
      const got = await admin.getOrg(name)
      expect(got.key).to.equal(org.key)
    })

    it('should list orgs', async function () {
      const creds = new Context(addrApiurl).withSession(dev.session)
      const admin = new Admin(creds)
      // Before
      const existing = await admin.listOrgs()

      await admin.createOrg(`org.${Math.random()}`)
      await admin.createOrg(`org.${Math.random()}`)

      // Not empty
      const list = await admin.listOrgs()
      // Should be 2+ depending on test run
      expect(list).to.have.lengthOf(existing.length + 2)
    })

    it('should create and list keys specific to an org', async function () {
      const creds = new Context(addrApiurl).withSession(dev.session)
      const admin = new Admin(creds)
      // Grab the first org
      const [org] = await admin.listOrgs()

      const key = await admin.createKey(org.name)
      expect(key).to.not.be.undefined

      // The key should be scoped to the org
      let list = await admin.listKeys() // Don't pass org
      let mapped = list.map((key) => key.key)
      // So not visible here
      expect(mapped).to.not.include(key.key)
      list = await admin.listKeys(org.name)
      mapped = list.map((key) => key.key)
      // But visible here
      expect(mapped).to.include(key.key)
    })

    it('should remove orgs', async function () {
      this.timeout(5000)
      const name = createUsername()
      let creds = new Context(addrApiurl).withSession(dev.session)
      let admin = new Admin(creds)
      const org = await admin.createOrg(name)
      try {
        // Bad org
        await admin.removeOrg('bad')
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.message).to.include('not an org member')
      }

      try {
        // Without session
        admin = new Admin(ctx)
        await admin.removeOrg('bad')
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.message).to.include('Session or API key required')
      }
      // Good org
      creds = new Context(addrApiurl).withSession(dev.session)
      admin = new Admin(creds)
      await admin.removeOrg(org.name)
      try {
        await admin.getOrg(org.name)
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.message).to.include('not an org member')
      }
    })

    it('should invite to org', async function () {
      this.timeout(5000)
      const name = createUsername()
      const creds = new Context(addrApiurl).withSession(dev.session)
      const admin = new Admin(creds)
      const org = await admin.createOrg(name)
      try {
        // Bad email
        await admin.inviteToOrg('jane', org.name)
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
      }
      // Good email
      const token = await admin.inviteToOrg(createEmail(), name)
      const accepted = await acceptInvite(addrGatewayUrl, token)
      expect(accepted).to.be.true
    })

    it('should leave an org', async function () {
      this.timeout(10000)
      const name = createUsername()
      const creds = new Context(addrApiurl).withSession(dev.session)
      const admin = new Admin(creds)
      const org = await admin.createOrg(name)
      try {
        // As owner
        await admin.leaveOrg(name)
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
      }
      const [username, email] = [createUsername(), createEmail()]
      const user = await signup(
        admin,
        username,
        email,
        addrGatewayUrl,
        sessionSecret,
      )
      const userCtx = new Context(addrApiurl).withSession(user.session)
      const userAdmin = new Admin(userCtx)
      try {
        // As non-member
        await userAdmin.leaveOrg(org.name)
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
        expect(err.message).to.include('not an org member')
      }

      const token = await admin.inviteToOrg(email, org.name)
      await acceptInvite(addrGatewayUrl, token)
      // As member
      const res = await userAdmin.leaveOrg(org.name)
      expect(res).to.be.undefined
    })
  })

  context.skip('Billing', function () {
    it('should allow a dev to setup billing', async function () {
      // noop
    })

    it('should allow a dev to get a billing session url', async function () {
      // noop
    })

    it('should allow a dev to list users their account is responsible for', async function () {
      // noop
    })
  })

  context('Utils', function () {
    it('should check that a username is available', async function () {
      this.timeout(5000)
      const username = createUsername()
      const email = createEmail()
      const creds = new Context(addrApiurl).withSession(dev.session)
      const admin = new Admin(creds)
      let available = await admin.isUsernameAvailable(username)
      expect(available).to.be.true

      await signup(admin, username, email, addrGatewayUrl, sessionSecret)
      available = await admin.isUsernameAvailable(username)
      expect(available).to.be.false
    })

    it('should check that an org name is available', async function () {
      this.timeout(5000)
      const username = createUsername()
      const email = createEmail()
      let admin = new Admin(ctx)
      const user = await signup(
        admin,
        username,
        email,
        addrGatewayUrl,
        sessionSecret,
      )

      const creds = new Context(addrApiurl).withSession(user.session)
      const name = `org.${Math.random()}`
      const slugged = name.replace(/[.]/g, '-')

      admin = new Admin(creds)
      const res = await admin.isOrgNameAvailable(name)
      expect(res).to.have.ownProperty('slug', slugged)

      const org = await admin.createOrg(name)
      expect(org.slug).to.equal(res.slug)

      try {
        await admin.isOrgNameAvailable(name)
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
      }
    })

    it('should allow a user to destroy their account', async function () {
      this.timeout(5000)
      const username = createUsername()
      const email = createEmail()
      const creds = new Context(addrApiurl).withSession(dev.session)
      const admin = new Admin(creds)

      const user = await signup(
        admin,
        username,
        email,
        addrGatewayUrl,
        sessionSecret,
      )

      const userCtx = new Context(addrApiurl).withSession(user.session)
      const userAdmin = new Admin(userCtx)
      const res = await userAdmin.destroyAccount()
      expect(res).to.be.undefined

      // Now check that it is actually gone, should throw
      try {
        await signin(userAdmin, username, addrGatewayUrl, sessionSecret)
        throw wrongError
      } catch (err) {
        expect(err).to.not.equal(wrongError)
      }
    })
  })
})
