import { expect } from "chai";
import { PrivateKey } from "@textile/crypto";
import { Database } from "../local/db";
import { Errors } from "./index";
import { createDbClient } from "./grpc";
import { personSchema, shouldHaveThrown } from "../utils/spec.utils";
import ThreadID from "@textile/threads-id";

const databaseName = "remote-db";

describe("remote + db", function () {
  const privateKey = PrivateKey.fromRandom();
  context("schemas and pushing to remote", async function () {
    this.timeout(30000);
    let db: Database;
    let id: string | undefined;

    after(async function () {
      db.close();
      // Expect db.delete to delete the db
      await db.delete();
    });

    /**
     * Function to create a set of pre-defined udpates/changes
     */
    async function createChanges() {
      const collection = db.collection("Person");
      if (collection === undefined) throw new Error("should be defined");
      // Create some updates
      await collection.insert({ name: "child", age: 4 });
      await collection.insert({ name: "kid", age: 8 });
      await collection.insert({ name: "teen", age: 16 });
    }

    it("should be able to push local schemas to remote on push", async function () {
      this.timeout(30000);
      db = new Database(databaseName);
      // We always need to authorize first...
      const token = await db.remote.authorize(privateKey);
      // Now open the db with NO collections
      await db.open(1); // First version
      // We'll initialize before we actually push anything
      id = await db.remote.initialize();

      // Before we push anything, let's just check that we don't already have remote collections
      // Low level checks
      const client = createDbClient(db.remote.config);
      try {
        await client.getCollectionInfo(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ThreadID.fromString(id!),
          "Person"
        );
        throw shouldHaveThrown;
      } catch (err) {
        expect(err.toString()).to.include("collection not found");
      }

      // Now we close the db for some reason
      db.close();
      // Now let's open it with some new collection configs
      db = new Database(databaseName, {
        name: "Person",
        schema: personSchema,
        indexes: [
          { path: "name", unique: true },
          { path: "age", unique: false },
        ],
      });
      // Set our thread id and auth token directly
      // This is just syntactic sugar over more direct setting
      db.remote.set({ id, token });
      // Now let's open the db again
      // This internally updates the db version, because the collection set is different
      // We should already be authorized because we saved our token from before
      await db.open(2); // Version 2
      // Now finally, we push said changes
      await db.remote.push("Person");

      // These pushes should include the schemas/collections, so let's check that they're there
      const info = await client.getCollectionInfo(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ThreadID.fromString(db.id!),
        "Person"
      );
      expect(info.schema).to.deep.equal(personSchema);
      db.close();
    });

    it("should be able to push local schemas to remote on init", async function () {
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
      await db.open(2);
      // Create some default changes to push
      // These will already have been "checked" for schema compliance locally, but they'll
      // get checked remotely as well
      // Note: We haven't actually touched anything "remote" yet
      await createChanges();
      // Now for the remote stuff
      // We always need to authorize first...
      await db.remote.authorize(privateKey);
      // Do we have a remote table yet? Let's just push and see!
      try {
        await db.remote.push("Person");
      } catch (err) {
        expect(err).to.equal(Errors.ThreadIDError);
        // Opps, I didn't create the remote one yet, let's initialize
        try {
          // Use id from before, or if this is a fresh test, create a new one
          // Here's a demo of what to do if initialize throws with a thread already exists error
          await db.remote.initialize(id);
        } catch (err) {
          if (err === Errors.ThreadExists) {
            db.remote.set({ id }); // Just set the id direcly and move on!
          }
        }
      }
      await db.remote.push("Person");

      // Low level checks
      const client = createDbClient(db.remote.config);
      const info = await client.getCollectionInfo(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ThreadID.fromString(db.id!),
        "Person"
      );
      expect(info.schema).to.deep.equal(personSchema);
    });
  });
});
