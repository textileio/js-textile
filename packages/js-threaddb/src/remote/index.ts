import type { Dexie } from "dexie";
import { Context } from "@textile/context";
import { KeyInfo, UserAuth } from "@textile/security";
import jsonpatch from "fast-json-patch";
import {
  GrpcConfig,
  getToken,
  newDB,
  defaults,
  createDbClient,
  getTokenChallenge,
  CollectionConfig,
} from "./grpc";
import type { Identity } from "@textile/crypto";
import ThreadID from "@textile/threads-id";
import { DBInfo, WriteTransaction } from "@textile/threads-client";
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
const decoder = new TextDecoder();

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
   * Create a new gRPC client instance from a supplied user auth object.
   * Assumes all default gRPC settlings. For customization options, use a context object directly.
   * The callback method will automatically refresh expiring credentials.
   * @param auth The user auth object or an async callback that returns a user auth object.
   * @example
   * ```typescript
   * import {UserAuth, Client} from '@textile/threads'
   *
   * function create (auth: UserAuth) {
   *   return Client.withUserAuth(auth)
   * }
   * ```
   * @example
   * ```typescript
   * import {UserAuth, Client} from '@textile/threads'
   *
   * function setCallback (callback: () => Promise<UserAuth>) {
   *   return Client.withUserAuth(callback)
   * }
   * ```
   */
  async setUserAuth(
    auth: UserAuth | (() => Promise<UserAuth>)
  ): Promise<Remote> {
    const init =
      typeof auth === "object"
        ? Context.fromUserAuth(auth, this.config.serviceHost)
        : Context.fromUserAuthCallback(auth, this.config.serviceHost);
    // Pull in any existing headers that may have already been set
    const json: Record<string, string[]> = {};
    this.config.metadata?.forEach((key, values) => (json[key] = values));
    const metadata = await Context.fromJSON({
      ...json,
      ...init.toJSON(),
    }).toMetadata();
    this.config.metadata = metadata;
    return this;
  }

  /**
   * Create a new gRPC client instance from a supplied key and secret
   * @param key The KeyInfo object containing {key: string, secret: string, type: 0}. 0 === User Group Key, 1 === Account Key
   * @param host The remote gRPC host to connect with. Should be left as default.
   * @param debug Whether to run in debug mode. Defaults to false.
   * @example
   * ```typescript
   * import {KeyInfo, Client} from '@textile/threads'
   *
   * async function create (keyInfo: KeyInfo) {
   *   return await Client.withKeyInfo(keyInfo)
   * }
   * ```
   */
  async setKeyInfo(key: KeyInfo): Promise<Remote> {
    const init = await new Context(this.config.serviceHost).withKeyInfo(key);
    // Pull in any existing headers that may have already been set
    const json: Record<string, string[]> = {};
    this.config.metadata?.forEach((key, values) => (json[key] = values));
    const metadata = await Context.fromJSON({
      ...json,
      ...init.toJSON(),
    }).toMetadata();
    this.config.metadata = metadata;
    return this;
    return this;
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
    const client = createDbClient(this.config);
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
      token = await getTokenChallenge(identity, callback, this.config);
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
    const schemas: CollectionConfig[] = await Promise.all(
      this.storage.tables
        .filter((table) => !table.name.startsWith("_"))
        .map(async (table) => ({
          name: table.name,
          schema: encoder.encode(JSON.stringify(await table.getSchema())),
          indexesList: [],
          writevalidator: "", // TODO: Update this once we support validators/filters
          readfilter: "",
        }))
    );
    // This will throw if we get some error, but the "backup" is success
    let idString = "";
    try {
      idString = await newDB(this.storage.name, threadID, schemas, this.config);
    } catch (err) {
      if (err.toString().includes("db already exists")) {
        idString = threadID.toString();
        // If it already exists, maybe we just need to create/update the schemas?
        const client = createDbClient(this.config);
        for (const schema of schemas) {
          schema.schema = JSON.parse(decoder.decode(schema.schema));
          try {
            await client.newCollection(threadID, schema);
          } catch (err) {
            if (!err.message.includes("collection already registered"))
              throw err;
          }
        }
      } else {
        // Otherwise, just throw it
        throw err;
      }
    }

    // Otherwise throw a generic remote error :(
    if (!idString) throw Errors.RemoteError;
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
    const client = createDbClient(this.config);

    // Blast thru provided collection names...
    for (const collectionName of collections) {
      // Check that table exists locally...
      this.storage.table(collectionName);
      // Filter changes by collection
      const filtered = localChanges.where("name").equals(collectionName);
      if ((await filtered.count()) < 1) {
        return; // Early out if no changes
      }
      // For each change, create transaction item and switch on type
      // TODO: Currently, go-threads underlying db doesn't support isolation in transactions
      // so we have to do these as one-off transactions for now so that queries reflect reality
      // this is **not** ideal, as we lose the atomicity of pushes...
      let trans: WriteTransaction | undefined;
      try {
        // TODO:See above, we need to actually materialize the array it seems?
        const changes = await filtered.toArray();
        let count = 0;

        for (const obj of changes) {
          trans = client.writeTransaction(threadID, collectionName);
          await trans.start();
          switch (obj.type) {
            case "put": {
              // FIXME: https://github.com/textileio/go-threads/issues/440
              // TODO: https://github.com/textileio/go-threads/pull/450
              try {
                await trans.save([obj.after]);
                // await client.save(threadID, collectionName, [obj.after]);
                break;
              } catch (err) {
                throw err;
              }
            }
            case "add": {
              try {
                await trans.create([obj.after]);
                // await client.create(threadID, collectionName, [obj.after]);
                break;
              } catch (err) {
                throw err;
              }
            }
            case "delete": {
              try {
                await trans.delete([obj.key]);
                // await client.delete(threadID, collectionName, [obj.key]);
                break;
              } catch (err) {
                // TODO: https://github.com/textileio/go-threads/pull/450
                // console.error(err); // We'll ignore this though
                throw err;
              }
            }
          }
          // FIXME: We close out the transaction on each loop :(
          await trans.end();
          // We track count to make sure we're processed them all later
          count++;
        }
        // Assuming all good, we'll delete our local changes
        const deleted = await filtered.delete();
        // Make sure we deleted just as much as we were expecting
        // Won't know why we made it this far, so just use a generic error
        if (count !== deleted) throw Errors.ChangeError;
      } catch (err) {
        // In theory, err will be due to remote transaction calls... abort!
        try {
          await trans?.discard();
        } catch (err) {
          // Nothing more we can do here
        }
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
    const array = await changes.toArray();
    // Move change set to stash table, useful for rebasing later
    await stash.bulkPut(array);
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
          if ((await filtered.count()) < 1) {
            return; // Early out if no changes
          }
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
    const client = createDbClient(this.config);
    // Blast thru provided collection names...
    // TODO: Yes, I know this is all extremely sub-optimal!
    for (const collectionName of collections) {
      const instances = await client.find(threadID, collectionName, {});
      const table = this.storage.table(collectionName);
      // Remote is our source of thruth, we completely overwrite anything local that is different
      const keys = await table.bulkPut(instances, { allKeys: true });
      // Now we also need to drop anything locally that wasn't in our remote
      await table.filter((obj) => !keys.includes(obj._id)).delete();
    }
    const isModUpdate = (ops: any[]) => {
      const [op0] = ops;
      return op0.op === "add" && op0.path == "/_mod";
    };
    // TODO: Maybe return the ids of modified/deleted instances?
    const changes = this.storage.table<Change, string>(ChangeTableName);
    const test = await changes.toArray();
    const values = await changes
      .filter((change) => change.ops.length > 0 && !isModUpdate(change.ops))
      .toArray();
    // Drop these "fake" changes
    await changes.clear();
    // Return the mutated keys
    // TODO: This currently ignores collection name, which is potentially confusing!
    return values.map((change) => change.key);
  }
}
