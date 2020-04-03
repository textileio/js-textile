import { Datastore, Key, MemoryDatastore } from 'interface-datastore'
import { Dispatcher } from '../dispatcher'
import { BasicCodec } from '../codec'
import { Store } from './store'

/**
 * BasicStore is the default Store implementation. It uses the BasicCodec to manage updates.
 */
export class BasicStore<T = any> extends Store<T> {
  constructor(
    child: Datastore<any> = new MemoryDatastore(),
    prefix?: Key,
    dispatcher?: Dispatcher,
  ) {
    super(child, new BasicCodec<T>(), prefix, dispatcher)
  }
}
