import type { Dexie } from "dexie";
import jsonpatch from "fast-json-patch";
import {
  GrpcConfig,
  getToken,
  newDB,
  defaults,
  getTokenChallenge,
} from "./grpc";
import type { Identity } from "@textile/crypto";
import ThreadID from "@textile/threads-id";
import { Client, DBInfo } from "@textile/threads-client";
import { Context } from "@textile/context"; // Dep of threads-client
import { grpc } from "@improbable-eng/grpc-web";
import {
  Change,
  ChangeTableName,
  StashTableName,
  MetaTableName,
} from "../middleware/changes";

export const Errors = {
  ThreadIDError: new Error("Missing/invalid thread id"),
  MissingDbError: new Error("Missing remote db/thread"),
  NoRemoteError: new Error("No remote service host specified"),
  RemoteError: new Error("Remote operation failed"),
  ChangeError: new Error("Unable to process db change(s)"),
  LocalChangesError: new Error("Unpushed local changes"),
  ThreadExists: new Error("Remote db/thread already exists"),
};

export const ThreadIDName = "thread-id";

const encoder = new TextEncoder();

/**
 * Config specifies the configuration options for remote sync.
 */
export interface RemoteConfig extends GrpcConfig {
  /**
   * Thread id
   */
  id: string;
  /**
   * Authorization token. This is here for ease of use.
   */
  token: string;
}

export class Remote {
  /**
   * Database identity on remote peer. String encoding of a thread id.
   */
  public id?: string;
  /**
   * Set of configuration options for remote sync.
   */
  public config: Partial<GrpcConfig>;

  /**
   * Create a new Remote instance.
   * @param storage The (private) storage provider. This is a pretty generic
   * interface that can be satisfied by a basic object for tests, or a full-
   * blown Dexie db for real usage.
   * @param config A set of configuration options for remote sync.
   */
  constructor(
    private storage: Dexie,
    config: Partial<RemoteConfig> = defaults
  ) {
    // Pull apart config into id, and config components and assign them
    const { id, token, ...rest } = config;
    // Set config to shallow, single-depth copy
    // Metadata will be overwritten if it exists
    this.config = { metadata: new grpc.Metadata(), ...rest };
    if (token) {
      this.config.metadata?.set("authorization", `bearer ${token}`);
    }
    // Specifies the thread id to use when making updates
    this.id = id;
  }

  /**
   * Set the remote configuration options.
   * @param config The configuration options to use. All are optional.
   * @example
   * ```@typescript
   * import type { Remote } from '@textile/threads'
   *
   * function example (remote: Remote) {
   *   remote.set({ serviceHost: "http://example.com:6007" })
   *   console.log(remote.get())
   *   // { serviceHost: "http://example.com:6007", ... }
   * }
   * ```
   */
  set(config: Partial<RemoteConfig>): this {
    // Replace current values with config options, otherwise stick to existing
    const { id, ...rest } = config;
    // Update config with shallow, single-depth copy
    this.config = { ...this.config, ...rest };
    // Update id if we specified a new one, this enables switching between dbs
    this.id = id ?? this.id;
    // Return this so we can chain updates/changes
    return this;
  }

  /**
   * Get the remote configuration options.
   * @example
   * ```@typescript
   * import type { Remote } from '@textile/threads'
   *
   * function example (remote: Remote) {
   *   remote.set({ serviceHost: "http://example.com:6007" })
   *   console.log(remote.get())
   *   // { serviceHost: "http://example.com:6007", ... }
   * }
   * ```
   */
  get(): Partial<RemoteConfig> {
    // Pull apart this into id, and config components
    const { id, config } = this;
    // This essentially provides a shallow, single-depth copy of the properties
    return { id, ...config };
  }

  async info(): Promise<DBInfo> {
    // Check that we have a valid thread id
    if (this.id === undefined) throw Errors.ThreadIDError;
    const threadID = ThreadID.fromString(this.id);
    // Get token auth information
    const [auth] = this.config.metadata?.get("authorization") ?? [];
    // Create a new remote client instance
    // TODO: This is not be the best way to do this...
    const client = new Client(
      // Maybe pass along context another way?
      new Context(this.config.serviceHost).withToken(auth.slice(7))
    );
    return client.getDBInfo(threadID);
  }

  /**
   * Authorize with a remote.
   * @param identity The identity to use for authorization, or the public key
   * of an identity.
   * @param callback A callback to use as part of the identity challenge. If
   * identity is a public key string, then a callback is required.
   * @see {@link getToken} or {@link getTokenChallenge} for lower-level access.
   * @note This is an online-only operation (i.e., can only be done when the
   * peer is able to connect with the remote).
   * @example
   * ```@typescript
   * import type { PrivateKey } from "@textile/crypto";
   * import type { Remote } from '@textile/threads'
   *
   * async function example (remote: Remote, identity: PrivateKey) {
   *   const token = await remote.authorize(identity)
   *   // The token is also automatically added to remote's `config.metadata`
   *   const { metadata } = remote.config
   *   console.log(metadata?.get("authorization"))
   *   // ...
   *   return token
   * }
   * ```
   */
  async authorize(identity: Identity): Promise<string>;
  async authorize(
    identity: string,
    callback: (challenge: Uint8Array) => Uint8Array | Promise<Uint8Array>
  ): Promise<string>;
  async authorize(
    identity: Identity | string,
    callback?: (challenge: Uint8Array) => Uint8Array | Promise<Uint8Array>
  ): Promise<string> {
    // If we already have what we need, we don't really need to do the remote auth
    // const [localKey, localAuth] = await this.storage
    //   .table(MetaTableName)
    //   .bulkGet(["public-key", "authorization"]);
    // const publicKey =
    //   typeof identity === "string" ? identity : identity.public.toString();
    // TODO: Decide if we want to persist either the auth or the public key in the future?
    // if (localKey === publicKey && localAuth !== undefined) {
    //   return localAuth; // No need to hit the remote APIs
    // }
    if (!this.config.serviceHost) {
      throw Errors.NoRemoteError;
    }
    // Fetch token for this identity from remote (must be online)
    let token = "";
    if (typeof identity === "string") {
      if (callback === undefined) {
        throw new Error("Callback required for public key challenge");
      }
      token = await getTokenChallenge(identity, callback);
    } else {
      token = await getToken(identity, this.config);
    }
    // Update in-memory config metadata for interacting with remote APIs
    this.config.metadata?.set("authorization", `bearer ${token}`);
    // TODO: Should we update authorization metadata for later re-hydration?
    // await this.storage.table(MetaTableName).bulkPut([
    //   { key: "public-key", value: publicKey }, // We're just storing this in case we need it
    //   { key: "authorization", value: `bearer ${token}` },
    // ]);
    // Return the token in case caller wants to storage themselves
    return token;
  }

  /**
   * Initialize a new remote db/thread.
   * Should only be done once, but only after opening the db.
   * @note This is an online-only operation (i.e., can only be done when the
   * peer is able to connect with the remote).
   * @param name The name for the new db.
   * @param id The thread id for the new db. Will default to random thread id.
   * Can be a thread id object or base32-encode string (the default).
   */
  async initialize(
    id: ThreadID | string | undefined = this.id
  ): Promise<string> {
    if (!this.config.serviceHost) {
      throw Errors.NoRemoteError;
    }
    // Meta is where we store metadata about this db... thread id, schemas, etc
    const meta = this.storage.table(MetaTableName);
    // Defaults new random id...
    let threadID = ThreadID.fromRandom();
    // But if we specified a valid id...
    if (id !== undefined) {
      // If we have a string, convert it...
      if (typeof id === "string") {
        threadID = ThreadID.fromString(id);
      } else {
        // Keep is "as is"
        threadID = id;
      }
    } else {
      // If it was undefined, try to extract from existing storage
      const { value } = (await meta.get(ThreadIDName)) ?? {};
      if (value !== undefined) {
        // If valid, use it
        threadID = ThreadID.fromString(value);
      }
      // Otherwise, stick to the random one we created
    }
    // Extract schema information from existing local dbs, and push to remote
    const schemas = await Promise.all(
      this.storage.tables
        .filter((table) => !table.name.startsWith("_"))
        .map(async (table) => ({
          name: table.name,
          schema: encoder.encode(JSON.stringify(await table.getSchema())),
          indexesList: [],
        }))
    );
    // This will throw if we get some error, but the backup is success
    let success = false;
    try {
      success = await newDB(this.storage.name, threadID, schemas, this.config);
    } catch (err) {
      if (err.toString().includes("db already exists")) {
        throw Errors.ThreadExists;
      }
    }

    // Otherwise throw a generic remote error :(
    if (!success) throw Errors.RemoteError;
    // Pull out id string because we want callers to deal only with strings
    const idString = threadID.toString();
    // Reset id in case we've updated or created a new random one
    this.set({ id: idString });
    // Update metadata table with ThreadIDName
    await meta.put({ key: ThreadIDName, value: idString });
    // Return id in case we created a new random one
    return idString;
  }

  async push(...collections: string[]): Promise<void> {
    if (!this.config.serviceHost) {
      throw Errors.NoRemoteError;
    }
    // Check that we have a valid thread id
    if (this.id === undefined) throw Errors.ThreadIDError;
    const threadID = ThreadID.fromString(this.id);
    const localChanges = this.storage.table<Change>(ChangeTableName);
    // Get token auth information
    const [auth] = this.config.metadata?.get("authorization") ?? [];
    // Create a new remote client instance
    // TODO: This is not be the best way to do this...
    const client = new Client(
      // Maybe pass along context another way?
      new Context(this.config.serviceHost).withToken(auth.slice(7))
    );

    // Blast thru provided collection names...
    for (const collectionName of collections) {
      // Check that table exists locally...
      const table = this.storage.table(collectionName);
      // Check that table exists remotely...
      try {
        // Just check, we don't need to keep the schema info around for now
        await client.getCollectionInfo(threadID, collectionName);
        // Assume our local schema matches the remote one...
        // But we might throw on this later!
      } catch (err) {
        if (err.toString().includes("collection not found")) {
          // We need to create it on the remote, maybe we haven't pushed yet?
          // So we grab our local schema, which defaults to open if not specified
          const schema = await table.getSchema();
          // And then we create a new remote collection to match it
          await client.newCollection(threadID, collectionName, schema);
        } else throw err;
      }
      // FIXME: We aren't getting information about failed transactions from the go service
      // But some fixes on the go side should make it useful again
      // * https://github.com/textileio/go-threads/pull/437
      // * https://github.com/textileio/go-threads/pull/436#discussion_r489016111
      // Filter changes by collection
      const filtered = localChanges.where("name").equals(collectionName);
      // For each change, create transaction item and switch on type
      // FIXME: There are more idiomatic ways to do this, but dexie seems to
      // swallow any errors thrown inside an async function within a transaction
      // so we do most of this outside a transaction and just delete the changes
      // if the overall remote transaction is successful.
      try {
        // See above, we need to actually materialize the array it seems?
        const changes = await filtered.toArray();
        let count = 0;
        for (const obj of changes) {
          switch (obj.type) {
            case "put": {
              // FIXME: We can't save known objects, and all objects are unknown the first time
              // we push to remote?!
              try {
                // await trans.save([obj.after]);
                await client.save(threadID, collectionName, [obj.after]);
                break;
              } catch (err) {
                // TODO: Should we enable this on the go end?
                // can't save unkown instance
                // sic "unkown"
                // Pass thru to add
                console.error(err);
              }
            }
            case "add": {
              // await trans.create([obj.after]);
              await client.create(threadID, collectionName, [obj.after]);
              break;
            }
            case "delete": {
              try {
                // await trans.delete([obj.key]);
                await client.delete(threadID, collectionName, [obj.key]);
              } catch (err) {
                // TODO: Should this actually be ok on the go end?
                // instance not found
                console.error(err);
                break;
              }
            }
          }
          // We track count to make sure we're processed them all later
          count++;
        }
        // Assuming all good, we'll delete our local changes
        const deleted = await filtered.delete();
        // Make sure we deleted just as much as we were expecting
        // Won't know why we made it this far, so just use a generic error
        if (count !== deleted) throw Errors.ChangeError;
        // We can safely end the transaction
        // await trans.end();
      } catch (err) {
        // In theory, err will be due to remote transaction calls... abort!
        // await trans.abort();
        throw err; // Rethrow for external consumers
      }
      // TODO: Maybe return updated hash of head update.
    }
  }

  /**
   * Stash local changes.
   * This moves local changes out of the local staging table into a stashed table. Making it
   * possible to pull remote changes and re-apply local changes on top (like a git rebase).
   * @see {@link Remote.applyStash}.
   */
  async createStash(): Promise<void> {
    // Grab a reference to our changes table
    const changes = this.storage.table(ChangeTableName);
    // If we don't have any, all good, just return
    if (!(await changes.count())) return;
    // Get a reference to stash table for storing changes
    const stash = this.storage.table(StashTableName);
    // Move change set to stash table, useful for rebasing later
    await stash.bulkPut(await changes.toArray());
    // Clear out local changes
    return changes.clear();
  }

  /**
   * Clear the local stash.
   * @see {@link Remote.createStash}.
   */
  async clearStash(): Promise<void> {
    // Grab a reference to our stash table
    const stash = this.storage.table(StashTableName);
    // Clear it out, dropping all changes, whether we've allied them or not!
    return stash.clear();
  }

  /**
   * Apply the local stash back on top of the local changes.
   * @param collections The set of collections to filter on. This means you can fine-tune which
   * changes are apoplied.
   * @see {@link Remote.createStash}.
   */
  async applyStash(...collections: string[]): Promise<void> {
    for (const collectionName of collections) {
      await this.storage.transaction(
        "rw",
        [collectionName, StashTableName],
        async (tx) => {
          const stash = tx.table<Change, string>(StashTableName);
          const table = tx.table(collectionName);
          const filtered = stash.where("name").equals(collectionName);
          // TODO: This can be optimized big time!
          for (const obj of await filtered.toArray()) {
            if (obj.type === "delete") {
              table.delete(obj.key);
            } else {
              const value = (await table.get(obj.key)) ?? {};
              jsonpatch.applyPatch(value, obj.ops, false, true);
              await table.put(value);
            }
          }
          await filtered.delete();
        }
      );
    }
  }

  /**
   * Pull remote changes into local db.
   * Attempts to force pull remote updates. This will automatically request updates from the remote.
   * @note This is an online-only operation (i.e., can only be done when the
   * peer is able to connect with the remote).
   * @param collections A (possibly empty) variadic set of collections to pull.
   * @returns A promise that resolves to the set of modified keys.
   */
  async pull(...collections: string[]): Promise<string[]> {
    // Simple to start:
    // Fetch all records for the given collection(s)
    // For each remote record, check against local, if diff, record it, otherwise, ignore
    // For each local remote that isn't in above set, setup for delete
    // Ideally, we'd have some new APIs on the remote side that allow us to track revisions
    // But this is a much longer conversation about appropriate approach etc.
    if (!this.config.serviceHost) {
      throw Errors.NoRemoteError;
    }
    // Check that we have a valid thread id
    if (this.id === undefined) throw Errors.ThreadIDError;
    const threadID = ThreadID.fromString(this.id);
    const localChanges = this.storage.table<Change>(ChangeTableName);
    if (await localChanges.count()) throw Errors.LocalChangesError;
    // Get token auth information
    const [auth] = this.config.metadata?.get("authorization") ?? [];
    // Create a new remote client instance
    // TODO: This is not be the best way to do this...
    const client = new Client(
      // TODO: Pass along context in a better way
      new Context(this.config.serviceHost).withToken(auth.slice(7))
    );
    // Blast thru provided collection names...
    // TODO: Yes, I know this is all extremely sub-optimal!
    for (const collectionName of collections) {
      const { instancesList } = await client.find(threadID, collectionName, {});
      const table = this.storage.table(collectionName);
      // Remote is our source of thruth, we completely overwrite anything local that is different
      const keys = await table.bulkPut(instancesList, { allKeys: true });
      // Now we also need to drop anything locally that wasn't in our remote
      await table.filter((obj) => !keys.includes(obj._id)).delete();
    }
    // TODO: Maybe return the ids of modified/deleted instances?
    const changes = this.storage.table<Change, string>(ChangeTableName);
    const values = await changes
      .filter((change) => change.ops.length > 0)
      .toArray();
    console.log(values);
    // Drop these "fake" changes
    await changes.clear();
    // Return the mutated keys
    // TODO: This currently ignores collection name, which is potentially confusing!
    return values.map((change) => change.key);
  }
}
