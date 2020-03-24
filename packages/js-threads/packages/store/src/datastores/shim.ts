import { Datastore, Key, Query } from 'interface-datastore'

/**
 * A datastore shim that wraps around a given datastore. Usful for sub0classing.
 */
export class ShimDatastore<T = Buffer> implements Datastore<T> {
  /**
   * ShimDatastore creates a new datastore that wraps a child datastore.
   *
   * @param child The underlying datastore to wrap.

   */
  constructor(public child: Datastore<T>) {}

  open() {
    return this.child.open()
  }

  put(key: Key, val: T) {
    return this.child.put(key, val)
  }

  async get(key: Key) {
    return this.child.get(key)
  }

  has(key: Key) {
    return this.child.has(key)
  }

  delete(key: Key) {
    return this.child.delete(key)
  }

  batch() {
    return this.child.batch()
  }

  query(q: Query<T>) {
    return this.child.query(q)
  }

  close() {
    return this.child.close()
  }
}
