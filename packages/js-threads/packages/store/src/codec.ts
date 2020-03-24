import { Key, Datastore, Result } from 'interface-datastore'
import { Event } from './dispatcher'

/**
 * Codec interface describes the methods/function required to implement a custom store.
 */
export interface Codec<D = any, A = D> {
  onDelete: (store: Datastore<D>, key: Key) => Promise<A | undefined>
  onPut: (store: Datastore<D>, key: Key, value: D) => Promise<A>
  onReduce(store: Datastore<D>, ...events: Result<Event<A>>[]): Promise<void>
}

export class BasicCodec<T = any> implements Codec<T> {
  async onDelete(_store: Datastore<T>, _key: Key) {
    return undefined
  }
  async onPut(_store: Datastore<T>, _key: Key, value: T) {
    return value
  }
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
