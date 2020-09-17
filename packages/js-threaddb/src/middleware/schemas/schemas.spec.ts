import Dexie from "dexie";
import setGlobalVars from "indexeddbshim";
const { indexedDB, IDBKeyRange } = setGlobalVars({}, { checkOrigin: false });
import { schemaAddon, SchemasTableName } from ".";
import { personSchema, shouldHaveThrown } from "../../utils/spec.utils";
import { expect } from "chai";

const databaseName = "schema";

describe("schema middleware", function () {
  let db: Dexie;
  before(async function () {
    db = new Dexie(databaseName, {
      indexedDB,
      IDBKeyRange,
      addons: [...Dexie.addons, schemaAddon],
    });

    db.version(1).stores({
      person: "++id,name,age",
    });

    expect(db.table(SchemasTableName)).to.not.be.undefined;

    await db.open();
  });

  after(async function () {
    db.close();
    await db.delete();
  });

  it("should work", async function () {
    this.timeout(100000);
    const person = db.table("person");
    // No schema yet!
    // Count = 1
    await person.put({
      _id: "test",
      name: "dev",
      // age: 2, // Don't include age...
      extra: "would throw", // But doesn't because we haven't set schema yet
    });
    expect(await person.count()).to.equal(1);
    // Now we set the schema
    await person.setSchema(personSchema);
    expect(await db.table(SchemasTableName).count()).to.equal(1);
    try {
      await db.transaction("readwrite", ["person"], async (tx) => {
        // Mask out reference to friends above
        const person = tx.table("person");
        const friend = await person.get({ name: "dev" });
        friend.age = undefined; // Invalid
        // Should not work
        await person.put(friend);
      });
      throw shouldHaveThrown;
    } catch (err) {
      expect(err.toString()).to.include("validation failed");
    }

    // Low level access to schemas
    const schemas = db.table(SchemasTableName);
    const array = await schemas.find().toArray();
    expect(array).to.have.lengthOf(1);
  });
});
