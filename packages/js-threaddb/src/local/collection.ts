import { Query } from "../middleware/mongo";
import { Document, DocumentInstanceClassFactory, Instance } from "./document";
import { JSONSchema } from "../middleware/schemas";
import { PromiseExtended, Collection as Result, Table } from "dexie";

/**
 * Index defines an index.
 */

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
 * CollectionConfig describes a new Collection.
 */
export interface CollectionConfig {
  /**
   * The name for the collection
   */
  name: string;
  /**
   * The JSON Schema definition for instance validation
   */
  schema?: JSONSchema;
  /**
   * A set of fields to use for indexing
   */
  indexes?: Index[];
  /**
   * A validator function for writes
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeValidator?: (author: string, event: any, instance: any) => boolean;
  /**
   * A filter function for reads
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readFilter?: (reader: string, instance: any) => any;
}

/**
 * Collection is a group of instances sharing a schema.
 * Collections are like db tables. They can only exist in a db.
 */
export class Collection<T = unknown> {
  constructor(private table: Table<T, string>) {
    // When we update things, validate the input
    this.table.mapToClass(DocumentInstanceClassFactory(table));
  }

  /**
   * A name for the collection.
   */
  get name(): string {
    return this.table.name;
  }

  /**
   * Delete all instances in the collection.
   */
  async clear(): Promise<boolean> {
    const { result } = await this.table.drop();
    return result.ok > 0;
  }

  /**
   * Lock the collection for readonly operations.
   * @param cb A callback that takes a readonly collection.
   * @param timeout How long to wait to obtain the read lock. If after timeout seconds the lock
   * is not obtained, the method will error.
   * @note Provides no serialize-able isolation guarantees.
   * @note In practice, this will return a readonly Collection, which disables write operations.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readTransaction<T extends (...args: any) => any>(cb: T): ReturnType<T> {
    return this.table.db.transaction(
      "readonly",
      [this.table],
      cb
    ) as ReturnType<T>;
  }

  /**
   * Lock the collection for exclusive write operations.
   * @param cb A callback that takes a collection.
   * @param timeout How long to wait to obtain the write lock. If after timeout seconds the lock
   * is not obtained, the method will error.
   * @note Provides no serialize-able isolation guarantees.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeTransaction<T extends (...args: any) => any>(cb: T): ReturnType<T> {
    return this.table.db.transaction(
      "readwrite",
      [this.table],
      cb
    ) as ReturnType<T>;
  }

  /**
   * Find an instance by id.
   * @param id The instance id.
   */
  findById(id: string): PromiseExtended<(Document<T> & Instance) | undefined> {
    // TODO: Fix up these messy types
    return (this.table.get(id) as unknown) as PromiseExtended<
      (Document<T> & Instance) | undefined
    >;
  }

  /**
   * Insert (multiple) new instance(s).
   * @note Insert is similar to save, except it will not allow saving/overwriting existing instances.
   * @note This is the same as `create` on the Go API.
   * @param instances A variadic array of instances.
   */
  async insert(...instances: T[]): Promise<string[]> {
    return this.table.bulkAdd(instances, { allKeys: true });
  }

  /**
   * Create a new instance document that can be added or operated on.
   * This does not automatically commit the instance to the collection.
   * @param data The input data to use when initializing the document.
   */
  create(data?: T): Document<T> & Instance {
    // TODO: Create is actually used differently in the Go clients, should we rename this?
    const cls = this.table.schema.mappedClass;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new (cls as any)(data);
  }

  /**
   * Remove (multiple) instance(s) by id.
   * @note It doesn't fail if the ID doesn't exist.
   * @param ids A variadic array of instance ids.
   */
  async delete(...ids: string[]): Promise<void> {
    await this.table.bulkDelete(ids);
    return;
  }

  /**
   * Save updates to (multiple) instance(s).
   * @note Save is similar to insert, except it allows saving/overwriting existing instances.
   * @param instances A variadic array of instances.
   */
  save(...instances: T[]): Promise<string[]> {
    return this.table.bulkPut(instances, { allKeys: true });
  }

  /**
   * Check that (all) instance(s) exists.
   * @param id A variadic array of instance ids.
   */
  async has(...ids: string[]): Promise<boolean> {
    const instances = await this.table.bulkGet(ids);
    return Boolean(instances.length) && instances[0] !== undefined;
  }

  /**
   * Find all instances matching the query.
   * @param query Mongodb-style filter query.
   * @param options Additional options to control query operation.
   */
  find(
    query?: Query<Document<T> & Instance>
  ): Result<Document<T> & Instance, string> {
    // TODO: Fix up these messy types
    return this.table.find(query) as Result<Document<T> & Instance, string>;
  }

  /**
   * Find the first instance matching the query
   * @param query Mongodb-style filter query.
   * @param options Additional search options.
   * @note This is not available on the Go API.
   */
  findOne(
    query?: Query<Document<T> & Instance>
  ): Promise<(Document<T> & Instance) | undefined> {
    // TODO: Fix up these messy types
    // FIXME: We don't have tests for this method yet
    return this.table.findOne(query) as Promise<
      (Document<T> & Instance) | undefined
    >;
  }

  /**
   * Count all instances matching the query.
   * @param query Mongodb-style filter query.
   * @param options Additional search options.
   * @note This is not available on the Go API.
   */
  count(query?: Query<Document<T>>): Promise<number> {
    return this.table.count(query);
  }
}
