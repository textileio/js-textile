import type { Batch, Datastore, Key, Query, Result } from "interface-datastore"

/**
 * A datastore shim that wraps around a given datastore. Useful for sub0classing.
 */
export class ShimDatastore<T = Buffer> implements Datastore<T> {
  /**
   * ShimDatastore creates a new datastore that wraps a child datastore.
   *
   * @param child The underlying datastore to wrap.

   */
  constructor(public child: Datastore<T>) {}

  open(): Promise<void> {
    return this.child.open()
  }

  put(key: Key, val: T): Promise<void> {
    return this.child.put(key, val)
  }

  async get(key: Key): Promise<T> {
    return this.child.get(key)
  }

  has(key: Key): Promise<boolean> {
    return this.child.has(key)
  }

  delete(key: Key): Promise<void> {
    return this.child.delete(key)
  }

  batch(): Batch<T> {
    return this.child.batch()
  }

  query(q: Query<T>): AsyncIterable<Result<T>> {
    return this.child.query(q)
  }

  close(): Promise<void> {
    return this.child.close()
  }
}
