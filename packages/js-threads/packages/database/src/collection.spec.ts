import { expect } from 'chai'
import uuid from 'uuid'
import * as mingo from 'mingo'
import { Datastore, MemoryDatastore } from 'interface-datastore'
import { collect } from 'streaming-iterables'
import { Collection, existingKeyError, JSONSchema, FilterQuery } from './collection'

const personSchema: JSONSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Person',
  description: 'A simple person schema',
  type: 'object',

  properties: {
    ID: {
      description: 'The unique identifier for a person',
      type: 'string',
    },

    name: {
      description: 'Name of the person',
      type: 'string',
    },

    age: {
      type: 'number',
      minimum: 0,
      exclusiveMaximum: 100,
    },
  },

  required: ['ID', 'name', 'age'],
}

describe('Collection', () => {
  it('basic', async () => {
    interface Info {
      ID: string
      other?: number
      thing: string
    }
    const Thing = new Collection<Info>('things', {})
    const data: Info = { ID: '123', thing: 'one' }
    const thing1 = new Thing(data)
    expect(thing1.thing).to.equal('one')
    thing1.other = 1
    // thing1.more = 'something' // Won't compile unless type can have additional properties
    expect(thing1.other).to.equal(1)
    expect(await collect(Thing.find({}))).to.have.length(0)
    await thing1.save() // Now saved to collection
    expect(await collect(Thing.find({}))).to.have.length(1)
    await Thing.save(data)
    try {
      await Thing.insert(data)
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).to.equal(existingKeyError)
    }
    await Thing.insert(
      { ID: '', other: -1, thing: 'five' },
      { ID: '', other: 2, thing: 'two' },
      { ID: '', other: 3, thing: 'three' },
      { ID: '', other: 4, thing: 'four' },
    )
    const all = await collect(
      Thing.find({ $or: [{ other: { $gt: 1 } }, { thing: 'one' }] }, { sort: { other: -1 } }),
    )
    const last = all[0]
    expect(last.value).to.have.haveOwnProperty('other', 4)
  })

  describe('complex', () => {
    type Person = {
      ID: string
      name: string
      age: number
    }

    const defaultPerson: Person = Object.freeze({
      ID: '',
      name: 'Lucas',
      age: 7,
    })

    const copyPerson = (person: Person = defaultPerson) => {
      return { ...person }
    }

    const setupCollection = (child?: Datastore<any>) => {
      return new Collection<Person>('Person', personSchema, { child })
    }

    let store: Datastore<any>
    beforeEach(() => {
      // Clear out the store before each run
      store = new MemoryDatastore<any>()
    })

    describe('top-level instance', () => {
      it('should derive a validator from an schema', () => {
        const Person = setupCollection(store)
        expect(Person.validator(copyPerson())).to.be.true
      })

      it('should handle multiple write operations', async () => {
        const Person = setupCollection(store)
        await Person.insert(copyPerson(), copyPerson(), copyPerson())
        const person = copyPerson()
        await new Person(person).save()
        await Person.delete(person.ID)
        // Should modify the object in-place
        expect(person.ID).to.not.equal('')
        expect(await collect(Person.find({}))).to.have.length(3)
      })
    })

    describe('creating entities', () => {
      it('should create a single entity (w/ type checking) at a time', async () => {
        const Person = setupCollection(store)
        const person1 = copyPerson()
        await Person.insert(person1)
        const exists = await Person.has(person1.ID)
        const obj = await Person.findById(person1.ID)
        expect(exists).to.be.true
        expect(obj).to.have.ownProperty('ID', person1.ID)
        const person2 = new Person(copyPerson())
        expect(await Person.has(person2.ID)).to.be.false
        await person2.save()
        expect(await Person.has(person2.ID)).to.be.true
      })

      it('should create multiple entities (variadic arguments w/ type checking) at once', async () => {
        const Person = setupCollection(store)
        const person = copyPerson()
        await Person.insert(person, copyPerson(), copyPerson())
        expect(await collect(Person.find({}))).to.have.length(3)
        expect(await Person.has(person.ID)).to.be.true
      })

      it('should create an entity with a predefined id', async () => {
        const Person = setupCollection(store)
        const ID = uuid()
        const person = new Person({ ID, name: 'Hans', age: 12 })
        expect(person.toJSON()).to.have.ownProperty('ID', ID)
      })

      it('should not overwrite an existing entity', async () => {
        const Person = setupCollection(store)
        const ID = uuid()
        try {
          await Person.insert({ ID, name: 'Hans', age: 12 })
          const person = new Person({ ID, name: 'Hans', age: 12 }) // No error yet
          await Person.insert(person) // This works because our encoder checks for toJSON
          throw new Error('should not create already existing instance')
        } catch (err) {
          expect(err.toString()).to.equal('Error: Existing key')
        }
      })
    })

    describe('creating transactions', () => {
      it('should create a readonly transaction', async () => {
        const Person = setupCollection(store)
        const person = new Person(copyPerson())
        await person.save()
        await Person.readTransaction(async r => {
          expect(await r.has(person.ID)).to.be.true
        })
      })

      it('should create a write transaction', async () => {
        const Person = setupCollection(store)
        const person = new Person(copyPerson())
        await Person.writeTransaction(async w => {
          await w.insert(person)
          expect(await w.has(person.ID)).to.be.true
        })
      })
    })

    describe('checking for entities', () => {
      it('should test for existing entity', async () => {
        const Person = setupCollection(store)
        const person = copyPerson()
        await Person.insert(person)
        expect(await Person.has(person.ID)).to.be.true
        expect(await Person.has('blah')).to.be.false

        const person2 = new Person(copyPerson())
        await person2.save()
        expect(await person2.exists()).to.be.true
        await person2.remove()
        expect(await person2.exists()).to.be.false
      })

      it('should test for multiple entities', async () => {
        const Person = setupCollection(store)
        const persons = [copyPerson(), copyPerson(), copyPerson()]
        await Person.insert(...persons)
        expect(await Promise.all(persons.map(p => Person.has(p.ID)))).to.deep.equal([
          true,
          true,
          true,
        ])
        expect(await Promise.all(['foo', 'bar', 'baz'].map(p => Person.has(p)))).to.deep.equal([
          false,
          false,
          false,
        ])
      })
    })

    describe('returning entities', () => {
      it('should get existing entity', async () => {
        const Person = setupCollection(store)
        const person = new Person(copyPerson())
        await person.save()
        const found = await Person.findById(person.ID)
        expect(found).to.deep.equal(person.toJSON())
        try {
          await Person.findById('blah')
          throw new Error('should throw on invalid id')
        } catch (err) {
          expect(err.toString()).to.equal('Error: Not Found')
        }
      })

      it('should get multiple entities', async () => {
        const Person = setupCollection(store)
        const persons = [copyPerson(), copyPerson(), copyPerson()]
        await Person.insert(...persons)
        expect(await Promise.all(persons.map(p => Person.findById(p.ID)))).to.deep.equal(persons)
        try {
          await Promise.all(['foo', 'bar', 'baz'].map(p => Person.findById(p)))
          throw new Error('should throw on invalid id')
        } catch (err) {
          expect(err.toString()).to.equal('Error: Not Found')
        }
      })
    })

    describe('deleting for entities', () => {
      it('should delete existing entity', async () => {
        const Person = setupCollection(store)
        const person = new Person(copyPerson())
        await person.save()
        expect(await Person.has(person.ID)).to.be.true
        await Person.delete(person.ID)
        expect(await Person.has(person.ID)).to.be.false
        await Person.delete('blah') // Should not throw here, fails gracefully

        await person.save()
        expect(await Person.has(person.ID)).to.be.true
        await person.remove()
        expect(await Person.has(person.ID)).to.be.false
      })

      it('should delete multiple entities', async () => {
        const Person = setupCollection(store)
        const persons = [copyPerson(), copyPerson(), copyPerson()]
        await Person.insert(...persons)
        const ids = persons.map(p => p.ID)
        expect(await Promise.all(persons.map(p => Person.has(p.ID)))).to.deep.equal([
          true,
          true,
          true,
        ])
        await Person.delete(...ids)
        expect(await Promise.all(ids.map(p => Person.has(p)))).to.deep.equal([false, false, false])
        await Person.delete('foo', 'bar', 'baz') // Should not error
      })
    })

    describe('saving entities', () => {
      it('should save/update existing entity', async () => {
        const Person = setupCollection(store)
        const person = new Person(copyPerson())
        await person.save()
        person.name = 'Mod' // ;)
        await person.save()
        expect(await Person.findById(person.ID)).to.haveOwnProperty('name', 'Mod')
      })

      it('should save/update multiple entities', async () => {
        const Person = setupCollection(store)
        const persons = [copyPerson(), copyPerson(), copyPerson()]
        await Person.insert(...persons)
        persons.forEach(p => p.age++)
        await Person.save(...persons)
        const array = await collect(Person.find({}))
        expect(array.map(p => p.value.age)).to.deep.equal([8, 8, 8])
      })
      it('should also save/update a non-existant entity', async () => {
        const Person = setupCollection(store)
        await Person.save({ ID: '', name: 'nothing', age: 55 })
        expect(await collect(Person.find())).to.have.length(1)
      })
    })

    describe('find/search', () => {
      it('should support simple queries', async () => {
        const Person = setupCollection(store)
        const people: Person[] = [
          { ID: '', name: 'Lucas', age: 7 },
          { ID: '', name: 'Clyde', age: 99 },
          { ID: '', name: 'Duke', age: 2 },
        ]
        await Person.insert(...people)
        const query: FilterQuery<Person> = {
          // Find everyone over the age of 5
          age: { $gt: 5 },
        }
        const results = await collect(Person.find(query))
        expect(results).to.have.length(2)
        const last = results.pop()
        // Should we 'unravel' the key/value pairs here?
        expect(last?.value).to.have.ownProperty('age')
        expect(last?.value.age).to.be.greaterThan(5)
      })

      it('should support complex queries', async () => {
        const Person = setupCollection(store)
        const people: Person[] = [
          { ID: '', name: 'Lucas', age: 56 },
          { ID: '', name: 'Clyde', age: 55 },
          { ID: '', name: 'Mike', age: 52 },
          { ID: '', name: 'Micheal', age: 52 },
          { ID: '', name: 'Duke', age: 2 },
          { ID: '', name: 'Michelle', age: 2 },
          { ID: '', name: 'Michelangelo', age: 55 },
        ]
        await Person.insert(...people)
        const query: FilterQuery<Person> = {
          // Find people who are older than 5, and younger than 56, ...
          // and who's name starts with Mi or is Clyde, ...
          // but don't include Michael, he's a jerk...
          $and: [
            { age: { $gt: 5 } },
            { age: { $lt: 56 } },
            { $or: [{ name: { $regex: '^Mi' } }, { name: { $eq: 'Clyde' } }] },
            { name: { $not: { $eq: 'Micheal' } } },
          ],
        }
        const results = await collect(Person.find(query))
        expect(results).to.have.length(3)
        const last = results.pop()
        expect(last?.value).to.have.ownProperty('age')
        expect(last?.value.age).to.be.greaterThan(5)
        expect(last?.value.age).to.be.lessThan(56)
        expect(await collect(Person.find())).to.have.length(7)
        // Use mingo directly, should also return 3 (sanity check)
        expect((mingo as any).find(people, query).count()).to.equal(3)
      })
    })

    describe('read transaction', () => {
      it('should test for existing entity', async () => {
        const Person = setupCollection(store)
        const person = new Person(copyPerson())
        await person.save()
        await Person.readTransaction(async c => {
          expect(await c.has(person.ID)).to.be.true
        })
      })

      it('should return existing entity', async () => {
        const Person = setupCollection(store)
        const person = new Person(copyPerson())
        await person.save()
        await Person.readTransaction(async c => {
          const found = await c.findById(person.ID)
          expect(found).to.deep.equal(person.toJSON())
          // await c.insert(person) // Compiler won't let us!
        })
      })

      it('should support a timeout, and preclude any write transactions until done', async () => {
        const Person = setupCollection(store)
        const person = new Person(copyPerson())
        await person.save()
        const t1 = Date.now()
        await Person.readTransaction(async c => {
          try {
            // Start a deadlock...
            await Person.writeTransaction(async w => {
              await w.insert(person) // Won't ever run
            }, 2000)
            throw new Error('should not be able to aquire this lock')
          } catch (err) {
            expect(err.toString()).to.equal('Error: acquire lock timeout')
          }
        })
        const t2 = Date.now()
        expect(t2 - t1 + 100).to.be.greaterThan(2000) // Adjust up to catch approx. timings
      }).timeout(3000)
    })

    describe('write transaction', () => {
      it('should perform normal write operations', async () => {
        const Person = setupCollection(store)
        let count = 0
        Person.child.on('events', () => count++)
        await Person.writeTransaction(async w => {
          const person = new Person(copyPerson())
          await w.insert(person)
          await w.delete(person.ID)
        })
        expect(count).to.equal(2)
      })

      it('should support a timeout, and preclude any read transactions until done', async () => {
        const Person = setupCollection(store)
        const person = new Person(copyPerson())
        await person.save()
        const t1 = Date.now()
        await Person.writeTransaction(async w => {
          try {
            // Start a deadlock...
            await Person.readTransaction(async r => {
              await r.findById(person.ID) // Won't ever run
            }, 2000)
            throw new Error('should not be able to aquire this lock')
          } catch (err) {
            expect(err.toString()).to.equal('Error: acquire lock timeout')
          }
        })
        const t2 = Date.now()
        expect(t2 - t1 + 100).to.be.greaterThan(2000) // Adjust up to catch approx. timings
      }).timeout(3000)
    })
  })
})
