import { expect } from 'chai'
import { MemoryDatastore, Key } from 'interface-datastore'
import { collect } from 'streaming-iterables'
import { DomainDatastore } from './domain'

describe('DomainDatastore', () => {
  const prefixes = ['abc', '']
  prefixes.forEach(prefix =>
    it(`basic '${prefix}'`, async () => {
      const mStore = new MemoryDatastore()
      const store = new DomainDatastore(mStore, new Key(prefix))

      const keys = [
        'foo',
        'foo/bar',
        'foo/bar/baz',
        'foo/barb',
        'foo/bar/bazb',
        'foo/bar/baz/barb',
      ].map(s => new Key(s))

      await Promise.all(keys.map(key => store.put(key, Buffer.from(key.toString()))))
      const nResults = Promise.all(keys.map(key => store.get(key)))
      const mResults = Promise.all(keys.map(key => mStore.get(new Key(prefix).child(key))))
      const results = await Promise.all([nResults, mResults])
      const mRes = await collect(mStore.query({}))
      const nRes = await collect(store.query({}))

      expect(nRes).to.have.length(mRes.length)

      mRes.forEach((a, i) => {
        const kA = a.key
        const kB = nRes[i].key
        expect(store.transform.invert(kA)).to.eql(kB)
        expect(kA).to.eql(store.transform.convert(kB))
      })
      await store.close()

      expect(results[0]).to.eql(results[1])
    }),
  )

  prefixes.forEach(prefix => {
    describe('interface-datastore', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('interface-datastore/src/tests')({
        setup() {
          return new DomainDatastore(new MemoryDatastore(), new Key(prefix))
        },
        teardown() {
          return
        },
      })
    })
  })
})
