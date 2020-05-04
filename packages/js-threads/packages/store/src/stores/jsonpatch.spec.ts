import { expect } from 'chai'
import { MemoryDatastore, Key } from 'interface-datastore'
import { collect } from 'streaming-iterables'
import { ulid } from 'ulid'
import { Dispatcher } from '../dispatcher'
import { JsonPatchStore } from './jsonpatch'

describe('JsonPatchStore', () => {
  describe('interface-datastore', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('interface-datastore/src/tests')({
      setup() {
        return new JsonPatchStore(new MemoryDatastore(), new Key('test'), new Dispatcher())
      },
      teardown() {
        return
      },
    })
  })

  it('basic', (done) => {
    const mStore = new MemoryDatastore()
    const store = new JsonPatchStore(mStore, new Key('test'), new Dispatcher())

    let count = 0
    store.on('events', () => count++)
    store.on('update', () => {
      expect(++count).to.equal(2)
      store.close().then(() => {
        done()
      })
    })

    store.put(new Key('bar'), { _id: ulid(), hello: 'world' }).then(() => {
      collect(mStore.query({})).then((mRes) => {
        collect(store.query({})).then((nRes) => {
          expect(nRes).to.have.length(1)
          expect(mRes).to.have.length(1)
        })
      })
    })
  })
})
