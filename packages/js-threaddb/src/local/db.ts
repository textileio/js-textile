import { Collection, CollectionConfig } from "./collection";
import { createIndexString, NewDexie } from "../utils";
import { Remote } from "../remote";
import { Dexie, Table } from "dexie";

export class Database {
  readonly dexie: Dexie;
  readonly remote: Remote;
  private collectionMap: Map<string, Collection> = new Map();
  private pendingSchemas: CollectionConfig[] = [];

  /**
   * Create a new local db instance.
   * @param name The name for db persistence.
   * @param collections A (variadic) list of collection configs.
   * @see {@link CollectionConfig } for details on collection configuration options.
   */
  constructor(name: string, ...collections: CollectionConfig[]) {
    this.dexie = NewDexie(name);
    this.remote = new Remote(this.dexie); // Always start with defaults
    collections.forEach((collection) => this.pendingSchemas.push(collection));
  }

  /**
   * Base32-encoded string representation of the db's thread id.
   */
  get id(): string | undefined {
    return this.remote.id;
  }

  /**
   * Open the local db for reads/writes.
   */
  async open(version = 1): Promise<this> {
    if (!this.dexie.isOpen()) {
      // First, define our stores/indexes
      let stores = [];
      if (this.pendingSchemas.length) {
        const specs = this.pendingSchemas.map((config) => {
          const indexes = [
            { path: "_id", uuid: false, auto: true }, // Always include _id as uuid
            ...(config.indexes ?? []),
          ]
            .map((index) => createIndexString(index))
            .join(",");
          return [config.name, indexes];
        });
        stores = Object.fromEntries(specs);
      }
      // TODO: Can we "skip" the version thing?
      this.dexie.version(version).stores(stores);
      // Try to open the dexie store, if we don't have the right version here, consider version++
      await this.dexie.open();

      // Now we have our table specs... time to populate our collections
      for (const collection of this.pendingSchemas) {
        // Should always be the case
        if (!this.collectionMap.has(collection.name)) {
          // If we didn't create this table yet, this will throw
          const table = this.dexie.table<unknown, string>(collection.name);
          // Set the internal schema for this table, which will be used elsewhere
          await table.setSchema(collection.schema);
          // Add it to our collections map for faster reference
          this.collectionMap.set(collection.name, new Collection(table));
        }
      }
      this.pendingSchemas = [];
    }
    return this;
  }

  /**
   * Close the local db to reads/writes.
   */
  close(): void {
    return this.dexie.close();
  }

  /**
   * Delete the local db and its persistent storage.
   */
  delete(): Promise<void> {
    return this.dexie.delete();
  }

  /**
   * Get the current local db version number.
   * This is a non-ordered integer hash of the stringified input indexes.
   * It is used for uniqueness.
   */
  get verno(): number {
    return this.dexie.verno;
  }

  /**
   * Helper method to push additional collection configs to pending schemas list.
   * This may be called multiple times, but _must_ be called _before_ opening the db.
   * @param config A collection config to add to the internal list.
   */
  collectionConfig(config: CollectionConfig): this {
    this.pendingSchemas.push(config);
    return this;
  }

  /**
   * Get an existing local collection.
   * @param name The name of the collection.
   */
  collection<T = unknown>(name: string): Collection<T> | undefined {
    let collection = this.collectionMap.get(name);
    if (collection !== undefined) {
      return collection as Collection<T>;
    }
    const table: Dexie.Table<T, string> = this.dexie.table(name);
    collection = new Collection<T>(table);
    this.collectionMap.set(name, collection);
    return collection as Collection<T>;
  }

  /**
   * Returns all local collections by name.
   */
  collections(): Map<string, Collection> {
    const tables: Table<string, any>[] = this.dexie.tables.filter(
      (table) => !table.name.startsWith("_")
    );
    for (const table of tables) {
      if (!this.collectionMap.has(table.name)) {
        this.collectionMap.set(table.name, new Collection(table));
      }
    }
    return this.collectionMap;
  }
}
