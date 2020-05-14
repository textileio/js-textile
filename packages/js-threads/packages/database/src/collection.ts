import { Datastore, Key, MemoryDatastore, Query } from 'interface-datastore'
import Ajv, { ValidateFunction, ValidationError } from 'ajv'
import { ulid } from 'ulid'
import { reduce } from 'streaming-iterables'
import { Query as MingoQuery } from 'mingo'
import { JSONSchema4, JSONSchema6, JSONSchema7 } from 'json-schema'
import { Dispatcher, Instance, JsonPatchStore } from '@textile/threads-store'
import { FilterQuery } from './query'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolve } = require('mingo/util')

export { FilterQuery }

export type JSONSchema = JSONSchema4 | JSONSchema6 | JSONSchema7

export const existingKeyError = new Error('Existing key')

interface FindOptions<T extends Instance> extends Pick<Query<T>, 'limit' | 'offset' | 'keysOnly'> {
  sort?: { [key in keyof T]?: 1 | -1 }
}

const defaultOptions: Options<any> = {
  child: new MemoryDatastore(),
  dispatcher: new Dispatcher(),
}

export interface Config {
  name: string
  schema: JSONSchema
}

const cmp = (a: any, b: any, asc: 1 | -1 = 1) => {
  if (a < b) return -1 * asc
  if (a > b) return 1 * asc
  return 0
}

const handler = <T extends Instance>(obj: T) => {
  return {
    get: (target: T | Document<T>, property: keyof T, _receiver: any) => {
      if (Reflect.has(obj, property)) {
        return Reflect.get(obj, property)
      } else if (!Reflect.has(target, property)) {
        return undefined
      }
      return Reflect.get(target, property)
    },
    set: (_target: T | Document<T>, property: keyof T, value: any, _receiver: any) => {
      return Reflect.set(obj, property, value)
    },
  }
}

/**
 * Options for creating a new collection.
 */
export interface Options<T extends Instance> {
  child?: Datastore<T>
  dispatcher?: Dispatcher
}

/**
 * Document is a wrapper around a Collection and a (proxy to) an Instance object.
 */
export class Document<T extends Instance = any> {
  constructor(private _collection: Collection<T>, private _data: T) {
    return new Proxy<Document<T>>(this, handler(this._data))
  }

  /**
   * Save this Instance to its parent collection.
   */
  save() {
    return this._collection.save(this._data)
  }

  /**
   * Remove this Instance (by id) from its parent collection.
   */
  remove() {
    return this._collection.delete(this._data._id)
  }

  /**
   * Check if this Instance (by id) exists in its parent collection.
   */
  exists() {
    return this._collection.has(this._data._id)
  }

  /**
   * Get a JSON representation of this Instance.
   */
  toJSON() {
    return this._data
  }

  private toCBOR() {
    return this.toJSON()
  }
}

// Collections

export interface Collection<T extends Instance = any> {
  (data: Partial<T>): Document<T> & T

  new (data: Partial<T>): Document<T> & T
}

export class ReadonlyCollection<T extends Instance = any> {
  /**
   * Validator is a function for validating inputs against a given schema.
   */
  public validator: ValidateFunction
  /**
   * Child is the underlying datastore.
   */
  public child: JsonPatchStore<T>

  /**
   * Collection creates a new collection.
   * @param name A name for the collection.
   * @param schema A valid JSON schema object.
   * @param options The underlying collection options.
   */
  constructor(readonly name: string, schema: JSONSchema, options: Options<T> = defaultOptions) {
    this.validator = new Ajv({ useDefaults: true }).compile(schema)
    this.child = new JsonPatchStore(options.child, new Key(name), options.dispatcher)
  }

  static fromCollection<T extends Instance>(other: Collection<T>) {
    const readOnly = new ReadonlyCollection(other.name, {})
    readOnly.validator = other.validator
    readOnly.child = other.child
    return readOnly
  }

  /**
   * Find an Instance by _id
   * @param id The Instance id.
   */
  async findById(id: string) {
    return this.child.get(new Key(id))
  }

  /**
   * Check that a given Instance exists.
   * @param id The Instance id.
   */
  async has(id: string) {
    return this.child.has(new Key(id))
  }

  /**
   * Find all entities matching the query
   * @param query Mongodb-style filter query.
   * @param options Additional options to control query operation.
   */
  find(query?: FilterQuery<T>, options: FindOptions<T> = {}) {
    // @fixme(github.com/kofrasa/mingo/issues/141) Hack around some strange es issues in some JS envs
    const qry: FilterQuery<T> = query || {}
    Object.keys(qry).forEach((key: keyof T) => {
      if (typeof qry[key] === 'object' && !Array.isArray(qry[key])) {
        qry[key] = Object.assign(new Object(), qry[key])
      }
    })
    const m: MingoQuery = new MingoQuery(qry, { idKey: '_id' })
    const filters: Query.Filter<T>[] = [({ value }) => m.test(value)]
    const orders: Query.Order<T>[] = []
    if (options.sort) {
      for (const [key, value] of Object.entries(options.sort)) {
        orders.push((items) =>
          items.sort((a, b) => {
            return cmp(resolve(a.value, key), resolve(b.value, key), value || 1)
          }),
        )
      }
    }
    const q: Query<T> = {
      ...options,
      filters,
      orders,
    }
    return this.child.query(q)
  }

  /**
   * Find the first Instance matching the query
   * @param query Mongodb-style filter query.
   * @param options Additional search options.
   */
  findOne(query: FilterQuery<T>, options: FindOptions<T> = {}) {
    const it = this.find(query, options)
    return it[Symbol.asyncIterator]().next()
  }

  /**
   * Count all entities matching the query
   * @param query Mongodb-style filter query.
   * @param options Additional search options.
   */
  count(query: FilterQuery<T>, options: FindOptions<T> = {}) {
    return reduce((acc, _value) => acc + 1, 0, this.find(query, options))
  }
}

/**
 * Collection is a store of entities defined by a single schema.
 */
export class Collection<T extends Instance = any> extends ReadonlyCollection<T> {
  /**
   * Collection creates a new collection.
   * @param name A name for the collection.
   * @param schema A valid JSON schema object.
   * @param options The underlying collection options.
   */
  constructor(readonly name: string, schema: JSONSchema, options: Options<T> = defaultOptions) {
    super(name, schema, options)
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const c = this
    // Hacky function that gives us a nice ux for creating entities.
    const self = function Doc(instance: T) {
      if (!instance._id) instance._id = ulid()
      if (!c.validator(instance) && c.validator.errors) {
        throw new ValidationError(c.validator.errors)
      }
      return new Document(c, instance) as Document<T> & T
    }
    Object.setPrototypeOf(self, this.constructor.prototype)
    Object.getOwnPropertyNames(this).forEach(p => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      Object.defineProperty(self, p, Object.getOwnPropertyDescriptor(this, p)!)
    })
    return self as Collection<T>
  }

  /**
   * Save (multiple) entities.
   * @note Save is similar to insert, except it allows saving/overwriting existing entities.
   * @param entities A variadic array of entities.
   */
  save(...entities: T[]) {
    const batch = this.child.batch()
    for (const instance of entities) {
      if (!instance._id) instance._id = ulid()
      if (!this.validator(instance) && this.validator.errors) {
        throw new ValidationError(this.validator.errors)
      }
      batch.put(new Key(instance._id), instance)
    }
    return batch.commit()
  }

  /**
   * Remove entities by id.
   * @param ids
   */
  delete(...ids: string[]) {
    const batch = this.child.batch()
    for (const id of ids) {
      batch.delete(new Key(id))
    }
    return batch.commit()
  }

  /**
   * Insert (multiple) new instances.
   * @note Insert is similar to save, except it will not allow saving/overwriting existing entities.
   * @param instances
   */
  async insert(...instances: T[]) {
    // By convention we'll use insert here, but could use a specific key instead
    const lockKey = new Key('insert')
    await this.child.readLock(lockKey)
    try {
      const batch = this.child.batch()
      for (const instance of instances) {
        if (!instance._id) instance._id = ulid()
        const key = new Key(instance._id)
        if (await this.child.has(key)) {
          throw existingKeyError
        }
        if (!this.validator(instance) && this.validator.errors) {
          throw new ValidationError(this.validator.errors)
        }
        batch.put(key, instance)
      }
      return await batch.commit()
    } finally {
      this.child.unlock(lockKey)
    }
  }

  /**
   * Lock the collection for readonly operations.
   * @param cb A callback that takes a readonly collection.
   * @param timeout How long to wait to obtain the read lock. If after timeout seconds the lock
   * is not obtained, the method will error.
   * @note Currenrly, transactions are not atomic, or even really transactions in the normal sense.
   * They only provide locking for multi-read/single-write access to the given collection.
   */
  async readTransaction(cb: (c: ReadonlyCollection<T>) => Promise<void> | void, timeout?: number) {
    const lockKey = new Key('transaction')
    await this.child.readLock(lockKey, timeout)
    try {
      return await cb(ReadonlyCollection.fromCollection(this))
    } finally {
      this.child.unlock(lockKey)
    }
  }

  /**
   * Lock the collection for exclusive write operations.
   * @param cb A callback that takes a collection.
   * @param timeout How long to wait to obtain the write lock. If after timeout seconds the lock
   * is not obtained, the method will error.
   * @note Currenrly, transactions are not atomic, or even really transactions in the normal sense.
   * They only provide locking for multi-read/single-write access to the given collection.
   */
  async writeTransaction(cb: (c: Collection<T>) => Promise<void> | void, timeout?: number) {
    const lockKey = new Key('transaction')
    await this.child.writeLock(lockKey, timeout)
    try {
      return await cb(this)
    } finally {
      this.child.unlock(lockKey)
    }
  }
}
