/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Context } from "@textile/context"
import { Identity, Libp2pCryptoIdentity } from "@textile/threads-core"
import { ThreadID } from "@textile/threads-id"
import { expect } from "chai"
import { Client, Update } from "./index"
import { ReadTransaction, Where, WriteTransaction } from "./models"

const personSchema = {
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
const schema2 = {
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

  before(async () => {
    identity = await Libp2pCryptoIdentity.fromRandom()
    await client.getToken(identity)
    await client.newDB(dbID, "test")
  })

  describe("Collections", () => {
    it("newCollection should work and create an empty object", async () => {
      const register = await client.newCollection(dbID, "Person", personSchema)
      expect(register).to.be.undefined
    })
    it("newCollectionFromObject should create new collections from input objects", async () => {
      const register = await client.newCollectionFromObject(
        dbID,
        "FromObject",
        {
          _id: "",
          these: "can",
          all: 83,
          values: ["that", "arent", "already"],
          specified: true,
        }
      )
      expect(register).to.be.undefined
    })

    it("updateCollection should update an existing collection", async () => {
      await client.updateCollection(dbID, "FromObject", schema2, [
        {
          path: "age",
          unique: false,
        },
      ])
      await client.create(dbID, "FromObject", [
        {
          _id: "",
          fullName: "Madonna",
          age: 0,
        },
      ])
    })

    it("getCollectionInfo should return information about a collection", async () => {
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
      expect(info.indexesList).to.have.lengthOf(1)
    })

    it("getCollectionIndexes should list valid collection indexes", async () => {
      // @todo Update to latest APIs and mark this as deprecated
      const list = await client.getCollectionIndexes(dbID, "FromObject")
      expect(list).to.have.length(1)
    })

    it("deleteCollection should delete an existing collection", async () => {
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

    it("ListCollections should return a list of collections", async () => {
      const list = await client.listCollections(dbID)
      expect(list).to.have.length(1)
    })
  })

  describe(".listDBs", () => {
    it("should list the correct number of dbs with the correct name", async () => {
      const id2 = ThreadID.fromRandom()
      const name2 = "db2"
      await client.newDB(id2, name2)
      const list = await client.listDBs()
      expect(Object.keys(list).length).to.be.greaterThan(1)
      expect(list[dbID.toString()]).to.have.ownProperty("name", "test")
      expect(list[id2.toString()]).to.have.ownProperty("name", name2)
    })
  })

  describe(".getDBInfo", () => {
    it("should return a valid db info object", async () => {
      const invites = await client.getDBInfo(dbID)
      expect(invites).to.not.be.undefined
      expect(invites.addrs[0]).to.not.be.undefined
      expect(invites.key).to.not.be.undefined
      dbKey = invites.key
      expect(invites).to.not.be.empty
    })
  })

  describe(".deleteDB", () => {
    it("should cleanly delete a database", async () => {
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

  describe(".newDBFromAddr", () => {
    const client2 = new Client(new Context("http://127.0.0.1:6207"))
    before(async () => {
      identity = await Libp2pCryptoIdentity.fromRandom()
      await client2.getToken(identity)
    })
    it("response should contain a valid list of thread protocol addrs", async () => {
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

  describe(".create", () => {
    it("response should contain a JSON parsable instancesList", async () => {
      const instances = await client.create(dbID, "Person", [createPerson()])
      expect(instances.length).to.equal(1)
    })
  })
  describe(".save", () => {
    it("response should be defined and be an empty object", async () => {
      const person = createPerson()
      const instances = await client.create(dbID, "Person", [person])
      expect(instances.length).to.equal(1)
      person._id = instances[0]
      person!.age = 30
      const save = await client.save(dbID, "Person", [person])
      expect(save).to.be.undefined
    })
  })
  describe(".delete", () => {
    it("response should be defined and be an empty object", async () => {
      const instances = await client.create(dbID, "Person", [createPerson()])
      expect(instances.length).to.equal(1)
      const personID = instances[0]
      const deleted = await client.delete(dbID, "Person", [personID])
      expect(deleted).to.be.undefined
    })
  })
  describe(".has", () => {
    it("the created object should also return true for has", async () => {
      const instances = await client.create(dbID, "Person", [createPerson()])
      // Here we 'test' a different approach where we didn't use generics above to create the instance...
      expect(instances.length).to.equal(1)
      const has = await client.has(dbID, "Person", instances)
      expect(has).to.be.true
    })
  })
  describe(".find", () => {
    it("response should contain the same instance based on query", async () => {
      const frank = createPerson()
      frank.firstName = "Frank"
      const instances = await client.create(dbID, "Person", [frank])
      expect(instances.length).to.equal(1)
      const personID = instances[0]

      const q = new Where("firstName").eq(frank.firstName)
      const find = await client.find<Person>(dbID, "Person", q)
      expect(find).to.not.be.undefined
      const found = find.instancesList
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
  describe(".findById", () => {
    it("response should contain a JSON parsable instance property", async () => {
      const instances = await client.create(dbID, "Person", [createPerson()])
      const personID = instances.pop()!
      const find = await client.findByID<Person>(dbID, "Person", personID)
      expect(find).to.not.be.undefined
      expect(find).to.haveOwnProperty("instance")
      const instance = find.instance
      expect(instance).to.not.be.undefined
      expect(instance).to.have.property("firstName", "Adam")
      expect(instance).to.have.property("lastName", "Doe")
      expect(instance).to.have.property("age", 21)
      expect(instance).to.have.property("_id")
    })
  })
  describe(".readTransaction", () => {
    let existingPersonID: string
    let transaction: ReadTransaction | undefined

    before(async () => {
      const instances = await client.create(dbID, "Person", [createPerson()])
      existingPersonID = instances.pop()!
      transaction = client.readTransaction(dbID, "Person")
    })

    it("should start a transaction", async () => {
      expect(transaction).to.not.be.undefined
      await transaction!.start()
    })

    it("should able to check for an existing instance", async () => {
      const has = await transaction!.has([existingPersonID])
      expect(has).to.be.true
    })

    it("should be able to find an existing instance", async () => {
      const find = await transaction!.findByID<Person>(existingPersonID)
      expect(find).to.not.be.undefined
      expect(find).to.haveOwnProperty("instance")
      const instance = find!.instance
      expect(instance).to.not.be.undefined
      expect(instance).to.have.property("firstName", "Adam")
      expect(instance).to.have.property("lastName", "Doe")
      expect(instance).to.have.property("age", 21)
      expect(instance).to.have.property("_id")
      expect(instance?._id).to.deep.equal(existingPersonID)
    })

    it("should be able to close/end an transaction", async () => {
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
  describe(".writeTransaction", () => {
    let existingPersonID: string
    let transaction: WriteTransaction | undefined

    context("complete transaction", function () {
      const person = createPerson()
      before(async () => {
        const instances = await client.create(dbID, "Person", [person])
        existingPersonID = instances.length ? instances[0] : ""
        person["_id"] = existingPersonID
        transaction = client.writeTransaction(dbID, "Person")
      })
      it("should start a transaction", async () => {
        expect(transaction).to.not.be.undefined
        await transaction!.start()
      })
      it("should be able to create an instance", async () => {
        const newPerson = createPerson()
        const entities = await transaction!.create<Person>([newPerson])
        expect(entities).to.not.be.undefined
        expect(entities!.length).to.equal(1)
      })
      it("should able to check for an existing instance", async () => {
        const has = await transaction!.has([existingPersonID])
        expect(has).to.be.true
      })
      it("should be able to find an existing instance", async () => {
        const find = await transaction!.findByID<Person>(existingPersonID)
        expect(find).to.not.be.undefined
        expect(find).to.haveOwnProperty("instance")
        const instance = find!.instance
        expect(instance).to.not.be.undefined
        expect(instance).to.have.property("firstName", "Adam")
        expect(instance).to.have.property("lastName", "Doe")
        expect(instance).to.have.property("age", 21)
        expect(instance).to.have.property("_id")
        expect(instance?._id).to.deep.equal(existingPersonID)
      })
      it("should be able to save an existing instance", async () => {
        person.age = 99
        const saved = await transaction!.save([person])
        expect(saved).to.be.undefined
        const deleted = await transaction!.delete([person._id])
        expect(deleted).to.be.undefined
      })
      it("should be able to close/end an transaction", async () => {
        await transaction!.end()
      })
    })

    context("rejected transaction", function () {
      const person = createPerson()
      before(async () => {
        const instances = await client.create(dbID, "Person", [person])
        existingPersonID = instances.length ? instances[0] : ""
        person["_id"] = existingPersonID
        transaction = client.writeTransaction(dbID, "Person")
      })

      it("should not commit an aborted write transaction", async function () {
        await transaction?.start()
        const newPerson = createPerson()
        const ids = (await transaction?.create<Person>([newPerson])) ?? []
        expect(ids).to.not.be.undefined
        // Abort transaction
        const rejected = await transaction?.abort()
        expect(rejected).to.be.undefined
        // After aborted transaction, it should still be false
        const exHas = await client.has(dbID, "Person", ids)
        expect(exHas).to.equal(false)
      })
    })
  })

  describe(".listen", () => {
    const listener: { events: number; close?: () => void } = { events: 0 }
    const person = createPerson()
    before(async () => {
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
  describe("Query", () => {
    before(async () => {
      const people = [...Array(8)].map((_, i) => {
        const person = createPerson()
        person.age = 60 + i
        return person
      })
      await client.create(dbID, "Person", people)
    })
    it("Should return a full list of entities matching the given query", async () => {
      const q = new Where("age")
        .ge(60)
        .and("age")
        .lt(66)
        .or(new Where("age").eq(67))
      const find = await client.find<Person>(dbID, "Person", q)
      expect(find).to.not.be.undefined
      const found = find.instancesList
      expect(found).to.have.length(7)
    })
  })

  describe("Restart", () => {
    it('Should handle a whole new "restart" of the client', async () => {
      const newClient = new Client(new Context("http://127.0.0.1:6007"))
      const person = createPerson()
      await newClient.getToken(identity)
      const created = await newClient.create(dbID, "Person", [person])
      const got = await newClient.findByID(dbID, "Person", created[0])
      expect(got.instance).to.haveOwnProperty("_id", created[0])
      expect(got.instance).to.haveOwnProperty("firstName", "Adam")
    })
  })
})
