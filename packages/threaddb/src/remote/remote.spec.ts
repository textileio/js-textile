import { grpc } from '@improbable-eng/grpc-web'
import { PrivateKey } from '@textile/crypto'
import { Where } from '@textile/threads-client'
import { ThreadID } from '@textile/threads-id'
import { expect } from 'chai'
import { Errors, Remote } from '.'
import { ChangeTableName, StashTableName } from '../middleware/changes'
import { NewDexie } from '../utils'
import { shouldHaveThrown } from '../utils/spec.utils'
import { createDbClient } from './grpc'

const databaseName = 'remote'
const serviceHost = 'http://localhost:6007'

describe('ThreadDB', function () {
  describe('remote', function () {
    // Default Dog interface to work with types
    class Dog {
      constructor(
        public _id?: string,
        public name: string = 'Lucas',
        public age: number = 7,
      ) {}
    }
    const privateKey = PrivateKey.fromRandom()
    // NewDexie adds the tables we need automatically...
    const dexie = NewDexie(databaseName)
    // But we still need a version
    dexie.version(1).stores({
      dogs: '++_id,name,age', // ulid-based id, with indexes on name and age
    })
    dexie.table('dogs').mapToClass(Dog)
    // Create a single remote to use for all tests
    const remote: Remote = new Remote(dexie)

    before(async function () {
      // Make sure we're open for business
      await dexie.open()
    })

    after(async function () {
      // Cleanup time!
      dexie.close()
      await dexie.delete()
    })

    /**
     * Function to create a set of pre-defined udpates/changes
     */
    async function createChanges() {
      // Create some default changes...
      const dogs = dexie.table('dogs')
      // Change 1 | Dogs 1
      const lucas = await dogs.put(new Dog()) // Lucas is the default

      await dexie.transaction('rw', ['dogs'], async (tx) => {
        // Mask out reference to "dogs" above
        const dogs = tx.table('dogs')
        const friend = await dogs.get(lucas)
        ++friend.age
        // Change 2 | Dogs 1
        await dogs.put(friend)
        // Nested transactions (testing using object rather than string[])
        await dexie.transaction('rw', dogs, async () => {
          // Change 3 & 4 | Dogs 3
          // "id" is the id of the last add, so the id for Jefferson
          const id = await dogs.bulkAdd([
            new Dog(undefined, 'Jefferson', 9),
            new Dog(undefined, 'Clark', 13),
          ])
          const friend = await dogs.get(id)
          friend.name = 'Lewis'
          // Change 5 | Dogs 3
          await dogs.put(friend)
          // Change 6 | Dogs 2
          // Lucas and Jefferson remain
          await dogs.delete(id)
        })
      })
    }

    context('init and auth', function () {
      beforeEach(async function () {
        // Need to authorize before running any tests...
        // But we _could_ cache token if we had one from before...
        remote.set({ serviceHost })
        await remote.authorize(privateKey)
      })

      it('should have authorization token cached in internal metadata', function () {
        const [cached] = remote.config.metadata?.get('authorization') ?? []
        expect(cached).to.not.be.undefined
      })

      it('should throw when authorizing without a remote set', async function () {
        const cached = { ...remote.config }
        remote.config.serviceHost = undefined
        try {
          await remote.authorize(privateKey)
          throw shouldHaveThrown
        } catch (err) {
          expect(err).to.equal(Errors.NoRemoteError)
        }
        // Set it back for other tests
        remote.config = cached
      })

      it('should be able to re-authorize without error', async function () {
        // Re-authorize with same private key
        const token = await remote.authorize(privateKey)
        const other = PrivateKey.fromRandom()
        // This time use the callback flow
        const otherToken = await remote.authorize(
          other.public.toString(),
          (challenge: Uint8Array) => other.sign(challenge),
        )
        expect(otherToken).to.not.be.undefined
        expect(otherToken.length).to.equal(token.length)
        // Now have to put previous token back in place for subsequent tests
        remote.config.metadata?.set('authorization', token)
      })

      it('should be able to get and set config properties', function () {
        expect(remote.config).to.not.be.undefined
        expect(remote.config.serviceHost).to.not.be.undefined
        expect(remote.get().debug).to.equal(false)
        remote.set({ debug: true })
        expect(remote.config.debug).to.equal(true)
        expect(remote.get().debug).to.equal(true)
        // Ok, let's set it back because otherwise it floods our test outputs
        remote.set({ debug: false })
        const metadata = remote.config.metadata
        if (metadata === undefined)
          throw Error('metadata should not be undefined')
        const cached = metadata.get('authorization')
        expect(cached).to.not.be.undefined
        // Clear it out
        remote.config.metadata = new grpc.Metadata()
        expect(remote.config.metadata?.get('authorization')).to.deep.equal([])
        // Set it back
        remote.config.metadata = metadata
      })

      it('should throw if no remote db + thread has been created yet', async function () {
        try {
          await remote.pull()
          throw shouldHaveThrown
        } catch (err) {
          expect(err).to.equal(Errors.ThreadIDError)
        }
      })

      it('should create remote db on initialize, and throw when trying to re-create', async function () {
        this.timeout(5000)
        const id0 = ThreadID.fromRandom().toString() // Use a string
        const id1 = await remote.initialize(id0)
        expect(id1).to.not.be.undefined
        expect(ThreadID.fromString(id1).toString()).to.equal(id1)
        // Should throw here because we're trying to use an existing db id
        // Clear cached id just to be sure we're pulling from the db
        remote.id = undefined
        // Leave off id to default to existing id (stored in db)
        await remote.initialize() // Leave off id

        // Try with new random one, this isn't a good idea in practice, but is
        // allowed because we want to be able to migrate etc in the future
        // Application logic should be used to prevent this bad behavior for now
        const id2 = await remote.initialize(ThreadID.fromRandom()) // Use thread id object
        expect(id2).to.not.equal(id1)
      })
    })

    context('changes and stashing', function () {
      beforeEach(async function () {
        // Have to set timeout because this takes longer than normal setup
        this.timeout(30000)
        await createChanges()
      })

      it('should stash all changes and clear changes table, and then clear stash', async function () {
        // Before this, we've create some changes
        const changes = dexie.table(ChangeTableName)
        const stash = dexie.table(StashTableName)
        expect(await changes.count()).to.equal(6)
        expect(await stash.count()).to.equal(0)
        // Create a stash and clear out changes
        await remote.createStash()
        expect(await stash.count()).to.equal(6)
        expect(await changes.count()).to.equal(0)
        // We shouldn't have any changes to stash, so this should return quick!
        await remote.createStash()
        // Should still equal 6 (from before)
        expect(await stash.count()).to.equal(6)
        // Now we clear them all!
        await remote.clearStash()
        expect(await stash.count()).to.equal(0)
      })

      it('should be able to create changes, stash them, make more changes, apply stash to overwrite', async function () {
        this.timeout(30000)
        // Before this, we've create some changes
        const changes = dexie.table(ChangeTableName)
        const stash = dexie.table(StashTableName)
        // Create a stash and clear out changes
        await remote.createStash()
        // Simulate changes coming in via a pull from remote that overwrites local changes
        await dexie.transaction('rw', ['dogs'], async (tx) => {
          const dogs = tx.table<Dog>('dogs')
          // Should be defined
          const friend = await dogs.get({ name: 'Lucas' })
          if (friend === undefined) throw new Error('should be defined')
          friend.name = 'Not Lucas'
          await dogs.put(friend)
        })
        expect(await stash.count()).to.equal(6)
        expect(await changes.count()).to.equal(1)
        const dogs = dexie.table<Dog>('dogs')
        expect(await dogs.get({ name: 'Not Lucas' })).to.not.be.undefined
        // Now apply stash
        await remote.applyStash('dogs')
        const friend = await dogs.get({ name: 'Lucas' })
        if (friend === undefined) throw new Error('should be defined')
        // Make sure Clark is still removed
        const clark = await dogs.get({ name: 'Clark' })
        expect(clark).to.be.undefined
      })
    })

    context('push and pull', function () {
      before(async function () {
        // Need to authorize before running any tests...
        // But we _could_ cache token if we had one from before...
        remote.set({ serviceHost })
        await remote.authorize(privateKey)
      })

      beforeEach(async function () {
        // Have to set timeout because this takes longer than normal setup
        this.timeout(30000)
        // If we're running these tests in batch, we need to initialize a new thread each time
        // to avoid hanging instances
        await remote.initialize(ThreadID.fromRandom())
        // Clear tables
        await dexie.table('dogs').clear()
        await dexie.table(ChangeTableName).clear()
        // Create some fresh updates
        await createChanges()
      })

      it('should throw when pushing local table that does not exist', async function () {
        const changes = dexie.table(ChangeTableName)
        expect(await changes.count()).to.equal(6)
        try {
          await remote.push('fake') // Fake is not a real collection name!
          throw shouldHaveThrown
        } catch (err) {
          expect(err.toString()).to.contain('Table fake does not exist')
        }
      })

      it('should push tracked changes to a remote when calling push', async function () {
        const threadID = ThreadID.fromString(remote.id ?? '')
        // Low level check to make sure we have our changes
        const changes = dexie.table(ChangeTableName)
        const count = await changes.count()
        expect(count).to.equal(6)
        await remote.push('dogs')
        expect(await changes.count()).to.equal(0)
        // Trying again should not lead to any issues
        await remote.push('dogs') // Push everything this time... except we have none!
        // Low level checks
        const client = createDbClient(remote.config)
        const dogs = dexie.table('dogs')
        const total = await dogs.count()
        expect(total).to.equal(2)
        const q = new Where('age').gt(0)
        const instances = await client.find(threadID, 'dogs', q)
        expect(instances).to.have.lengthOf(total)
      })

      it('should pull changes from remote and automatically update local db', async function () {
        this.timeout(5000)
        //Should fail to pull if we already have local changes to push
        try {
          await remote.pull('dogs')
          throw shouldHaveThrown
        } catch (err) {
          expect(err).to.equal(Errors.LocalChangesError)
        }
        // Ok, now we'll push them
        await remote.push('dogs')
        // There should be no new updates on the remote that we don't know about yet
        // Pulling in this case should do nothing, though in practice (for now) we still update
        const changed1 = await remote.pull('dogs')
        expect(changed1).to.have.lengthOf(0)
        // Ok, now we'll make a low-level update on the remote and see what happens
        const threadID = ThreadID.fromString(remote.id ?? '')
        // Low level checks
        const client = createDbClient(remote.config)
        const dogs = dexie.table<Dog>('dogs')
        const array = await dogs.toArray() // Should be two in there
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await client.delete(threadID, 'dogs', [array[0]._id!])
        array[1].name = 'Mod'
        await client.save(threadID, 'dogs', [array[1]])
        const changed2 = await remote.pull('dogs')
        expect(changed2).to.have.lengthOf(2)
        expect(await dogs.count()).to.equal(1)
      })
    })
  })
})
