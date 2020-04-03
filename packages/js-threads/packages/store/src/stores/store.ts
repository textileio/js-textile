import { Datastore, Key, Result, Batch, Query } from 'interface-datastore'
import lexInt from 'lexicographic-integer'
import { EventEmitter } from 'tsee'
import { Reducer, Dispatcher, Event } from '../dispatcher'
import {
  Lockable,
  DomainDatastore,
  Semaphore,
  EncodingDatastore,
  Encoder,
  CborEncoder,
} from '../datastores'
// eslint-disable-next-line import/no-cycle
import { Codec } from '../codec'

/**
 * Events for Store's EventEmitter
 */
type Events<T> = {
  open: () => void
  close: () => void
  events: (...events: Event<T>[]) => void
  update: (...updates: Update<T>[]) => void
  error: (err: Error) => void
}

/**
 * Action is a deferred store operation.
 */
export type Action<T> = () => Promise<T>

/**
 * Update is a store update notification.
 */
export interface Update<T = any> {
  id: string
  collection: string
  type?: string | number
  event?: T
}

const asUpdate = <T = any>(event: Result<Event<T>>): Update<T> => {
  const { value } = event
  return {
    id: value.id,
    collection: value.collection,
    event: value.patch,
    // todo: This is a bit of a hack, find a nicer way to do type
    type: value.patch ? (value.patch as any).type : undefined,
  }
}

/**
 * safeGet calls get on the input store but returns undefined on not found errors rather than throwing.
 * @param store The store to query.
 * @param key The key to get.
 */
export const safeGet = async <T = any>(store: Datastore<T>, key: Key) => {
  try {
    return await store.get(key)
  } catch (err) {
    if (err.code !== 'ERR_NOT_FOUND') {
      throw err
    }
  }
}

/**
 * ActionBatch is a Batch implementation that creates deferred actions (promises).
 * Actions created within this batch are submitted for dispatch, rather than being applied directly to the store.
 */
export class ActionBatch<D = any, A = D> implements Batch<D> {
  private patches: Action<Event<A>>[] = []
  constructor(private store: Store<D, A>) {}

  /**
   * Promises to delete the value under the given key.
   * @param key The key.
   */
  delete(key: Key) {
    const deferred = async () => {
      const event: Event = {
        timestamp: Buffer.from(lexInt.pack(Date.now())),
        id: key.toString().slice(1),
        collection: this.store.prefix.toString().slice(1),
        patch: await this.store.codec.onDelete(this.store, key),
      }
      return event
    }
    this.patches.push(deferred)
  }

  /**
   * Promises to store a value under the given key.
   * @param key The key.
   * @param value The value.
   */
  put(key: Key, value: D) {
    const deferred = async () => {
      const event: Event = {
        timestamp: Buffer.from(lexInt.pack(Date.now())),
        id: key.toString().slice(1),
        collection: this.store.prefix.toString().slice(1),
        patch: await this.store.codec.onPut(this.store, key, value),
      }
      return event
    }
    this.patches.push(deferred)
  }

  /**
   * Dispatches the accumulated actions.
   */
  async commit() {
    if (this.patches.length > 0) {
      await this.store.dispatch(...this.patches)
    }
    this.patches.length = 0
    return
  }
}

/**
 * Store is a generic wrapper around a Datastore that supports locking and Event-Sourced semantics.
 * A store is defined by a Codec and a Reducer. This is very similar to how something like Flux/Redux works, with a
 * 'central' dispatcher and various Stores that fold new data into their existing structure. This is also very much
 * in line with Event Sourced/CQRS design patterns. A Store may wrap its own Dispatcher, or use a simple in-memory
 * dispatcher.
 */
export class Store<D = any, A = D> extends EventEmitter<Events<A>>
  implements Lockable, Datastore<D>, Reducer<Event<A>> {
  public child: Datastore<D>
  readonly semaphore: Semaphore
  constructor(
    child: Datastore<any>,
    public codec: Codec<D, A>,
    public prefix: Key = new Key(''),
    public dispatcher: Dispatcher = new Dispatcher(child),
    public encoder: Encoder<D> = CborEncoder,
  ) {
    super()
    this.child = new DomainDatastore(new EncodingDatastore(child, this.encoder), this.prefix)
    this.semaphore = new Semaphore(this.prefix)
    this.dispatcher.register(this)
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

  /**
   * Generic dispatcher method. This is called by an ActionBatch to dispatch actions to the Store's Dispatcher.
   * This method will emit the set of Events (after dispatch is complete) so that listeners may take action.
   * @param actions The set of deferred actions to dispatch.
   */
  async dispatch(...actions: Action<Event<A>>[]) {
    if (this.dispatcher === undefined) return
    const events = await Promise.all(
      actions.map(async event => {
        const value = await event()
        const key = this.prefix.child(new Key(value.id))
        return { key, value }
      }),
    )
    this.emit('events', ...events.map(event => event.value))
    return this.dispatcher.dispatch(...events)
  }

  /**
   * Open the underlying datastore.
   */
  open() {
    return this.child.open()
  }

  close() {
    return this.child.close()
  }

  /**
   * Returns whether the given key is in the store.
   * @param key The key.
   */
  has(key: Key) {
    return this.child.has(key)
  }

  /**
   * Gets the value under the given key.
   * @throws if the given key is not found.
   * @param key The key.
   */
  get(key: Key) {
    return this.child.get(key)
  }

  /**
   * Stores a value under the given key.
   * This operation happens within an ActionBatch.
   * @param key The key.
   * @param value The value.
   */
  put(key: Key, value: D) {
    const batch = this.batch()
    batch.put(key, value)
    return batch.commit()
  }

  /**
   * Deletes the value under the given key.
   * @param key The key.
   */
  delete(key: Key) {
    const batch = this.batch()
    batch.delete(key)
    return batch.commit()
  }

  /**
   * Search the store.
   * Returns an Iterable with each item being a Value (i.e., { key, value } pair).
   * @param query The query object.
   */
  query(query: Query<D>) {
    return this.child.query(query)
  }

  /**
   * Returns nan ActionBatch object with which you can chain multiple operations.
   * The operations are only dispatched upon calling `commit`.
   */
  batch(): ActionBatch<D, A> {
    return new ActionBatch(this)
  }

  /**
   * Generic reducer method. This is called by the Store's Dispatcher on each set of new Events.
   * This method will emit the set of updates (after reduction is complete) so that listeners may take action.
   * @param events The set of incoming events to the 'folded' into the Store.
   */
  async reduce(...events: Result<Event<A>>[]) {
    const filtered = events.filter(({ key }) => key.isDecendantOf(this.prefix))
    await this.codec.onReduce(this.child, ...filtered)
    this.emit('update', ...filtered.map(asUpdate))
  }
}
