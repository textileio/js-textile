import { Datastore, Key, MemoryDatastore } from 'interface-datastore'
import { Dispatcher } from '../dispatcher'
import { BasicCodec } from '../codec'
import { Store } from './store'

export class BasicStore<T = any> extends Store<T> {
  constructor(
    child: Datastore<any> = new MemoryDatastore(),
    prefix?: Key,
    dispatcher?: Dispatcher,
  ) {
    super(child, new BasicCodec<T>(), prefix, dispatcher)
  }
}
