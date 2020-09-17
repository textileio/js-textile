import Dexie from "dexie";
import setGlobalVars from "indexeddbshim";
const { indexedDB, IDBKeyRange } = setGlobalVars({}, { checkOrigin: false });
import { changesAddon, ChangeTableName } from ".";
import { expect } from "chai";

const databaseName = "changes";

describe("changes middleware", function () {
  let db: Dexie;
  before(async function () {
    db = new Dexie(databaseName, {
      indexedDB,
      IDBKeyRange,
      addons: [...Dexie.addons, changesAddon],
    });

    db.version(1).stores({
      friends: "++id,name,shoeSize,address.city",
      other: "++id",
    });

    expect(db.table(ChangeTableName)).to.not.be.undefined;

    await db.open();
  });

  after(async function () {
    db.close();
    await db.delete();
  });

  it("should work", async function () {
    const friends = db.table("friends");
    // Change 1
    await friends.put({
      id: "test",
      name: "dev",
      shoeSize: 1,
      address: {
        city: "victoria",
      },
    });

    expect(await friends.count()).to.equal(1);

    await db.transaction("readwrite", ["friends"], async (tx) => {
      // Mask out reference to friends above
      const friends = tx.table("friends");
      const friend = await friends.get({ name: "dev" });
      ++friend.shoeSize;
      // Change 2
      await friends.put(friend);
      await db.transaction("readwrite", friends, async (tx) => {
        // Change 3 & 4
        // id is the id of the last add ("blah")
        const id = await friends.bulkAdd([
          {
            id: "steve",
            name: "steve",
            shoeSize: 99,
            address: {
              city: "nothing",
            },
          },
          {
            id: "blah",
            name: "guy",
            shoeSize: 88,
            address: {
              city: "unknown",
            },
          },
        ]);
        expect(await friends.count()).to.equal(3);
        const friend = await friends.get(id);
        friend.name = "other";
        // Change 5
        await friends.put(friend);
        // Still 3 because we're just updating
        expect(await friends.count()).to.equal(3);
        // Change 6
        await friends.delete(id);
      });
    });

    // Should be back down to 2 again
    expect(await friends.count()).to.equal(2);
    // Low level access to changes, which was automatically added to the
    // above transactions behind the scenes
    const changes = db.table(ChangeTableName);
    const array = await changes.find().toArray();
    expect(array).to.have.lengthOf(6);
  });
});
