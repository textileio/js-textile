/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect } from "chai";
import mingo from "mingo";
import { ulid } from "ulid";
import { Collection } from "./collection";
import { NewDexie } from "../utils";
import { shouldHaveThrown } from "../utils/spec.utils";
import { Query } from "../middleware/mongo";
// import { ChangeTableName } from "../middleware/changes";

const databaseName = "collection";

describe("collection", function () {
  const db = NewDexie(databaseName);

  after(async function () {
    // Cleanup time!
    db.close();
    await db.delete();
  });
  describe("workflows", async function () {
    before(async function () {
      // Super low-level access
      db.version(1).stores({ things: "++_id,thing" });
    });
    it("should handle a normal db workflow", async function () {
      interface Info {
        _id?: string;
        other?: number;
        thing: string;
      }
      const Thing = new Collection<Info>(db.table("things"));
      const data: Info = { _id: ulid(), thing: "one" };
      const thing1 = data;
      expect(thing1.thing).to.equal("one");
      thing1.other = 1;
      // Won't compile because typed instances can't have extra properties,
      // which is exactly what we want!
      // thing1.more = 'something'
      expect(thing1.other).to.equal(1);
      expect(await Thing.find({}).count()).to.equal(0);
      await Thing.save(thing1);
      expect(await Thing.find({}).count()).to.equal(1);
      await Thing.save(data);
      try {
        await Thing.insert(data);
        throw shouldHaveThrown;
        // TODO: Better error reporting to mask out dexie stuff
      } catch (err) {
        expect(err).to.not.equal(shouldHaveThrown);
      }
      await Thing.insert(
        { other: -1, thing: "five" },
        { other: 2, thing: "two" },
        { other: 3, thing: "three" },
        { other: 4, thing: "four" }
      );
      const all = await Thing.find({
        $or: [{ other: { $gt: 1 } }, { thing: { $eq: "one" } }],
      }).sortBy("_id");
      const last = all[0];
      expect(last).to.have.haveOwnProperty("other", 1);
    });
  });

  describe("units", () => {
    // Default Person interface to work with types
    type Person = {
      name: string;
      age: number;
    };

    // Default person data, frozen to keep from modifying directly
    const defaultPerson: Person = Object.freeze({
      name: "Lucas",
      age: 7,
    });

    // Function to create a copy of person, rather than mutate
    const copyPerson = (
      person: Person = defaultPerson,
      _id?: string
    ): Person & { _id?: string } => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out: any = { ...person };
      if (_id) out._id = _id;
      return out;
    };

    // Function to setup a new default collection based on the person interface
    const setupCollection = () => {
      return new Collection<Person>(db.table("Person"));
    };

    before(async function () {
      // Super low-level access
      db.close();
      // Create Person store with indexes on _id, name, and age
      db.version(2).stores({ Person: "++_id,name,age" });
      await db.open();
    });

    beforeEach(() => {
      // Clear out the store before each run
      db.tables.forEach((table) => table.clear());
    });

    describe("top-level instance", () => {
      it("should have a name property", function () {
        const Person = setupCollection();
        expect(Person.name).to.equal("Person");
      });

      it("should handle multiple write operations", async function () {
        const Person = setupCollection();
        // const test = copyPerson(undefined, ulid());
        await Person.insert(copyPerson(), copyPerson(), copyPerson());
        const person = copyPerson();
        const [id] = await Person.insert(person);
        await Person.delete(id);
        expect(await Person.find({}).count()).to.equal(3);
      });
    });

    describe("creating entities", () => {
      it("should create single entity from data", async function () {
        const Person = setupCollection();
        const person = copyPerson();
        expect(person).to.not.have.ownProperty("_id");
        // Should create entity with proper id
        const entity = Person.create(person);
        expect(entity).to.have.ownProperty("_id");

        // Should not exist in underlying storage yet
        expect(await entity.exists()).to.equal(false);
        expect(await Person.has(entity._id)).to.equal(false);

        // Now save it
        await entity.save();

        // Now it should exist in underlying storage
        expect(await entity.exists()).to.equal(true);
        expect(await Person.has(entity._id)).to.equal(true);
      });

      it("should create entities with ulid ids by default", async function () {
        const Person = setupCollection();
        const person1 = copyPerson();
        const [id] = await Person.insert(person1);
        // Should update person in place
        expect(person1._id).to.equal(id);
        const obj = await Person.findById(id);
        expect(obj).to.have.ownProperty("_id");
        expect(obj?._id).to.equal(id);
        expect(obj?._id).to.have.length(26);
      });

      it("should be able to override ulid id", async function () {
        const Person = setupCollection();
        const person1 = copyPerson();
        person1._id = "override";
        const [id] = await Person.insert(person1);
        // Should update person in place
        expect(person1._id).to.equal("override");
        const obj = await Person.findById(id);
        expect(obj).to.have.ownProperty("_id");
        expect(obj?._id).to.equal(id);
      });

      it("should create a single entity (w/ type checking) at a time", async function () {
        const Person = setupCollection();
        const person1 = copyPerson();
        const [id] = await Person.insert(person1);
        const exists = await Person.has(id);
        const obj = await Person.findById(id);
        expect(exists).to.be.true;
        expect(obj).to.have.ownProperty("_id", id);
        expect(obj?.save).to.not.be.undefined;
        const person2 = copyPerson(undefined, ulid());
        let has = await Person.has(person2._id!);
        expect(has).to.equal(false);
        await Person.insert(person2);
        has = await Person.has(person2._id!);
        expect(has).to.equal(true);
      });

      it("should create multiple entities (variadic arguments w/ type checking) at once", async function () {
        const Person = setupCollection();
        const person = copyPerson();
        const [id] = await Person.insert(person, copyPerson(), copyPerson());
        expect(await Person.find({}).count()).to.equal(3);
        expect(await Person.has(id)).to.be.true;
      });

      it("should create an entity with a predefined id", async function () {
        const Person = setupCollection();
        const _id = ulid();
        const person = { _id, name: "Hans", age: 12 };
        const [id_] = await Person.insert(person);
        expect(id_).to.equal(_id);
      });

      it("should not overwrite an existing entity", async function () {
        const Person = setupCollection();
        const _id = ulid();
        try {
          await Person.insert({ _id, name: "Hans", age: 12 } as Person);
          const person = { _id, name: "Hans", age: 12 };
          await Person.insert(person);
          throw shouldHaveThrown;
        } catch (err) {
          expect(err).to.not.equal(shouldHaveThrown);
        }
      });
    });

    describe("creating transactions", () => {
      it("should create a readonly transaction", async function () {
        const Person = setupCollection();
        const person = copyPerson();
        const [id] = await Person.insert(person);
        Person.readTransaction(async function () {
          // await Person.insert(person);
          expect(await Person.has(id)).to.be.true;
        });
      });

      it("should create a write transaction", async function () {
        const Person = setupCollection();
        const person = copyPerson();
        Person.writeTransaction(async function () {
          const [id] = await Person.insert(person);
          expect(await Person.has(id)).to.be.true;
        });
      });
    });

    describe("checking for entities", () => {
      it("should test for existing entity", async function () {
        const Person = setupCollection();
        const person = copyPerson();
        const [id1] = await Person.insert(person);
        expect(await Person.has(id1)).to.be.true;
        expect(await Person.has("blah")).to.be.false;

        const person2 = copyPerson();
        const [id2] = await Person.insert(person2);
        expect(await Person.has(id2)).to.be.true;
        await Person.delete(id2);
        expect(await Person.has(id2)).to.be.false;

        // Test exists from instance
        const [id3] = await Person.insert(person2);
        const personInstance = await Person.findById(id3);
        if (personInstance) {
          expect(await personInstance.exists()).to.equal(true);
          await personInstance.remove();
          expect(await personInstance.exists()).to.equal(false);
        } else {
          throw new Error("should not be undefined");
        }
      });

      it("should test for multiple entities", async function () {
        const Person = setupCollection();
        const persons = [copyPerson(), copyPerson(), copyPerson()];
        const ids = await Person.insert(...persons);
        expect(
          await Promise.all(ids.map((id) => Person.has(id)))
        ).to.deep.equal([true, true, true]);
        expect(
          await Promise.all(["foo", "bar", "baz"].map((p) => Person.has(p)))
        ).to.deep.equal([false, false, false]);
      });
    });

    describe("returning entities", () => {
      it("should get existing entity", async function () {
        const Person = setupCollection();
        const person = copyPerson();
        const [id] = await Person.insert(person);
        let found = await Person.findById(id);
        expect(found).to.deep.equal(person);
        found = await Person.findById("blah");
        expect(found).to.be.undefined;
      });

      it("should get multiple entities", async function () {
        const Person = setupCollection();
        const persons = [copyPerson(), copyPerson(), copyPerson()];
        const ids = await Person.insert(...persons);
        expect(
          await Promise.all(ids.map((id) => Person.findById(id)))
        ).to.deep.equal(persons);
        const founds = await Promise.all(
          ["foo", "bar", "baz"].map((p) => Person.findById(p))
        );
        expect(founds.every((found) => found === undefined)).to.be.true;
      });
    });

    describe("type checking entities", () => {
      it("should correctly handle typed entities", async function () {
        const Person = new Collection<Person>(db.table("Person"));
        const person = copyPerson();
        const typed = Person.create(person);
        expect(typed.age).to.equal(person.age);
        expect(typed.name).to.equal(person.name);
        expect(typed._id).to.not.be.undefined;
        // Also works with unknown
        const Unknown = new Collection(
          db.table("Person") // Reuse Person table...
        );
        // We can create an empty object of unknown type
        const empty = Unknown.create();
        // This is a method from Instance
        expect(empty.exists).to.not.be.undefined;
        // This is a default _id
        expect(empty._id).to.not.be.undefined;
      });
    });

    describe("exporting entities", () => {
      it("should export entity to JSON string", async function () {
        const Person = setupCollection();
        const person = copyPerson();
        const [id] = await Person.insert(person);
        expect(await Person.has(id)).to.be.true;
        const personInstance = await Person.findById(id);
        // Should be an actual class instance, that we can export to JSON
        if (personInstance) {
          const json = personInstance.toJSON();
          expect(json).to.equal(JSON.stringify(person));
        } else {
          throw new Error("should not be undefined");
        }
      });
    });

    describe("deleting entities", () => {
      it("should delete existing entity", async function () {
        const Person = setupCollection();
        const person = copyPerson();
        let [id] = await Person.insert(person);
        expect(await Person.has(id)).to.be.true;
        await Person.delete(id);
        expect(await Person.has(id)).to.be.false;
        await Person.delete("blah"); // Should not throw here, fails gracefully
        await Person.save(person);
        expect(await Person.has(id)).to.be.true;
        await Person.delete(id);
        expect(await Person.has(id)).to.be.false;

        // Test remove from instance
        [id] = await Person.insert(person);
        expect(await Person.has(id)).to.equal(true);
        const personInstance = await Person.findById(id);
        if (personInstance) {
          await personInstance.remove();
          expect(await Person.has(id)).to.equal(false);
        } else {
          throw new Error("should not be undefined");
        }
      });

      it("should delete multiple entities", async function () {
        const Person = setupCollection();
        const persons = [copyPerson(), copyPerson(), copyPerson()];
        const ids = await Person.insert(...persons);
        expect(
          await Promise.all(ids.map((id) => Person.has(id)))
        ).to.deep.equal([true, true, true]);
        await Person.delete(...ids);
        expect(await Promise.all(ids.map((p) => Person.has(p)))).to.deep.equal([
          false,
          false,
          false,
        ]);
        await Person.delete("foo", "bar", "baz"); // Should not error
      });

      it("should delete all entities", async function () {
        // TODO: We don't support deleteRange for our track changes yet...
        const Person = setupCollection();
        await Person.writeTransaction(async function () {
          const person = copyPerson();
          await Person.insert(person);
        });
        expect(await Person.find().count()).to.equal(1);
        // Closer checking into deleting things
        // const changes = db.table(ChangeTableName);
        // const beforeClear = await changes.count();
        // Delete all entities from Person collection
        await Person.clear();
        // Alternative to find() above... directly counting all instances
        expect(await Person.count()).to.equal(0);
        // Buuuut, this doesn't yet lead to any changes being recorded
        // expect(await changes.count()).to.be.greaterThan(beforeClear);
      });
    });

    describe("saving entities", () => {
      it("should save/update existing entity", async function () {
        const Person = setupCollection();
        const person = copyPerson();
        const [id] = await Person.save(person);
        person.name = "Mod";
        await Person.save(person);

        expect(await Person.findById(id)).to.haveOwnProperty("name", "Mod");

        // Test save from instance
        const personInstance = await Person.findById(id);
        if (personInstance) {
          personInstance.age = 99;
          await personInstance.save();
          expect(await Person.findById(id)).to.haveOwnProperty("age", 99);
        } else {
          throw new Error("should not be undefined");
        }
      });

      it("should save/update multiple entities", async function () {
        const Person = setupCollection();
        const persons = [copyPerson(), copyPerson(), copyPerson()];
        await Person.insert(...persons);
        persons.forEach((p) => p.age++);
        await Person.save(...persons);
        const array = await Person.find({}).toArray((data) =>
          data.map(({ age }) => age)
        );
        expect(array).to.deep.equal([8, 8, 8]);
      });

      it("should also save/update a non-existent entity", async function () {
        const Person = setupCollection();
        await Person.save({ name: "nothing", age: 55 });
        expect(await Person.find().count()).to.equal(1);
      });
    });

    describe("find/search", () => {
      it("should support finding one result at a time", async function () {
        const Person = setupCollection();
        const people: Person[] = [
          { name: "Lucas", age: 7 },
          { name: "Clyde", age: 99 },
          { name: "Duke", age: 2 },
        ];
        await Person.insert(...people);
        const query = {
          // Query for everyone over the age of 5
          age: { $gt: 5 },
        };
        // But only "find" one of them...
        const result = await Person.findOne(query);

        expect(result).to.not.be.undefined;
        expect(result).to.have.ownProperty("age");
        expect(result?.age).to.be.greaterThan(5);
      });
      it("should support simple queries", async function () {
        const Person = setupCollection();
        const people: Person[] = [
          { name: "Lucas", age: 7 },
          { name: "Clyde", age: 99 },
          { name: "Duke", age: 2 },
        ];
        await Person.insert(...people);
        const query = {
          // Find everyone over the age of 5
          age: { $gt: 5 },
        };
        const results = Person.find(query);

        expect(await results.count()).to.equal(2);
        const last = await results.last();
        // Should we 'unravel' the key/value pairs here?
        expect(last).to.have.ownProperty("age");
        expect(last?.age).to.be.greaterThan(5);
      });

      it("should support complex queries", async function () {
        const Person = setupCollection();
        const people: Person[] = [
          { name: "Lucas", age: 56 },
          { name: "Clyde", age: 55 },
          { name: "Mike", age: 52 },
          { name: "Micheal", age: 52 },
          { name: "Duke", age: 2 },
          { name: "Michelle", age: 2 },
          { name: "Michelangelo", age: 55 },
        ];
        await Person.insert(...people);
        const query: Query<Person> = {
          // Find people who are older than 5, and younger than 56, ...
          // but don't include Michael, he's a jerk...
          $and: [
            { age: { $gt: 5 } },
            { age: { $lt: 56 } },
            { name: { $not: { $eq: "Micheal" } } },
          ],
        };
        const results = Person.find(query);
        expect(await results.count()).to.equal(3);
        const last = await results.last();
        expect(last).to.have.ownProperty("age");
        expect(last?.age).to.be.greaterThan(5);
        expect(last?.age).to.be.lessThan(56);
        expect(await Person.find().count()).to.equal(7);
        // Use mingo directly, should also return 3 (sanity check)
        expect(mingo.find(people, query).count()).to.equal(3);
      });
    });

    describe("read transaction", () => {
      it("should test for existing entity", async function () {
        const Person = setupCollection();
        const person = copyPerson();
        const [id] = await Person.save(person);
        await Person.readTransaction(async function () {
          expect(await Person.has(id)).to.be.true;
        });
      });

      it("should return existing entity", async function () {
        const Person = setupCollection();
        const person = copyPerson();
        const [id] = await Person.save(person);
        await Person.readTransaction(async function () {
          const found = await Person.findById(id);
          expect(found).to.deep.equal(person);
          // await Person.insert(person); // Compiler won't let us!
        });
      });

      it("should support nested transactions, but no writes inside a read transaction", async function () {
        const Person = setupCollection();
        const person = copyPerson();
        await Person.save(person);
        try {
          await Person.readTransaction(async function () {
            // Note that dexie actually console.logs the exception here, which is annoying :shrug:
            // But the test is still "passing"...
            await Person.writeTransaction(async function () {
              return Person.insert(person);
            });
            throw shouldHaveThrown;
          });
        } catch (err) {
          expect(err).to.not.equal(shouldHaveThrown);
        }
      });
    });

    describe("write transaction", () => {
      it("should perform normal write operations", async function () {
        const Person = setupCollection();
        await Person.writeTransaction(async function () {
          const person = copyPerson();
          const [id] = await Person.insert(person);
          expect(await Person.find().count()).to.equal(1);
          return Person.delete(id);
        });
        expect(await Person.find().count()).to.equal(0);
      });

      it("should allow read transactions inside write transactions", (done) => {
        const Person = setupCollection();
        const person = copyPerson();
        Person.save(person).then(([id]) => {
          Person.writeTransaction(async function () {
            const found = await Person.readTransaction(async function () {
              return Person.findById(id);
            });
            expect(found).to.not.be.undefined;
          }).then(done);
        });
      }).timeout(5000);
    });
  });
});
