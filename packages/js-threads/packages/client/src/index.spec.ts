/* eslint-disable no-var */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Context } from "@textile/context"
import { Identity, PrivateKey } from "@textile/crypto"
import { ThreadID } from "@textile/threads-id"
import { expect } from "chai"
import { Client, JSONSchema3or4, Update } from "./index"
import { ReadTransaction, Where, WriteTransaction } from "./models"

const personSchema: JSONSchema3or4 = {
  $id: "https://example.com/person.schema.json",
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "Person",
  type: "object",
  required: ["_id"],
  properties: {
    _id: {
      type: "string",
      description: "The instance's id.",
    },
    firstName: {
      type: "string",
      description: "The person's first name.",
    },
    lastName: {
      type: "string",
      description: "The person's last name.",
    },
    age: {
      description: "Age in years which must be equal to or greater than zero.",
      type: "integer",
      minimum: 0,
    },
  },
}

// Minimal schema representation
const schema2: JSONSchema3or4 = {
  properties: {
    _id: { type: "string" },
    fullName: { type: "string" },
    age: { type: "integer", minimum: 0 },
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
    _id: "",
    firstName: "Adam",
    lastName: "Doe",
    age: 21,
  }
}

describe("Client", function () {
  const dbID = ThreadID.fromRandom()
  let dbKey: string
  let identity: Identity
  const client = new Client(new Context("http://127.0.0.1:6007"))

  before(async function () {
    identity = PrivateKey.fromRandom()
    await client.getToken(identity)
    await client.newDB(dbID, "test")
  })

  describe("Collections", function () {
    it("newCollection should work and create an empty object", async function () {
      const register = await client.newCollection(dbID, {
        name: "Person",
        schema: personSchema,
      })
      expect(register).to.be.undefined
    })
    it("newCollectionFromObject should create new collections from input objects", async function () {
      const register = await client.newCollectionFromObject(
        dbID,
        {
          _id: "",
          these: "can",
          all: 83,
          values: ["that", "arent", "already"],
          specified: true,
        },
        {
          name: "FromObject",
        }
      )
      expect(register).to.be.undefined
    })

    it("updateCollection should update an existing collection", async function () {
      await client.updateCollection(dbID, {
        name: "FromObject",
        schema: schema2,
        indexes: [
          {
            path: "age",
            unique: false,
          },
        ],
      })
      await client.create(dbID, "FromObject", [
        {
          _id: "",
          fullName: "Madonna",
          age: 0,
        },
      ])
    })

    it("getCollectionInfo should return information about a collection", async function () {
      const info = await client.getCollectionInfo(dbID, "FromObject")
      expect(info.name).to.equal("FromObject")
      expect(info.schema).to.deep.equal({
        properties: {
          _id: {
            type: "string",
          },
          age: {
            type: "integer",
          },
          fullName: {
            type: "string",
          },
        },
      })
      // Just one index on age
      expect(info.indexes).to.have.lengthOf(1)
    })

    it("getCollectionInfo should throw for a missing collection", async function () {
      try {
        await client.getCollectionInfo(dbID, "Fake")
        throw new Error("should have thrown")
      } catch (err) {
        expect(err.toString()).to.include("collection not found")
      }
    })

    it("getCollectionIndexes should list valid collection indexes", async function () {
      // @todo Update to latest APIs and mark this as deprecated
      const list = await client.getCollectionIndexes(dbID, "FromObject")
      expect(list).to.have.length(1)
    })

    it("deleteCollection should delete an existing collection", async function () {
      await client.deleteCollection(dbID, "FromObject")
      try {
        await client.create(dbID, "FromObject", [
          {
            _id: "blah",
            nothing: "weve",
            seen: 84,
          },
        ])
        throw new Error("should have thrown")
      } catch (err) {
        expect(err.toString()).to.include("collection not found")
      }
    })

    it("ListCollections should return a list of collections", async function () {
      const list = await client.listCollections(dbID)
      expect(list).to.have.length(1)
    })
  })

  describe(".listDBs", function () {
    it("should list the correct number of dbs with the correct name", async function () {
      const id2 = ThreadID.fromRandom()
      const name2 = "db2"
      await client.newDB(id2, name2)
      const list = await client.listDBs()
      expect(Object.keys(list).length).to.be.greaterThan(1)
      expect(list[dbID.toString()]).to.have.ownProperty("name", "test")
      expect(list[id2.toString()]).to.have.ownProperty("name", name2)
    })
  })

  describe(".getDBInfo", function () {
    it("should return a valid db info object", async function () {
      const invites = await client.getDBInfo(dbID)
      expect(invites).to.not.be.undefined
      expect(invites.addrs[0]).to.not.be.undefined
      expect(invites.key).to.not.be.undefined
      dbKey = invites.key
      expect(invites).to.not.be.empty
    })
  })

  describe(".deleteDB", function () {
    it("should cleanly delete a database", async function () {
      const id = ThreadID.fromRandom()
      await client.newDB(id)
      const before = Object.keys(await client.listDBs()).length
      await client.deleteDB(id)
      const after = Object.keys(await client.listDBs()).length
      expect(before).to.equal(after + 1)
      try {
        await client.getDBInfo(id)
        throw new Error("should have thrown")
      } catch (err) {
        expect(err.toString()).to.include("thread not found")
      }
    })
  })

  describe(".newDBFromAddr", function () {
    const client2 = new Client(new Context("http://127.0.0.1:6207"))
    before(async function () {
      identity = await PrivateKey.fromRandom()
      await client2.getToken(identity)
    })
    it("response should contain a valid list of thread protocol addrs", async function () {
      const info = await client.getDBInfo(dbID)
      // @hack: we're in docker and peers can't find each other; don't try this at home!
      info.addrs.forEach((addr) => {
        addr.replace("/ip4/127.0.0.1", "/dns4/threads1/")
      })
      // We can 'exclude' the local addrs because we swapped them for "dns" entries
      const id1 = await client2.joinFromInfo(info, false, [
        // Include the known collections to bootstrap with...
        {
          name: "Person",
          schema: personSchema,
        },
        {
          name: "FromObject",
          schema: schema2,
        },
      ])
      expect(id1.equals(dbID)).to.equal(true)
      const info2 = await client2.getDBInfo(dbID)
      expect(info2.addrs.length).to.be.greaterThan(1)
      expect(info2.key).to.equal(info.key)
      // Now we should have it locally, so no need to add again
      try {
        const id2 = await client2.newDBFromAddr(info.addrs[0], dbKey, [])
        expect(id2.equals(id1)).to.equal(true)
      } catch (err) {
        // Expect this db to already exist on this peer
        expect(err.toString()).to.include("already exists")
      }
    })
  })

  describe(".create", function () {
    it("response should contain a JSON parsable instancesList", async function () {
      const instances = await client.create(dbID, "Person", [createPerson()])
      expect(instances.length).to.equal(1)
    })
  })

  describe(".readFilter", function () {
    interface Dog {
      _id: string
      name: string
      comments: any[]
    }
    // You can use typescript types to ensure type safety!
    const readFilter = (_reader: string, instance: Dog) => {
      instance.name = "Clyde"
      return instance
    }
    it("should modify returned instances before they are received by the client", async function () {
      // Empty schema
      await client.newCollection(dbID, {
        name: "Dog",
        readFilter,
      })
      // Start with dog with empty id
      const dog: Dog = { _id: "", name: "Fido", comments: [] }
      const [id] = await client.create(dbID, "Dog", [dog])
      // Now pull him back out
      const res = await client.findByID<Dog>(dbID, "Dog", id)
      expect(res.name).to.equal("Clyde") // Even though we initially named him Fido!
    })
  })

  describe(".writeValidator", function () {
    interface Dog {
      _id: string
      name: string
      comments: any[]
    }
    const writeValidator = (_writer: string, event: any, _instance: Dog) => {
      var type = event.patch.type
      var patch = event.patch.json_patch
      switch (type) {
        case "delete":
          return false
        default:
          if (patch.name !== "Fido" && patch.name != "Clyde") {
            return false
          }
          return true
      }
    }
    it("should catch invalid write operations before they are added to the db", async function () {
      // Empty schema
      await client.updateCollection(dbID, {
        name: "Dog",
        writeValidator,
      })
      // Start with dog with empty id
      const dog: Dog = { _id: "", name: "Fido", comments: [] }
      const [id] = await client.create(dbID, "Dog", [dog])
      // Update the properties
      dog._id = id
      dog.name = "Bob"
      try {
        // Try saving, but it _shouldn't_ work!
        await client.save(dbID, "Dog", [dog])
        throw new Error("should have failed")
      } catch (err) {
        expect(err.message).to.include("app denied net record body")
      }
      dog.name = "Clyde"
      // Yeh, Clyde is cool... let's do it
      await client.save(dbID, "Dog", [dog])
      // But now that we have Clyde... you better not delete him!
      try {
        await client.delete(dbID, "Dog", [id])
        throw new Error("should have failed")
      } catch (err) {
        expect(err.message).to.include("app denied net record body")
      }
    })
  })

  describe(".verify", function () {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const writeValidator = (_writer: string, event: any, _instance: any) => {
      var type = event.patch.type
      var patch = event.patch.json_patch
      switch (type) {
        // Never allow deletion by anyone!
        case "delete":
          return false
        default:
          // No person over the age of 50!
          // Note, this part could have been done using json-schema rules!
          if (patch.age > 50) {
            return false
          }
          // Otherwise, all good, let the schema validator take over
          return true
      }
    }
    it("should be able to verfiy incoming instances before writing/saving", async function () {
      // Start with a new collection
      await client.newCollection(dbID, {
        name: "Verified",
        schema: personSchema,
        writeValidator,
      })
      const person = createPerson()
      const [id] = await client.create(dbID, "Verified", [person])
      expect(id).to.not.be.undefined
      person._id = id
      person.age = 51
      try {
        await client.verify(dbID, "Verified", [person])
        throw new Error("wrong error")
      } catch (err) {
        expect(err.message).to.include("app denied net record body")
      }
      person.age = 50
      const err = await client.verify(dbID, "Verified", [person])
      expect(err).to.be.undefined
    })
  })
  describe(".save", function () {
    it("response should be defined and be an empty object", async function () {
      const person = createPerson()
      const instances = await client.create(dbID, "Person", [person])
      expect(instances.length).to.equal(1)
      person._id = instances[0]
      person!.age = 30
      const save = await client.save(dbID, "Person", [person])
      expect(save).to.be.undefined
    })
  })
  describe(".delete", function () {
    it("response should be defined and be an empty object", async function () {
      const instances = await client.create(dbID, "Person", [createPerson()])
      expect(instances.length).to.equal(1)
      const personID = instances[0]
      const deleted = await client.delete(dbID, "Person", [personID])
      expect(deleted).to.be.undefined
    })
  })
  describe(".has", function () {
    it("the created object should also return true for has", async function () {
      const instances = await client.create(dbID, "Person", [createPerson()])
      // Here we 'test' a different approach where we didn't use generics above to create the instance...
      expect(instances.length).to.equal(1)
      const has = await client.has(dbID, "Person", instances)
      expect(has).to.be.true
    })
  })
  describe(".find", function () {
    it("response should contain the same instance based on query", async function () {
      const frank = createPerson()
      frank.firstName = "Frank"
      const instances = await client.create(dbID, "Person", [frank])
      expect(instances.length).to.equal(1)
      const personID = instances[0]

      const q = new Where("firstName").eq(frank.firstName)
      const found = await client.find<Person>(dbID, "Person", q)
      expect(found).to.have.length(1)
      const foundPerson = found.pop()!
      expect(foundPerson).to.not.be.undefined
      expect(foundPerson).to.have.property("firstName", "Frank")
      expect(foundPerson).to.have.property("lastName", "Doe")
      expect(foundPerson).to.have.property("age", 21)
      expect(foundPerson).to.have.property("_id")
      expect(foundPerson["_id"]).to.equal(personID)
    })
  })
  describe(".findById", function () {
    it("response should contain an instance", async function () {
      try {
        await client.findByID<Person>(dbID, "Person", "blah") // not a real id
        throw new Error("wrong error")
      } catch (err) {
        expect(err.toString()).to.not.include("wrong error")
      }
      const [id] = await client.create(dbID, "Person", [createPerson()])
      const instance = await client.findByID<Person>(dbID, "Person", id)
      expect(instance).to.not.be.undefined
      expect(instance).to.have.property("firstName", "Adam")
      expect(instance).to.have.property("lastName", "Doe")
      expect(instance).to.have.property("age", 21)
      expect(instance).to.have.property("_id")
    })
  })

  describe("cross-collection ids", function () {
    it("should not require instance ids to be unique across collections", async function () {
      const person = createPerson()
      person._id = "something-unique"
      const [first] = await client.create(dbID, "Person", [person])
      const [second] = await client.create(dbID, "Verified", [person])
      expect(first).to.equal(second)
    })
  })

  describe(".readTransaction", function () {
    let existingPersonID: string
    let transaction: ReadTransaction | undefined

    before(async function () {
      const instances = await client.create(dbID, "Person", [createPerson()])
      existingPersonID = instances.pop()!
      transaction = client.readTransaction(dbID, "Person")
    })

    it("should start a transaction", async function () {
      expect(transaction).to.not.be.undefined
      await transaction!.start()
    })

    it("should able to check for an existing instance", async function () {
      const has = await transaction!.has([existingPersonID])
      expect(has).to.be.true
    })

    it("should be able to find an existing instance", async function () {
      const instance = await transaction!.findByID<Person>(existingPersonID)
      expect(instance).to.not.be.undefined
      expect(instance).to.have.property("firstName", "Adam")
      expect(instance).to.have.property("lastName", "Doe")
      expect(instance).to.have.property("age", 21)
      expect(instance).to.have.property("_id")
      expect(instance?._id).to.deep.equal(existingPersonID)
    })

    it("should be able to close/end an transaction", async function () {
      await transaction!.end()
    })

    it("should throw on invalid transaction information", async function () {
      const t = client.readTransaction(dbID, "fake")
      await t.start()
      try {
        await t.has(["anything"])
        throw new Error("should have thrown")
      } catch (err) {
        expect(err.toString()).to.include("collection not found")
      }
    })
  })
  describe(".writeTransaction", function () {
    let existingPersonID: string
    let transaction: WriteTransaction | undefined

    context("complete transaction", function () {
      const person = createPerson()
      before(async function () {
        const instances = await client.create(dbID, "Person", [person])
        existingPersonID = instances.length ? instances[0] : ""
        person["_id"] = existingPersonID
        transaction = client.writeTransaction(dbID, "Person")
      })
      it("should start a transaction", async function () {
        expect(transaction).to.not.be.undefined
        await transaction!.start()
      })
      it("should be able to create an instance", async function () {
        const newPerson = createPerson()
        const entities = await transaction!.create<Person>([newPerson])
        expect(entities).to.not.be.undefined
        expect(entities!.length).to.equal(1)
      })
      it("should able to check for an existing instance", async function () {
        const has = await transaction!.has([existingPersonID])
        expect(has).to.be.true
      })
      it("should be able to find an existing instance", async function () {
        const instance = await transaction!.findByID<Person>(existingPersonID)
        expect(instance).to.not.be.undefined
        expect(instance).to.have.property("firstName", "Adam")
        expect(instance).to.have.property("lastName", "Doe")
        expect(instance).to.have.property("age", 21)
        expect(instance).to.have.property("_id")
        expect(instance?._id).to.deep.equal(existingPersonID)
      })
      it("should be able to validate an instance that is invalid", async function () {
        try {
          await transaction?.verify([createPerson()])
          throw new Error("wrong error")
        } catch (err) {
          expect(err.message).to.include("unkown instance") // sic
        }
      })
      it("should be able to save an existing instance", async function () {
        person.age = 99
        const saved = await transaction!.save([person])
        expect(saved).to.be.undefined
        const deleted = await transaction!.delete([person._id])
        expect(deleted).to.be.undefined
      })
      it("should be able to close/end an transaction", async function () {
        await transaction!.end()
      })
    })

    context("rejected transaction", function () {
      it("should not commit a discarded write transaction", async function () {
        const newPerson = createPerson()
        const [id] = await client.create(dbID, "Person", [newPerson])

        // Update _id to be on the safe side
        newPerson._id = id

        // Create a new write transaction, which we'll discard later
        const transaction = client.writeTransaction(dbID, "Person")
        await transaction.start()

        newPerson.age = 38 // Update age, but discard in a moment

        // Abort/discard transaction
        const rejected = await transaction.discard()
        expect(rejected).to.be.undefined

        // Try to do something that should fail later (but not now)
        await transaction.save([newPerson])
        // After discarding transaction, we end it... but results updates should be ignored
        await transaction.end()

        const instance: Person = await client.findByID(dbID, "Person", id)
        expect(instance.age).to.not.equal(38)
      })
    })
  })

  describe(".listen", function () {
    const listener: { events: number; close?: () => void } = { events: 0 }
    const person = createPerson()
    before(async function () {
      const entities = await client.create(dbID, "Person", [person])
      person._id = entities[0]
    })
    it("should stream responses.", (done) => {
      const callback = (reply?: Update<Person>, err?: Error) => {
        if (err) {
          throw err
        }
        const instance = reply?.instance
        expect(instance).to.not.be.undefined
        expect(instance).to.have.property("age")
        expect(instance?.age).to.be.greaterThan(21)
        listener.events += 1
        if (listener.events > 1 && listener.close) {
          listener.close()
        }
        if (listener.events == 2) {
          done()
        }
      }
      const closer = client.listen<Person>(
        dbID,
        [
          {
            collectionName: "Person",
            actionTypes: ["ALL"],
          },
        ],
        callback
      )
      setTimeout(() => {
        const person = createPerson()
        person.age = 40
        client.create(dbID, "Person", [person])
        client.create(dbID, "Person", [person])
      }, 500)
      listener.close = () => closer.close()
    }).timeout(5000) // Make sure our test doesn't timeout

    it("should handle deletes.", (done) => {
      const callback = (reply?: Update<Person>, err?: Error) => {
        if (err) {
          throw err
        }
        expect(reply?.instance).to.be.undefined
        if (listener.close) {
          listener.close()
        }
        done()
      }
      const closer = client.listen<Person>(
        dbID,
        [
          {
            collectionName: "Person",
            actionTypes: ["DELETE"],
          },
        ],
        callback
      )
      setTimeout(() => {
        const person = createPerson()
        client.create(dbID, "Person", [person]).then((ids) => {
          setTimeout(() => {
            client.delete(dbID, "Person", ids)
          }, 500)
        })
      }, 500)
      listener.close = () => closer.close()
    }).timeout(5000) // Make sure our test doesn't timeout
  })
  describe("Query", function () {
    before(async function () {
      const people = [...Array(8)].map((_, i) => {
        const person = createPerson()
        person.age = 60 + i
        return person
      })
      await client.create(dbID, "Person", people)
    })
    it("Should return a full list of entities matching the given query", async function () {
      const q = new Where("age")
        .ge(60)
        .and("age")
        .lt(66)
        .or(new Where("age").eq(67))
      const instances = await client.find<Person>(dbID, "Person", q)
      expect(instances).to.have.length(7)
    })
  })

  describe("Invalid states", function () {
    it("should not compromise the thread to try to create the same object twice", async function () {
      const newPerson = createPerson()
      newPerson._id = "new-person-id_one"
      const [id] = await client.create(dbID, "Person", [newPerson])
      expect(id).to.not.be.undefined
      try {
        await client.create(dbID, "Person", [newPerson])
        throw new Error("wrong error")
      } catch (err) {
        expect(err.message).to.include("existing instance")
      }
      const list = await client.find(dbID, "Person", {})
      expect(list.length).to.be.greaterThan(0)
    })

    it("should also be safe inside a write transaction", async function () {
      const newPerson = createPerson()
      newPerson._id = "new-person-id-two"
      const transaction = client.writeTransaction(dbID, "Person")
      await transaction.start()
      const result = await transaction.create([newPerson])
      expect(result).to.not.be.undefined
      // TODO: This check won't error, but it should when we try to flush the transaction
      await transaction.create([newPerson])
      await transaction.end()
      const list = await client.find(dbID, "Person", {})
      expect(list.length).to.be.greaterThan(0)
      const collections = await client.listCollections(dbID)
      expect(collections).to.have.lengthOf(3)
    })
  })

  describe("Restart", function () {
    it('Should handle a whole new "restart" of the client', async function () {
      const newClient = new Client(new Context("http://127.0.0.1:6007"))
      const person = createPerson()
      await newClient.getToken(identity)
      const created = await newClient.create(dbID, "Person", [person])
      const got: Person = await newClient.findByID(dbID, "Person", created[0])
      expect(got).to.haveOwnProperty("_id", created[0])
      expect(got).to.haveOwnProperty("firstName", "Adam")
    })
  })
})
