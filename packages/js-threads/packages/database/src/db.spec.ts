/* eslint-disable import/first */
// 'Hack' to get WebSocket in the global namespace on nodejs
;(global as any).WebSocket = require('isomorphic-ws')

import path from 'path'
import { expect } from 'chai'
import { Context } from '@textile/context'
import { UserAuth } from '@textile/security'
import { Multiaddr, ThreadID } from '@textile/threads-core'
import LevelDatastore from 'datastore-level'
import delay from 'delay'
import { isBrowser } from 'browser-or-node'
import { Key } from 'interface-datastore'
import { DomainDatastore, Dispatcher, Update, Op } from '@textile/threads-store'
import { Network, Client } from '@textile/threads-network'
import { MemoryDatastore } from 'interface-datastore'
import { Database, mismatchError } from './db'
import { EventBus } from './eventbus'
import { threadAddr } from './utils'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const level = require('level')

interface DummyInstance {
  _id: string
  name: string
  counter: number
}

/**
 * Runs a complex db use-case, and returns events received according to the provided options.
 * @param los: The action path to listen on. Paths are structured as: <collection>.<id>.<type>,
 * and support wildcards. For example, <collection>.*.* will listen to all events for a given
 * collection. Double wildcard (**) is recursive, so <collection>.** will also listen to call
 * events on a collection. Similarly, ** listens to all events on all collections.
 */
async function runListenersComplexUseCase(los: string[]) {
  const store = new MemoryDatastore()
  const db = new Database(store)
  const Collection1 = await db.newCollectionFromObject<DummyInstance>('Collection1', {
    _id: '',
    name: '',
    counter: 0,
  })

  const Collection2 = await db.newCollectionFromObject<DummyInstance>('Collection2', {
    _id: '',
    name: '',
    counter: 0,
  })

  // Create some instance *before* any listener, just to test that it doesn't appear on a
  // listener's "stream".
  const i1 = new Collection1({ _id: 'id-i1', name: 'Textile1' })
  await i1.save()
  await delay(500)

  const events: Update[] = []
  // @todo: Should we wrap this in a 'listen' method instead?
  for (const name of los) {
    db.emitter.on(name, (update: any) => {
      events.push(update)
    })
  }

  // Collection1 save i1
  i1.name = 'Textile0'
  await i1.save()

  // Collection1 create i2
  const i2 = new Collection1({ _id: 'id-i2', name: 'Textile2' })
  await i2.save()

  // Collection2 create j1
  const j1 = new Collection2({ _id: 'id-j1', name: 'Textile3' })
  await j1.save()

  // Collection1 save i1
  // Collection1 save i2
  await Collection1.writeTransaction(async (c) => {
    i1.counter = 30
    i2.counter = 11
    await c.save(i1, i2)
  })

  // Collection2 save j1
  j1.counter = -1
  j1.name = 'Textile33'
  await j1.save()

  // Collection1 delete i1
  await Collection1.delete(i1._id)

  // Collection2 delete j1 (use alternate API)
  await j1.remove()

  // Collection2 delete i2
  await Collection1.delete(i2._id)

  db.emitter.removeAllListeners()
  await db.close()
  // Expected generated actions:
  // Collection1 Save i1
  // Collection1 Create i2
  // Collection2 Create j1
  // Save i1
  // Save i2
  // Collection2 Save j1
  // Delete i1
  // Collection2 Delete j1
  // Delete i2
  return events
}

describe('Database', () => {
  describe('end to end test', () => {
    it('should allow paired peers to exchange updates', async function () {
      if (isBrowser) return this.skip() // Don't run in browser
      if (process.env.CI) return this.skip() // Don't run in CI (too slow)
      // Peer 1: Create db1, register a collection, create and update an instance.
      const d1 = new Database(new MemoryDatastore())
      const ident1 = await Database.randomIdentity()
      await d1.start(ident1)
      const id1 = d1.threadID
      if (id1 === undefined) {
        throw new Error('should not be invalid thread id')
      }
      // Create a new collection
      const Dummy1 = await d1.newCollectionFromObject<DummyInstance>('dummy', {
        _id: '',
        name: '',
        counter: 0,
      })

      // Boilerplate to generate peer1 thread-addr
      const hostID = await d1.network.getHostID()
      // const addrs = await d1.getInfo() // Normally we'd use this, but we're in Docker...
      const hostAddr = new Multiaddr('/dns4/threads1/tcp/4006')
      const addr = threadAddr(hostAddr, hostID.toB58String(), id1.toString())

      // Peer 2: Create a completely parallel db2, which will sync with the previous one and should
      // have the same state of dummy.
      const info = await d1.network.getThread(id1)
      const datastore = new MemoryDatastore()
      const client = new Client(new Context('http://127.0.0.1:6207'))
      const network = new Network(new DomainDatastore(datastore, new Key('network')), client)
      const d2 = new Database(datastore, { network })
      const ident2 = await Database.randomIdentity()
      await d2.startFromAddress(ident2, addr, info.key)
      // Create parallel collection
      const Dummy2 = await d2.newCollectionFromObject<DummyInstance>('dummy', {
        _id: '',
        name: '',
        counter: 0,
      })

      const dummy1 = new Dummy1({ name: 'Textile1', counter: 0 })
      dummy1.counter += 42
      await dummy1.save()

      await delay(1000)
      const dummy2 = await Dummy2.findById(dummy1._id)
      expect(dummy2.name).to.equal(dummy1.name)
      expect(dummy2.counter).to.equal(dummy1.counter)

      // Now the other way around
      dummy2.counter = 13
      await Dummy2.save(dummy2)

      await delay(1000)
      const dummy3 = await Dummy1.findById(dummy2._id)
      expect(dummy3.name).to.equal(dummy2.name)
      expect(dummy3.counter).to.equal(dummy2.counter)

      await d1.close()
      await d2.close()
    }).timeout(6000)
  })

  describe('Persistence', () => {
    const tmp = path.join(__dirname, './test.db')
    after(() => {
      level.destroy(tmp, () => {
        return
      })
    })

    it('should work with a persistent database and custom options', async function () {
      if (isBrowser) return this.skip()
      const datastore = new LevelDatastore(tmp)
      if (datastore) await (datastore as any).db.clear()
      const dispatcher = new Dispatcher(new DomainDatastore(datastore, new Key('dispatcher')))
      const network = new Network(new DomainDatastore(datastore, new Key('network')), new Client())
      const eventBus = new EventBus(new DomainDatastore(datastore, new Key('eventbus')), network)
      const db = new Database(datastore, { dispatcher, network, eventBus })

      const id = ThreadID.fromRandom(ThreadID.Variant.Raw, 32)
      await db.start(await Database.randomIdentity(), { threadID: id })

      await db.newCollectionFromObject<DummyInstance>('dummy', {
        _id: '',
        name: '',
        counter: 0,
      })
      // Re-do again to re-use id. If something wasn't closed correctly, would fail
      await db.close() // Closes eventBus and datastore
      await db.start(await Database.randomIdentity(), { threadID: id })
      expect(db.collections.size).to.equal(1)
      await db.close()
    })
  })

  describe('Events', () => {
    const assertEvents = (events: Update[], expected: Update[]) => {
      expect(events).to.have.length(expected.length)
      for (const i in events) {
        expect(events[i]).to.deep.include(expected[i])
      }
    }

    it('should listen to all db events', async () => {
      const actions = await runListenersComplexUseCase(['**'])
      const expected: Update[] = [
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Create, id: 'id-i2' },
        { collection: 'Collection2', type: Op.Type.Create, id: 'id-j1' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i2' },
        { collection: 'Collection2', type: Op.Type.Save, id: 'id-j1' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i1' },
        { collection: 'Collection2', type: Op.Type.Delete, id: 'id-j1' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i2' },
      ]
      assertEvents(actions, expected)
    })

    it('should listen to events on collection 1 only', async () => {
      const actions = await runListenersComplexUseCase(['Collection1.**'])
      const expected: Update[] = [
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Create, id: 'id-i2' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i2' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i2' },
      ]
      assertEvents(actions, expected)
    })

    it('should listen to events on collection 2 only', async () => {
      const actions = await runListenersComplexUseCase(['Collection2.**'])
      const expected: Update[] = [
        { collection: 'Collection2', type: Op.Type.Create, id: 'id-j1' },
        { collection: 'Collection2', type: Op.Type.Save, id: 'id-j1' },
        { collection: 'Collection2', type: Op.Type.Delete, id: 'id-j1' },
      ]
      assertEvents(actions, expected)
    })

    it('should listen to any create events', async () => {
      const actions = await runListenersComplexUseCase([`**.${Op.Type.Create}`])
      const expected: Update[] = [
        { collection: 'Collection1', type: Op.Type.Create, id: 'id-i2' },
        { collection: 'Collection2', type: Op.Type.Create, id: 'id-j1' },
      ]
      assertEvents(actions, expected)
    })

    it('should listen to any save events', async () => {
      const actions = await runListenersComplexUseCase([`**.${Op.Type.Save}`])
      const expected: Update[] = [
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i2' },
        { collection: 'Collection2', type: Op.Type.Save, id: 'id-j1' },
      ]
      assertEvents(actions, expected)
    })

    it('should listen to any delete events', async () => {
      const actions = await runListenersComplexUseCase([`**.${Op.Type.Delete}`])
      const expected: Update[] = [
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i1' },
        { collection: 'Collection2', type: Op.Type.Delete, id: 'id-j1' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i2' },
      ]
      assertEvents(actions, expected)
    })

    it('should listen to any collection1 events or delete events on collection2', async () => {
      const actions = await runListenersComplexUseCase([
        'Collection1.**',
        `Collection2.*.${Op.Type.Delete}`,
      ])
      const expected: Update[] = [
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Create, id: 'id-i2' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i1' },
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i2' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i1' },
        { collection: 'Collection2', type: Op.Type.Delete, id: 'id-j1' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i2' },
      ]
      assertEvents(actions, expected)
    })

    it('should not listen to any events for non-existant collections', async () => {
      const actions = await runListenersComplexUseCase(['Collection3.**'])
      const expected: Update[] = []
      assertEvents(actions, expected)
    })

    it('should listen to various complex mixed event types', async () => {
      const actions = await runListenersComplexUseCase([
        `Collection2.*.${Op.Type.Save}`,
        `Collection1.id-i2.${Op.Type.Save}`,
        `Collection1.id-i1.${Op.Type.Delete}`,
        `Collection2.id-j1.${Op.Type.Delete}`,
      ])
      const expected: Update[] = [
        { collection: 'Collection1', type: Op.Type.Save, id: 'id-i2' },
        { collection: 'Collection2', type: Op.Type.Save, id: 'id-j1' },
        { collection: 'Collection1', type: Op.Type.Delete, id: 'id-i1' },
        { collection: 'Collection2', type: Op.Type.Delete, id: 'id-j1' },
      ]
      assertEvents(actions, expected)
    })
  })

  describe('Basic', () => {
    const tmp = path.join(__dirname, './test.db')
    after(() => {
      level.destroy(tmp, (_err: Error) => {
        return
      })
    })
    it('should return valid addrs and keys for sharing', async () => {
      const store = new MemoryDatastore()
      const db = new Database(store)
      const threadID = ThreadID.fromRandom()
      await db.start(await Database.randomIdentity(), { threadID })
      const info = await db.getInfo()
      expect(info?.addrs?.size).to.be.greaterThan(1)
      expect(info?.key).to.not.be.undefined
      await db.close()
    })

    it('should automatically open if not yet "opened"', async function () {
      if (isBrowser) return this.skip()
      const child = new LevelDatastore(tmp)
      const db = new Database(child)
      const Col = await db.newCollectionFromObject('blah', { _id: '' })
      expect(Col).to.not.be.undefined
      await db.close()
    })

    it('should throw if our database and thread id do not match', async function () {
      const store = new MemoryDatastore()
      let db = new Database(store)
      const ident = await Database.randomIdentity()
      await db.start(ident, { threadID: ThreadID.fromRandom() })
      await db.close()
      // Now 'reopen' the database
      db = new Database(store)
      try {
        await db.start(ident, { threadID: ThreadID.fromRandom() })
        throw new Error('should have throw')
      } catch (err) {
        expect(err).to.equal(mismatchError)
      }
      await db.close()
    })

    it('start a functional db using withUserAuth', async () => {
      const store = new MemoryDatastore()

      // We'll just use a dummy auth here. Hub auth should be tested in @textile/hub
      const auth: UserAuth = {
        key: '',
        sig: '',
        msg: new Date(Date.now() + 1000 * 60).toUTCString(),
      }
      const db = Database.withUserAuth(auth, store, {}, 'http://localhost:6007')
      const threadID = ThreadID.fromRandom()
      await db.start(await Database.randomIdentity(), { threadID })

      await db.newCollectionFromObject<DummyInstance>('dummy', {
        _id: '',
        name: '',
        counter: 0,
      })

      const info = await db.getInfo()
      expect(info?.addrs?.size).to.be.greaterThan(1)
      expect(info?.key).to.not.be.undefined
      await db.close()
    })
  })
})
