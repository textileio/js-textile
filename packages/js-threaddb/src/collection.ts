import { FilterQuery, FindOptions } from "./query";
import { JSONType, JSONSchema } from "./utils";

/**
 * Document is any JSON object with an _id field.
 * It can be operated on directly, and its updates should be reflected in its saved state.
 */
export interface Document extends Record<string, JSONType> {
  _id: string;
}

/**
 * Instance is a (proxy to) a document and its underlying collection.
 */
export interface Instance<T extends Document = never> {
  /**
   * Save this instance to its parent collection.
   */
  save(): Promise<void>;

  /**
   * Remove this instance (by id) from its parent collection.
   */
  remove(): Promise<void>;

  /**
   * Check if this instance (by id) exists in its parent collection.
   */
  exists(): Promise<boolean>;

  /**
   * Get a JSON representation of this instance.
   */
  toJSON(): JSONType;

  /**
   * Get a CBOR representation of this instance.
   */
  toCBOR(): JSONType;
}

/**
 * InstanceConstructors are anything than can construct an instance, such as a Collection.
 */
export interface InstanceConstructor<T extends Document = never> {
  /**
   * Create a new Instance based on the input data.
   */
  (data: Partial<T>): Instance<T> & T;
  // A Collection can construct an Instance!
  new (data: Partial<T>): Instance<T> & T;
}

/**
 * Collection is a group of instances sharing a schema.
 * Collections are like db tables. They can only exist in a single dbs.
 */
export interface Collection<T extends Document = never> {
  /**
   * A name for the collection.
   */
  readonly name: string;

  /**
   * A valid json schema object.
   */
  readonly schema: JSONSchema;

  /**
   * Lock the collection for readonly operations.
   * @param cb A callback that takes a readonly collection.
   * @param timeout How long to wait to obtain the read lock. If after timeout seconds the lock
   * is not obtained, the method will error.
   * @note Provides no serializable isolation gurantees.
   * @note In practice, this will return a readonly Collection, which disables write operations.
   */
  readTransaction(
    cb: (c: Collection<T>) => Promise<void> | void,
    timeout?: number
  ): void;

  /**
   * Lock the collection for exclusive write operations.
   * @param cb A callback that takes a collection.
   * @param timeout How long to wait to obtain the write lock. If after timeout seconds the lock
   * is not obtained, the method will error.
   * @note Provides not serializable isolation gurantees.
   */
  writeTransaction(
    cb: (c: Collection<T>) => Promise<void> | void,
    timeout?: number
  ): void;

  /**
   * Find an instance by id.
   * @param id The instance id.
   */
  findById(id: string): Promise<T>;

  /**
   * Insert (multiple) new instance(s).
   * @note Insert is similar to save, except it will not allow saving/overwriting existing instances.
   * @note This is the same as `create` on the Go API.
   * @param instances A variadic array of instances.
   */
  insert(...instances: T[]): Promise<void>;

  /**
   * Remove (multiple) instance(s) by id.
   * @note It doesn't fail if the ID doesn't exist.
   * @param ids A variadic array of instance ids.
   */
  delete(...ids: string[]): Promise<void>;

  /**
   * Save updates to (multiple) instance(s).
   * @note Save is similar to insert, except it allows saving/overwriting existing instances.
   * @param instances A variadic array of instances.
   */
  save(...instances: T[]): Promise<void>;

  /**
   * Check that (all) instance(s) exists.
   * @param id A variadic array of instance ids.
   */
  has(...ids: string[]): Promise<boolean>;

  /**
   * Find all instances matching the query.
   * @param query Mongodb-style filter query.
   * @param options Additional options to control query operation.
   */
  find(query?: FilterQuery<T>, options?: FindOptions): AsyncIterableIterator<T>;

  /**
   * Find the first instance matching the query
   * @param query Mongodb-style filter query.
   * @param options Additional search options.
   * @note This is not available on the Go API.
   */
  findOne(
    query?: FilterQuery<T>,
    options?: FindOptions
  ): Promise<IteratorResult<T>>;

  /**
   * Count all instances matching the query.
   * @param query Mongodb-style filter query.
   * @param options Additional search options.
   * @note This is not available on the Go API.
   */
  count(query: FilterQuery<T>, options: FindOptions): Promise<number>;
}
