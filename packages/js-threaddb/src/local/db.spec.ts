/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect } from "chai";
import { Database } from "./db";
import { ulid } from "ulid";
import Dexie from "dexie";
import { personSchema, shouldHaveThrown } from "../utils/spec.utils";

const databaseName = "database";

describe("database", function () {
  describe("construction and init", async function () {
    let db: Database;

    afterEach(function () {
      // Expect db.close to close the db
      db.close();
    });

    after(async function () {
      // Expect db.delete to delete the db
      await db.delete();
    });

    it("should only allow version incrementing", async function () {
      // Create basic db with two collections, one being empty
      db = new Database(databaseName);
      await db.open(2);
      expect(db.verno).to.equal(2);
      db.close();
      db = new Database(
        databaseName,
        {
          name: "Person",
          schema: personSchema,
          indexes: [
            { path: "name", unique: true },
            { path: "age", unique: false },
          ],
        },
        {
          name: "Empty",
        }
      );
      try {
        await db.open(1);
        throw shouldHaveThrown;
      } catch (err) {
        // TODO: Return a nicer error here
        expect(err.toString()).to.include("VersionError");
      }
      db.close();
      // We delete it here because otherwise, we'll have issues with our version numbers later
      await db.delete();
    });

    it("should not have a db id until the remote has been set and initialized", function () {
      // Create basic db with two collections, one being empty
      db = new Database(
        databaseName,
        {
          name: "Person",
          schema: personSchema,
          indexes: [
            { path: "name", unique: true },
            { path: "age", unique: false },
          ],
        },
        {
          name: "Empty",
        }
      );
      // Don't open it yet!
      expect(db.id).to.be.undefined;
    });

    it("should be able to pre-define collections", async function () {
      // Create basic db with two collections, one being empty
      db = new Database(
        databaseName,
        {
          name: "Person",
          schema: personSchema,
          indexes: [
            { path: "name", unique: true },
            { path: "age", unique: false },
          ],
        },
        {
          name: "Empty",
        }
      );
      await db.open();
      expect(db.collections().size).to.equal(2);
      const collection = db.collection("Person");
      expect(collection).to.not.be.undefined;
      // Low level check
      expect(db.dexie.table("Person").schema.indexes).to.have.lengthOf(2);
      expect(db.dexie.table("Person").schema.primKey).to.have.ownProperty(
        "name",
        "_id"
      );
    });

    it("should be able to define collection configs prior to opening the db", async function () {
      // Create basic db with two collections, one being empty
      db = new Database(databaseName);
      // Chain the collection config calls...
      db.collectionConfig({
        name: "Person",
        schema: personSchema,
        indexes: [
          { path: "name", unique: true },
          { path: "age", unique: false },
        ],
      }).collectionConfig({
        name: "Empty",
      });
      //Now we open it and check
      await db.open();
      expect(db.collections().size).to.equal(2);
      const collection = db.collection("Person");
      expect(collection).to.not.be.undefined;
      // Actually write something to cause data to be persisted
      await collection?.insert({ name: "toddler", age: 4 });
      expect(await collection?.count()).to.equal(1);
      // Low level check
      expect(db.dexie.table("Person").schema.indexes).to.have.lengthOf(2);
      expect(db.dexie.table("Person").schema.primKey).to.have.ownProperty(
        "name",
        "_id"
      );
    });
  });

  describe("methods", async function () {
    let db: Database;

    before(async function () {
      // Create basic db with two collections, one being empty
      db = new Database(
        databaseName,
        {
          name: "Person",
          schema: personSchema,
          indexes: [
            { path: "name", unique: true },
            { path: "age", unique: false },
          ],
        },
        {
          name: "Empty",
        }
      );
      await db.open();
    });

    after(async function () {
      // Expect db.delete to delete the db
      db.close();
      await db.delete();
    });

    it("should have monotonically increasing ulid ids", async function () {
      const collection = db.collection("Person");
      const first = ulid();
      // Now just wait a sec here...
      await new Promise((resolve) => setTimeout(resolve, 100));
      const obj = collection?.create({ name: "baby", age: 2 });
      // base32-encoded 26-character string representing 128 bytes
      expect(obj?._id).to.have.lengthOf(26);
      // Should work down the the millisecond...
      expect(first <= obj!._id).to.equal(true);
    });

    it("should be able to list local collections", function () {
      const collections = db.collections();
      expect(collections.size).to.equal(2);
      expect([...collections.keys()]).to.deep.equal(["Person", "Empty"]);
    });

    it("should be able to list local collections even if we lose them", function () {
      (db as any).collectionMap.clear();
      const collections = db.collections();
      expect(collections.size).to.equal(2);
      expect([...collections.keys()]).to.deep.equal(["Person", "Empty"]);
    });

    it("should be able to get a specific collection by name", function () {
      const collection = db.collection("Person");
      expect(collection?.name).to.equal("Person");
      // expect(collection?.schema).to.deep.equal(personSchema);
      // Should throw on missing collections
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        db.collection("Missing");
        throw shouldHaveThrown;
      } catch (err) {
        expect(err).to.be.instanceOf(Dexie.InvalidTableError);
      }
    });

    it("should be able to get specific collection, even by re-building cache", function () {
      (db as any).collectionMap.clear();
      const collection = db.collection("Person");
      expect(collection?.name).to.equal("Person");
    });
  });
});
