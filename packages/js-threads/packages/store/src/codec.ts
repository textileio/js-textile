import { Key, Datastore, Result } from 'interface-datastore'
import { Event } from './dispatcher'

/**
 * Codec interface describes the methods/function required to implement a custom store.
 */
export interface Codec<D = any, A = D> {
  /**
   * onDelete runs once a given key has been deleted.
   * @param store A reference to the corresponding datastore used for storage. Can be used to create a batch instance.
   * @param key The target datastore key to delete.
   */
  onDelete: (store: Datastore<D>, key: Key) => Promise<A | undefined>
  /**
   * onPut runs once a given key has been updated/inserted.
   * @param store A reference to the corresponding datastore used for storage. Can be used to create a batch instance.
   * @param key The target datastore key to update.
   * @param value The new input value/data.
   */
  onPut: (store: Datastore<D>, key: Key, value: D) => Promise<A>

  /**
   * onReduce runs once a given set of Events have been dispatched via a Dispatcher.
   * @param store A reference to the corresponding datastore used for storage. Can be used to create a batch instance.
   * @param events The set of incoming store Events.
   */
  onReduce(store: Datastore<D>, ...events: Result<Event<A>>[]): Promise<void>
}

/**
 * BasicCodec is a simple codec that overwrites any existing data.
 * It is equivalent to a basic key-value store.
 */
export class BasicCodec<T = any> implements Codec<T> {
  /**
   * onDelete always deletes the given key from the store.
   */
  async onDelete(_store: Datastore<T>, _key: Key) {
    return undefined
  }

  /**
   * onPut always overwrites the existing data (simply passes through the input data)
   * @param _store Ignored
   * @param _key Ignored
   * @param value The data to add/replace any existing data.
   */
  async onPut(_store: Datastore<T>, _key: Key, value: T) {
    return value
  }

  /**
   * onReduce simple puts or deletes Event data.
   * @param store A reference to the corresponding datastore used for storage.
   * @param events The set of incoming store Events.
   */
  async onReduce(store: Datastore<T>, ...events: Result<Event<T>>[]) {
    const batch = store.batch()
    for (const { value } of events) {
      const newKey = new Key(value.id)
      if (value.patch === undefined) {
        batch.delete(newKey)
      } else {
        batch.put(newKey, value.patch)
      }
    }
    return batch.commit()
  }
}
