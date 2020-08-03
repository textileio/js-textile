import { ThreadID } from "@textile/threads-id";
import { EventEmitter } from "events";
import { Collection, Document } from "./collection";
import { Manager } from "./manager";
import { Closer, JSONSchema, Options } from "./utils";

// Index defines an index.
export interface Index {
  /**
   * Path to the field to index in dot syntax, e.g., "name.last" or "age".
   */
  path: string;
  /**
   * Unique indicates that only one instance should exist per field value.
   */
  unique?: boolean;
}

/**
 * DBInfo contains joining/sharing information for a db.
 */
export interface DBInfo {
  /**
   * The thread key, encoded as a base32 string.
   * @note We have a `ThreadKey` object that handles serialization etc.
   */
  key: string;
  /**
   * The Multiaddrs for a peer hosting the given db.
   * @note We're using strings here rather than actual Multiaddr classes for usability reasons.
   */
  addrs: string[];
}

/**
 * Database is the aggregate-root of events and state.
 */
export interface Database extends Closer, EventEmitter {
  // Events: statusChanged, remoteUpdate, localUpdate, etc

  /**
   * Stores the db name.
   * @note This is the same as `GetName` on the Go API, but is a property here (so no get).
   */
  readonly name: string;

  /**
   * Stores the db thread id.
   */
  readonly id: ThreadID;

  /**
   * Stores the addresses and key that can be used to join the DB thread.
   * @note This is the same as `GetDBInfo` on the Go API, but is a property here (so no get).
   */
  readonly dbInfo: Promise<DBInfo>;

  /**
   * Stores a map of collections (database tables).
   * @note Might not be needed.
   */
  readonly collections: Map<string, Collection>;

  /**
   * Creates a new empty collection from an input JSON schema.
   * @param name A name for the collection.
   * @param schema A valid JSON schema object.
   */
  newCollection<T extends Document = never>(
    name: string,
    schema: JSONSchema,
    indexes: string[]
  ): Promise<Collection<T>>;

  /**
   * Creates a new collection from an initial input object.
   * It will attempt to infer the JSON schema from the input object.
   * @param name A name for the collection.
   * @param data A valid JSON object.
   * @param indexes A set of index paths to include.
   * @note This is not available on the Go API.
   */
  newCollectionFromObject<T extends Document = never>(
    name: string,
    data: T,
    indexes: Index[]
  ): Promise<Collection<T>>;

  /**
   * Updates an existing collection.
   * Updates can include schema and indexes. Any existing indexes not specified in the update will be dropped.
   * @param name The name of the collection.
   * @param schema A valid JSON schema object.
   * @param indexes A set of index paths to include.
   */
  updateCollection(
    name: string,
    schema: JSONSchema,
    indexes?: Index[]
  ): Promise<void>;

  /**
   * Gets an existing collection.
   * @param name The name of the collection.
   * @note This could be changed to `db.collection(<name>)` or `db.<name>` to match MongoDB?
   */
  getCollection(name: string): Promise<Collection>;

  /**
   * Returns all collections by name.
   * @note The return type differs slightly from the Go API.
   */
  listCollections(): Promise<Map<string, Collection>>;

  /**
   * Deletes collection by name and drops all indexes.
   * @param name The name of the collection.
   * @note This could be changed to `db.collection(<name>).drop()` or `db.<name>.drop()` to match MongoDB?
   */
  deleteCollection(name: string): Promise<void>;

  // Additional APIs for syncing.
  // Some work needs to be done to evaluate other examples of this, for example Dexie, Pouch, etc.
  // The following is loosely inspired by Dexie.

  /**
   * Create a presistend a two-way sync connection with given remote peer.
   * @param The Multiaddr for a peer hosting the given db.
   * @note In general a hybrid approach is used (unless specified otherwise via options).
   * The hybrid approach always does:
   * For writes...
   * * Local writes first, and then attempts to flush them. These will be queued if offline.
   * For reads...
   * * Remote check first, then if needed pull updates.
   * * For queries, query locally after sync. If offline, a local query is done.
   * * The above sync then query might be wrong. Could also do query on remote and sync in background.
   * @todo We need some very simple mechanism for the local db to know if it is out of date.
   * Something like the cid of the latest thread record, or even the record's sig would work.
   */
  connect(addr: string): Promise<boolean>; // But probably some response or config object

  /**
   * Stop syncing with given remote peer but keep revision states until next connect.
   * @param addr Multiaddr for a peer hosting the given db.
   */
  disconnect(addr: string): Promise<boolean>;

  /**
   * List the instances in our pending queue. These are the instances that have been updated, but
   * not yet flushed to the remote.
   * @note As a first pass, we are not going to deal with conflicts locally. We leave this up
   * to the remote in all cases. We will assume that the remote is the single source of truth. This
   * might lead to unexpected results in collaborative settings, but we will deal with that when
   * it comes up.
   */
  pending(): Promise<Array<{ collection: string; instance: string }>>;

  /**
   * Attempt to force push our local updates. This will automatically flush all pending writes to
   * the remote. It will return a boolean indicating if the push was accepted. If not, the writes
   * are safely returned to the queue.
   */
  push(): Promise<boolean>;

  /**
   * Attempt to foce pull remote updates. This will automatically request updates from the remote.
   * It will return a boolean indicating if the pull was successful. To listen to the updates
   * themselves, listen for the remoteUpdate events to roll in.
   */
  pull(): Promise<boolean>;
}

export interface DatabaseConstructor {
  /**
   * Create a new Database.
   * This is used directly by a db manager to create new dbs with the same config.
   */
  new (manager: Manager, id?: ThreadID, opts?: Options): Database;
}
