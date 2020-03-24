import { expect } from 'chai'
import { MemoryDatastore, Key, Result } from 'interface-datastore'
import { collect } from 'streaming-iterables'
import { Dispatcher } from './dispatcher'

interface TestEvent {
  timestamp: Buffer
  id: string
  collection: string
}

describe('Dispatcher', () => {
  it('should not require any arguments to initialize', async () => {
    const d = new Dispatcher()
    const value: TestEvent = {
      timestamp: Buffer.from('' + Date.now()),
      id: 'null',
      collection: 'null',
    }
    await d.dispatch({ key: new Key('key'), value })
  })

  it('should add new (unique) reducers on registration', async () => {
    const d = new Dispatcher()
    const reducer = { reduce: (..._event: Result<TestEvent>[]) => Promise.resolve(undefined) }
    d.register(reducer)
    expect(d.reducers).to.have.length(1)
    d.register(reducer)
    expect(d.reducers).to.have.length(1)
  })

  it('should only dispatch one (set of) events at a time', async () => {
    const d = new Dispatcher()
    const slowReducer = (..._event: Result<TestEvent>[]) =>
      new Promise<void>(r => setTimeout(r, 2000))
    d.register({ reduce: slowReducer })
    const value: TestEvent = {
      timestamp: Buffer.from('' + Date.now()),
      id: 'null',
      collection: 'null',
    }
    const t1 = Date.now()
    // Don't await...
    d.dispatch({ key: new Key('one'), value }).then(() => console.log('done'))
    await d.dispatch({ key: new Key('two'), value })
    const t2 = Date.now()
    expect(t2 - t1 + 100).to.be.greaterThan(4000) // Adjust up to catch approx. timings
  }).timeout(5000)

  it('should persist events to the internal store when present', async () => {
    const d = new Dispatcher(new MemoryDatastore())
    const value: TestEvent = {
      timestamp: Buffer.from('' + Date.now()),
      id: 'null',
      collection: 'null',
    }
    await d.dispatch({ key: new Key('one'), value })
    await d.dispatch({ key: new Key('two'), value })
    expect(d.child).to.not.be.undefined
    expect(await collect(d.child?.query({}) || [])).to.have.lengthOf(2)
  }).timeout(5000)

  it('should throw on first error', async () => {
    const d = new Dispatcher()
    const value: TestEvent = {
      timestamp: Buffer.from('' + Date.now()),
      id: 'null',
      collection: 'null',
    }
    await d.dispatch()
    // Error reducer
    const error = new Error('error')
    const reducer = {
      reduce: (..._event: Result<TestEvent>[]) => Promise.reject(new Error('error')),
    }
    d.register(reducer)
    try {
      await d.dispatch({ key: new Key('one'), value })
      throw new Error('should have thrown error on dispatch call')
    } catch (err) {
      expect(err.toString()).to.equal(error.toString())
    }
  })
})
