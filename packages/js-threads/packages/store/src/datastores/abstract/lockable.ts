import { RWLock, State } from 'async-rwlock'
import { Key } from 'interface-datastore'

/**
 * A key-based RWLock Semaphore.
 */
export class Semaphore {
  constructor(private prefix: Key = new Key('')) {}
  /**
   * Map of RW locks.
   */
  private locks: Map<string, RWLock> = new Map()

  /**
   * Get the lock for a given key
   * Returns a new lock if `key` is not yet in the map.
   * @param key
   */
  get(key: Key) {
    const k = this.prefix.child(key).toString()
    let lock = this.locks.get(k)
    if (!lock) {
      lock = new RWLock()
      this.locks.set(k, lock)
    }
    return lock
  }

  /**
   * Unlock the lock for a given key.
   * If there are no other holds on the lock, it is deleted from the map.
   * @param key
   */
  unlock(key: Key) {
    const k = this.prefix.child(key).toString()
    const lock = this.locks.get(k)
    if (lock !== undefined) {
      lock.unlock()
      // No other holds on this lock, delete it
      if (lock.getState() === State.Idle) {
        this.locks.delete(k)
      }
    }
    return
  }
}

export class Lockable {
  readonly semaphore: Semaphore

  constructor(prefix?: Key) {
    this.semaphore = new Semaphore(prefix)
  }

  /**
   * Acquire a read lock on a given key.
   * The datastore is only allowed to acquire a lock for keys it 'owns' (any decedents of its prefix key).
   * @param key The key to lock for reading.
   * @param timeout How long to wait to acquire the lock before rejecting the promise, in milliseconds.
   * If timeout is not in range 0 <= timeout < Infinity, it will wait indefinitely.
   */
  readLock(key: Key, timeout?: number) {
    return this.semaphore.get(key).readLock(timeout)
  }

  /**
   * Acquire a write lock on a given key.
   * The datastore is only allowed to acquire a lock for keys it 'owns' (any decedents of its prefix key).
   * @param key The key to lock for writing.
   * @param timeout How long to wait to acquire the lock before rejecting the promise, in milliseconds.
   * If timeout is not in range 0 <= timeout < Infinity, it will wait indefinitely.
   */
  writeLock(key: Key, timeout?: number) {
    return this.semaphore.get(key).writeLock(timeout)
  }

  /**
   * Release current lock.
   * Must be called after an operation using a read/write lock is finished.
   * @param key The key to unlock.
   */
  unlock(key: Key) {
    return this.semaphore.unlock(key)
  }
}
