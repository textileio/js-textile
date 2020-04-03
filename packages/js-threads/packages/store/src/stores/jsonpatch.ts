import { Datastore, Result, Key, MemoryDatastore } from 'interface-datastore'
import jsonpatch, { Operation } from 'fast-json-patch'
import { Dispatcher, Event } from '../dispatcher'
import { Codec } from '../codec'
import { Store, safeGet } from './store'

/**
 * Instance is any object with an ID field.
 */
export interface Instance {
  ID: string
  [others: string]: any
}

/**
 * Op is a custom Store operation with a specific set of types.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Op {
  export enum Type {
    Create = 0,
    Save,
    Delete,
  }
}

/**
 * Op is a custom Store operation with a specific set of types.
 */
export interface Op<T extends Instance> {
  type: Op.Type
  instanceID: string
  patch?: Operation[] | T
}

/**
 * JsonPatchCodec uses JSON-Patch standard (RFC 6902) semantics to update JSON documents using delta patches.
 */
export class JsonPatchCodec<T extends Instance> implements Codec<T, Op<T>> {
  async onDelete(_store: Datastore<T>, key: Key) {
    return {
      type: Op.Type.Delete,
      instanceID: key.toString().slice(1),
      patch: undefined,
    }
  }
  async onPut(store: Datastore<T>, key: Key, value: T) {
    const instanceID = key.toString().slice(1)
    let patch: Op<T>
    const old = await safeGet(store, key)
    if (old === undefined) {
      patch = { type: Op.Type.Create, instanceID, patch: value }
    } else {
      const ops = jsonpatch.compare(old, value)
      // If no ops, old == new
      patch = { type: Op.Type.Save, instanceID, patch: ops.length > 0 ? ops : old }
    }
    return patch
  }
  async onReduce(store: Datastore<T>, ...events: Result<Event<Op<T>>>[]) {
    const batch = store.batch()
    for (const { value } of events) {
      const newKey = new Key(value.id)
      const patch = value.patch?.patch
      // If the patch or the patch itself is undefined, we delete
      if (patch === undefined) {
        batch.delete(newKey)
      } else {
        const prev = await safeGet(store, newKey)
        const merged =
          prev === undefined
            ? (patch as T)
            : jsonpatch.applyPatch(prev, patch as Operation[]).newDocument
        batch.put(newKey, merged)
      }
    }
    return batch.commit()
  }
}

/**
 * JsonPatchStore uses the JsonPatchCodec to manage updates.
 */
export class JsonPatchStore<T extends Instance> extends Store<T, Op<T>> {
  constructor(
    child: Datastore<any> = new MemoryDatastore(),
    prefix?: Key,
    dispatcher?: Dispatcher,
  ) {
    super(child, new JsonPatchCodec<T>(), prefix, dispatcher)
  }
}
