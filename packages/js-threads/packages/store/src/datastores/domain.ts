import { Datastore, Key, Query, Batch } from 'interface-datastore'
import { KeytransformDatastore, Transform } from 'datastore-core'

interface PrefixDatastore<Value = Buffer> extends Datastore<Value> {
  prefix?: Key
  child?: Datastore<Value>
}

/**
 * Function to reach back up the parent tree.
 * @param child
 * @param prefix
 */
const reachBack = <T = Buffer>(child: PrefixDatastore<T>, prefix: Key = new Key('')): Key => {
  if (child.child) return reachBack(child.child, child.prefix?.child(prefix) || prefix)
  return prefix
}

/**
 * Scopes a given datastore to a sub-domain under the supplied domain prefix.
 *
 * For example, if the prefix is `new Key('hello')` a call to `store.put(new Key('world'), value)` would store the
 * data under `/hello/world`, but to any callers, the given prefix is transparent. This is similar to the
 * NamespaceDatastore from datastore-core, however, domains also work for deeply nested datastores, and will
 * 'reach up' to the top-most datastore in order to derive the full domain prefix. An additional constraint on domains
 * is that a datastore is only able to modify direct decedents of the domain prefix. For example, a call to
 * `store.put(new Key('world'), value)` is valid, but `store.put(new Key('world/part'), value)` will throw. Read
 * operations are not constrained in this way, though for consistency, should probably be avoided.
 * @note An alternative to the direct decedent approach is to reach up and have a single semaphore for all nested
 * datastores, similar to what we've done with the prefix.
 *
 */
export class DomainDatastore<T = Buffer> extends KeytransformDatastore<T> {
  public child: Datastore<T>
  public prefix: Key
  /**
   * Create a new domain-scoped datastore.
   * @param child The child datastore to wrap/shim.
   * @param domain The (sub-) domain to use as a prefix.
   */
  constructor(child: Datastore<T>, domain: Key = new Key('')) {
    const prefix = reachBack(child, domain)
    const transform: Transform = {
      convert(key) {
        return prefix.child(key)
      },
      invert(key) {
        if (prefix.toString() === '/') {
          return key
        }

        if (!prefix.isAncestorOf(key)) {
          throw new Error(`Expected prefix: (${prefix.toString()}) in key: ${key.toString()}`)
        }

        return new Key(key.toString().slice(prefix.toString().length), false)
      },
    }
    super(child, transform)
    this.child = child
    this.prefix = prefix
  }

  /**
   * Search the store.
   * Returns an Iterable with each item being a Value (i.e., { key, value } pair).
   * @param query The query object. If it contains a prefix, it is appended to the base domain prefix.
   */
  query(query: Query<T>) {
    // All queries should be prefixed with the base domain prefix
    const prefix = query.prefix
      ? this.prefix.child(new Key(query.prefix)).toString()
      : this.prefix.toString()
    return super.query({ ...query, prefix })
  }

  /**
   * Stores a value under the given key.
   * @throws If a lower-level key is used (i.e., one with nested namespaces).
   * @param key The key.
   * @param value The value.
   */
  put(key: Key, value: T) {
    return super.put(key, value)
  }

  /**
   * Deletes the value under the given key.
   * @throws If a lower-level key is used (i.e., one with nested namespaces).
   * @param key The key.
   */
  delete(key: Key) {
    return super.delete(key)
  }

  /**
   * Returns a Batch object with which you can chain multiple operations.
   * The operations are only executed upon calling `commit`.
   * @throws If a lower-level key is used (i.e., one with nested namespaces) in any operations.
   */
  batch() {
    const b: Batch<T> = super.batch()
    const batch: Batch<T> = {
      /**
       * Stores a value under the given key.
       * @throws If a lower-level key is used (i.e., one with nested namespaces).
       * @param key The key.
       * @param value The value.
       */
      put: (key: Key, value: T) => {
        b.put(key, value)
      },
      /**
       * Deletes the value under the given key.
       * @throws If a lower-level key is used (i.e., one with nested namespaces).
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
}
