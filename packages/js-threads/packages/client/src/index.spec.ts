/* eslint-disable import/first */
;(global as any).WebSocket = require('isomorphic-ws')

import { Identity, Libp2pCryptoIdentity } from '@textile/threads-core'

import { expect } from 'chai'
import { Provider } from '@textile/context'
import { Where, ReadTransaction, WriteTransaction } from './models'
import { Client, ThreadID } from './index'

const personSchema = {
  $id: 'https://example.com/person.schema.json',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Person',
  type: 'object',
  required: ['_id'],
  properties: {
    _id: {
      type: 'string',
      description: "The instance's id.",
    },
    firstName: {
      type: 'string',
      description: "The person's first name.",
    },
    lastName: {
      type: 'string',
      description: "The person's last name.",
    },
    age: {
      description: 'Age in years which must be equal to or greater than zero.',
      type: 'integer',
      minimum: 0,
    },
  },
}

interface Person {
  _id: string
  firstName: string
  lastName: string
  age: number
}

const createPerson = (): Person => {
  return {
    _id: '',
    firstName: 'Adam',
    lastName: 'Doe',
    age: 21,
  }
}

describe('Client', function () {
  const dbID = ThreadID.fromRandom()
  let dbKey: string
  let dbAddr: string
  let identity: Identity
  const client = new Client(new Provider('http://127.0.0.1:6007'))

  before(async () => {
    identity = await Libp2pCryptoIdentity.fromRandom()
  })

  describe('.newDB', () => {
    it('response should succeed', async () => {
      await client.getToken(identity)
      await client.newDB(dbID)
    })
  })
  describe('.newCollection', () => {
    it('response should be defined and be an empty object', async () => {
      const register = await client.newCollection(dbID, 'Person', personSchema)
      expect(register).to.be.undefined
    })
  })
  describe('.getDBInfo', () => {
    it('response should be defined and be an array of strings', async () => {
      const invites = await client.getDBInfo(dbID)
      expect(invites).to.not.be.undefined
      expect(invites[0].address).to.not.be.undefined
      expect(invites[0].key).to.not.be.undefined
      dbKey = invites[0].key
      dbAddr = invites[0].address
      expect(invites).to.not.be.empty
    })
  })

  describe('.newDBFromAddr', () => {
    it('response should be defined and be an empty object', async () => {
      try {
        await client.newDBFromAddr((dbAddr as unknown) as string, dbKey, [])
      } catch (err) {
        // Expect this db to already exist on this peer
        expect(err.toString().endsWith('already exists')).to.be.true
      }
    })
  })
  describe('.create', () => {
    it('response should contain a JSON parsable instancesList', async () => {
      const instances = await client.create(dbID, 'Person', [createPerson()])
      expect(instances.length).to.equal(1)
    })
  })
  describe('.save', () => {
    it('response should be defined and be an empty object', async () => {
      const person = createPerson()
      const instances = await client.create(dbID, 'Person', [person])
      expect(instances.length).to.equal(1)
      person._id = instances[0]
      person!.age = 30
      const save = await client.save(dbID, 'Person', [person])
      expect(save).to.be.undefined
    })
  })
  describe('.delete', () => {
    it('response should be defined and be an empty object', async () => {
      const instances = await client.create(dbID, 'Person', [createPerson()])
      expect(instances.length).to.equal(1)
      const personID = instances[0]
      const deleted = await client.delete(dbID, 'Person', [personID])
      expect(deleted).to.be.undefined
    })
  })
  describe('.has', () => {
    it('the created object should also return true for has', async () => {
      const instances = await client.create(dbID, 'Person', [createPerson()])
      // Here we 'test' a different approach where we didn't use generics above to create the instance...
      expect(instances.length).to.equal(1)
      const has = await client.has(dbID, 'Person', instances)
      expect(has).to.be.true
    })
  })
  describe('.find', () => {
    it('response should contain the same instance based on query', async () => {
      const frank = createPerson()
      frank.firstName = 'Frank'
      const instances = await client.create(dbID, 'Person', [frank])
      expect(instances.length).to.equal(1)
      const personID = instances[0]

      const q = new Where('firstName').eq(frank.firstName)
      const find = await client.find<Person>(dbID, 'Person', q)
      expect(find).to.not.be.undefined
      const found = find.instancesList
      expect(found).to.have.length(1)
      const foundPerson = found.pop()!
      expect(foundPerson).to.not.be.undefined
      expect(foundPerson).to.have.property('firstName', 'Frank')
      expect(foundPerson).to.have.property('lastName', 'Doe')
      expect(foundPerson).to.have.property('age', 21)
      expect(foundPerson).to.have.property('_id')
      expect(foundPerson['_id']).to.equal(personID)
    })
  })
  describe('.findById', () => {
    it('response should contain a JSON parsable instance property', async () => {
      const instances = await client.create(dbID, 'Person', [createPerson()])
      const personID = instances.pop()!
      const find = await client.findByID<Person>(dbID, 'Person', personID)
      expect(find).to.not.be.undefined
      expect(find).to.haveOwnProperty('instance')
      const instance = find.instance
      expect(instance).to.not.be.undefined
      expect(instance).to.have.property('firstName', 'Adam')
      expect(instance).to.have.property('lastName', 'Doe')
      expect(instance).to.have.property('age', 21)
      expect(instance).to.have.property('_id')
    })
  })
  describe('.readTransaction', () => {
    let existingPersonID: string
    let transaction: ReadTransaction | undefined
    before(async () => {
      const instances = await client.create(dbID, 'Person', [createPerson()])
      existingPersonID = instances.pop()!
      transaction = client.readTransaction(dbID, 'Person')
    })
    it('should start a transaction', async () => {
      expect(transaction).to.not.be.undefined
      await transaction!.start()
    })
    it('should able to check for an existing instance', async () => {
      const has = await transaction!.has([existingPersonID])
      expect(has).to.be.true
    })
    it('should be able to find an existing instance', async () => {
      const find = await transaction!.findByID<Person>(existingPersonID)
      expect(find).to.not.be.undefined
      expect(find).to.haveOwnProperty('instance')
      const instance = find!.instance
      expect(instance).to.not.be.undefined
      expect(instance).to.have.property('firstName', 'Adam')
      expect(instance).to.have.property('lastName', 'Doe')
      expect(instance).to.have.property('age', 21)
      expect(instance).to.have.property('_id')
      expect(instance['_id']).to.deep.equal(existingPersonID)
    })
    it('should be able to close/end an transaction', async () => {
      await transaction!.end()
    })
  })
  describe('.writeTransaction', () => {
    const person = createPerson()
    let existingPersonID: string
    let transaction: WriteTransaction | undefined
    before(async () => {
      const instances = await client.create(dbID, 'Person', [person])
      existingPersonID = instances.length ? instances[0] : ''
      person['_id'] = existingPersonID
      transaction = client.writeTransaction(dbID, 'Person')
    })
    it('should start a transaction', async () => {
      expect(transaction).to.not.be.undefined
      await transaction!.start()
    })
    it('should be able to create an instance', async () => {
      const newPerson = createPerson()
      const entities = await transaction!.create<Person>([newPerson])
      expect(entities).to.not.be.undefined
      expect(entities!.length).to.equal(1)
    })
    it('should able to check for an existing instance', async () => {
      const has = await transaction!.has([existingPersonID])
      expect(has).to.be.true
    })
    it('should be able to find an existing instance', async () => {
      const find = await transaction!.findByID<Person>(existingPersonID)
      expect(find).to.not.be.undefined
      expect(find).to.haveOwnProperty('instance')
      const instance = find!.instance
      expect(instance).to.not.be.undefined
      expect(instance).to.have.property('firstName', 'Adam')
      expect(instance).to.have.property('lastName', 'Doe')
      expect(instance).to.have.property('age', 21)
      expect(instance).to.have.property('_id')
      expect(instance['_id']).to.deep.equal(existingPersonID)
    })
    it('should be able to save an existing instance', async () => {
      person.age = 99
      const saved = await transaction!.save([person])
      expect(saved).to.be.undefined
      const deleted = await transaction!.delete([person._id])
      expect(deleted).to.be.undefined
    })
    it('should be able to close/end an transaction', async () => {
      await transaction!.end()
    })
  })
  describe('.listen', () => {
    const listener: { events: number; close?: () => void } = { events: 0 }
    const person = createPerson()
    before(async () => {
      const entities = await client.create(dbID, 'Person', [person])
      person._id = entities[0]
    })
    it('should stream responses.', (done) => {
      const callback = (reply: any, err?: Error) => {
        if (err) {
          throw err
        }
        const instance = reply?.instance
        expect(instance).to.not.be.undefined
        expect(instance).to.have.property('age')
        expect(instance?.age).to.be.greaterThan(21)
        listener.events += 1
        if (listener.events > 1 && listener.close) {
          listener.close()
        }
        if (listener.events == 2) {
          done()
        }
      }
      listener.close = client.listen<Person>(
        dbID,
        [
          {
            collectionName: 'Person',
            actionTypes: ['ALL'],
          },
        ],
        callback,
      )
      setTimeout(() => {
        const person = createPerson()
        person.age = 40
        client.create(dbID, 'Person', [person])
        client.create(dbID, 'Person', [person])
      }, 1000)
    }).timeout(15000) // Make sure our test doesn't timeout
  })
  describe('Query', () => {
    before(async () => {
      const people = [...Array(8)].map((_, i) => {
        const person = createPerson()
        person.age = 60 + i
        return person
      })
      await client.create(dbID, 'Person', people)
    })
    it('Should return a full list of entities matching the given query', async () => {
      const q = new Where('age').ge(60).and('age').lt(66).or(new Where('age').eq(67))
      const find = await client.find<Person>(dbID, 'Person', q)
      expect(find).to.not.be.undefined
      const found = find.instancesList
      expect(found).to.have.length(7)
    })
  })

  describe('Restart', () => {
    it('Should handle a whole new "restart" of the client', async () => {
      const newClient = new Client(new Provider('http://127.0.0.1:6007'))
      const person = createPerson()
      await newClient.getToken(identity)
      const created = await newClient.create(dbID, 'Person', [person])
      const got = await newClient.findByID(dbID, 'Person', created[0])
      expect(got.instance).to.haveOwnProperty('_id', created[0])
      expect(got.instance).to.haveOwnProperty('firstName', 'Adam')
    })
  })
})
