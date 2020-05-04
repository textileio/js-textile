import { Datastore, Key, Batch, Query, utils, Result } from 'interface-datastore'
import cbor from 'cbor-sync'

export interface Encoder<T = Buffer, O = Buffer> {
  encode(data: T): O
  decode(stored: O): T
}

// 258 is the CBOR semantic tag number for a mathematical finite set:
// https://www.iana.org/assignments/cbor-tags/cbor-tags.xhtml
cbor.addSemanticEncode(258, function (data) {
  if (data instanceof Set) {
    return Array.from(data)
  }
})
cbor.addSemanticDecode(258, function (data) {
  return new Set(data)
})

// 259 is the CBOR semantic tag number for a Map datatype with key-value operations
cbor.addSemanticEncode(259, function (data) {
  if (data instanceof Map) {
    return Array.from(data)
  }
})
cbor.addSemanticDecode(259, function (data) {
  return new Map(data)
})

export const CborEncoder: Encoder<any, Buffer> = {
  encode: (data: any) => cbor.encode(data),
  decode: (stored: Buffer) => cbor.decode(stored),
}

function isString(x: any) {
  return typeof x === 'string'
}

function isObject(x: any) {
  return typeof x === 'object' && x !== null
}

function isBufferLike(x: any) {
  return isObject(x) && x.type === 'Buffer' && (Array.isArray(x.data) || isString(x.data))
}

function reviver(_key: string, value: any) {
  if (isBufferLike(value)) {
    if (Array.isArray(value.data)) {
      return Buffer.from(value.data)
    } else if (isString(value.data)) {
      // Assume that the string is UTF-8 encoded (or empty).
      return Buffer.from(value.data)
    }
  }
  return value
}

export const JsonEncoder: Encoder<any, Buffer> = {
  encode: (data: any) => Buffer.from(JSON.stringify(data)),
  decode: (stored: Buffer) => JSON.parse(stored.toString(), reviver),
}

/**
 * A datastore shim, that wraps around a given datastore, adding support for custom encoding/decoding of values.
 */
export class EncodingDatastore<T = Buffer, O = Buffer> implements Datastore<T> {
  /**
   * ValueTransformDatastore creates a new datastore that supports custom encoding/decoding of values.
   *
   * @param child The underlying datastore to wrap.
   * @param encoder A transform object to use for encoding/decoding.
   */
  constructor(public child: Datastore<O>, public encoder: Encoder<T, O>) {}

  /**
   * Open the underlying datastore.
   */
  open() {
    return this.child.open()
  }

  /**
   * Stores a value under the given key.
   * @param key The key.
   * @param value The value.
   */
  put(key: Key, value: T) {
    return this.child.put(key, this.encoder.encode(value))
  }

  /**
   * Deletes the value under the given key.
   * @param key The key.
   */
  delete(key: Key) {
    return this.child.delete(key)
  }

  /**
   * Gets the value under the given key.
   * @throws if the given key is not found.
   * @param key The key.
   */
  async get(key: Key) {
    return this.encoder.decode(await this.child.get(key))
  }

  /**
   * Returns whether the given key is in the store.
   * @param key The key.
   */
  has(key: Key) {
    return this.child.has(key)
  }

  /**
   * Returns a Batch object with which you can chain multiple operations.
   * The operations are only executed upon calling `commit`.
   */
  batch() {
    const b: Batch<O> = this.child.batch()
    const batch: Batch<T> = {
      /**
       * Stores a value under the given key.
       * @param key The key.
       * @param value The value.
       */
      put: (key: Key, value: T) => {
        b.put(key, this.encoder.encode(value))
      },
      /**
       * Deletes the value under the given key.
       * @param key The key.
       */
      delete: (key: Key) => {
        b.delete(key)
      },
      /**
       * Executes the accumulated operations.
       */
      commit: () => {
        return b.commit()
      },
    }
    return batch
  }

  /**
   * Search the store.
   * Returns an Iterable with each item being a Value (i.e., { key, value } pair).
   * @param query The query object.
   */
  query(query: Query<T>): AsyncIterable<Result<T>> {
    // @todo: Wrap all filters and orders in a decode call?
    const { keysOnly, prefix, ...rest } = query
    const raw = this.child.query({ keysOnly, prefix })
    let it = utils.map(raw, ({ key, value }) => {
      const val = (keysOnly ? undefined : this.encoder.decode(value)) as T
      const result: Result<T> = { key, value: val }
      return result
    })
    if (Array.isArray(rest.filters)) {
      it = rest.filters.reduce((it, f) => utils.filter(it, f), it)
    }
    if (Array.isArray(rest.orders)) {
      it = rest.orders.reduce((it, f) => utils.sortAll(it, f), it)
    }
    if (rest.offset) {
      let i = 0
      it = utils.filter(it, () => i++ >= (rest.offset || 0))
    }
    if (rest.limit) {
      it = utils.take(it, rest.limit)
    }
    return it
  }

  /**
   * Close the underlying datastore.
   */
  close() {
    return this.child.close()
  }
}
