import { expect } from 'chai'
import { MemoryDatastore, Datastore, Key } from 'interface-datastore'
import LevelDatastore from 'datastore-level'
import { isBrowser } from 'browser-or-node'
import sinon from 'sinon'
import { Queue } from './queue'

const level = require('level')

describe('Queue', () => {
  describe('Constructor', () => {
    it('should use memory store by default', async () => {
      const q = new Queue()
      expect(await q.open()).to.be.empty
    })

    it('should throw when passed a batchSize less than 1', () => {
      expect(() => {
        new Queue(new MemoryDatastore(), -1)
      }).to.throw(Error)
    })
  })

  describe('Correct queue fifo order', () => {
    let q: Queue
    before(() => {
      // Remove previous db3.sqlite (if exists) before creating db anew
      q = new Queue()
    })

    it('should execute jobs in fifo order', done => {
      let sequence = 0
      q.on('next', task => {
        expect(task.job.sequence).to.equal(sequence++)
        q.done()
      })

      q.on('empty', () => {
        q.close()
        done()
      })

      q.open().then(() => {
        q.start()

        for (let i = 0; i < 1000; ++i) {
          const task = { sequence: i }
          q.push(task)
        }
      })
    })
  })

  describe('Search remaining jobs', function() {
    let q: Queue
    beforeEach(done => {
      q = new Queue()
      q.open()
        .then(() => done())
        .catch(err => done(err))
    })

    it('should find first job in the queue', done => {
      q.open().then(() => {
        const promises = []
        for (let i = 1; i <= 1000; ++i) {
          const task = { sequence: i % 501 }
          promises.push(q.push(task, `${i}`))
        }

        // Wait for all tasks to be pushed before calling hasJob method to search for it
        Promise.all(promises).then(() => {
          for (let i = 1; i <= 500; ++i)
            q.getFirstJobId({ sequence: i }).then(id => {
              expect(id).to.equal(`${i}`)
            })

          q.close().then(() => done())
        })
      })
    })

    it('should find all matching jobs in the queue and in order', done => {
      q.open().then(() => {
        const promises = []
        for (let i = 1; i <= 10; ++i) {
          const task = { sequence: i % 5 }
          promises.push(q.push(task, `${i}`))
        }

        // Wait for all tasks to be pushed before calling hasJob method to search for it
        Promise.all(promises).then(() => {
          for (let i = 1; i <= 5; ++i)
            q.getJobIds({ sequence: i % 5 }).then(id => {
              expect(id).to.deep.equal([`${i}`, `${i + 5}`])
            })

          q.close().then(() => {
            done()
          })
        })
      })
    })

    it('should return empty array if job not in queue', done => {
      q.open().then(() => {
        const promises = []
        for (let i = 1; i <= 10; ++i) {
          const task = { sequence: i }
          promises.push(q.push(task))
        }

        // Wait for all tasks to be pushed before calling hasJob method to search for it
        Promise.all(promises).then(() => {
          for (let i = 1; i <= 5; ++i)
            q.getJobIds({ sequence: 100 }).then(id => {
              expect(id).to.be.empty
            })

          q.close().then(() => {
            done()
          })
        })
      })
    })

    it('should return undefined if job not in queue', done => {
      q.open().then(() => {
        const promises = []
        for (let i = 1; i <= 10; ++i) {
          const task = { sequence: i }
          promises.push(q.push(task))
        }

        // Wait for all tasks to be pushed before calling hasJob method to search for it
        Promise.all(promises).then(() => {
          for (let i = 1; i <= 5; ++i)
            q.getFirstJobId({ sequence: 100 }).then(id => {
              expect(id).to.be.undefined
            })

          q.close().then(() => {
            done()
          })
        })
      })
    })
  })

  describe('Unopened DB', () => {
    const q = new Queue(new MemoryDatastore(), 2)

    it('should throw on calling start() before open is called', () => {
      expect(() => {
        q.start()
      }).to.throw(Error)
    })

    it('should throw on calling isEmpty() before open is called', () => {
      expect(() => {
        return q.isEmpty
      }).to.throw(Error)
    })
  })

  describe('Maintaining queue length count', () => {
    let store: Datastore
    const tmp = 'test.db'

    before(done => {
      store = new MemoryDatastore()
      store.open().then(() => {
        store.put(new Key('one'), Buffer.from('0')).then(() => {
          done()
        })
      })
    })

    after(() => {
      level.destroy(tmp, () => {
        return
      })
    })

    it('should count existing jobs in db on open', function(done) {
      if (isBrowser) return this.skip()
      const q = new Queue(store)
      q.open()
        .then(() => {
          expect(q.length).to.equal(1)
          return q.close()
        })
        .then(() => {
          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it('should count jobs as pushed and completed', function(done) {
      if (isBrowser) return this.skip()
      let q = new Queue(new LevelDatastore(tmp))

      // Count jobs
      let c = 0

      q.on('push', () => {
        expect(q.length).to.equal(++c)
      })

      q.open()
        .then(() => {
          q.push('1')
          q.push('2')
          q.push('3')

          return q.close()
        })
        .then(() => {
          q = new Queue(new LevelDatastore(tmp))

          return q.open()
        })
        .then(() => {
          expect(q.length).to.equal(3)

          q.on('next', () => {
            expect(q.length).to.equal(c--)
            q.done()
          })

          q.on('empty', () => {
            expect(q.length).to.equal(0)
            q.close().then(() => {
              q.store.close()
              done()
            })
          })

          q.start()
        })
        .catch(err => {
          done(err)
        })
    })
  })

  describe('Close Errors', () => {
    const q = new Queue()

    before(done => {
      q.open().then(() => {
        done()
      })
    })

    it('should close properly', async () => {
      q.push('1')
      expect(await q.close()).to.be.undefined
    })
  })

  describe('Emitters', () => {
    let q: Queue

    beforeEach(done => {
      q = new Queue()
      q.open()
        .then(() => {
          done()
        })
        .catch(err => {
          done(err)
        })
    })

    afterEach(done => {
      q.close()
        .then(() => {
          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it('should emit push', done => {
      q.on('push', job => {
        expect(job.job).to.equal('1')
        done()
      })

      q.push('1')
    })

    it('should emit start', done => {
      const s = sinon.spy()

      q.on('start', s)

      q.start()

      expect(s.callCount).to.equal(1)
      expect(q.isStarted).to.be.equal(true)
      done()
    })

    it('should emit next when pushing after start', done => {
      q.on('next', job => {
        expect(job.job).to.equal('1')
        q.done()
        done()
      })

      q.start()
      q.push('1')
    })

    it('should emit next when pushing before start', done => {
      q.on('next', job => {
        expect(job.job).to.equal('1')
        q.done()
        done()
      })

      q.push('1')
      q.start()
    })

    it('should emit empty', done => {
      let empty = 0
      q.on('empty', () => {
        // empty should only emit once
        expect(++empty).to.equal(1)
        expect(q.length).to.equal(0)
        done()
      })

      q.on('next', _job => {
        q.done()
      })
      q.push('1')
      q.push('2')
      q.start()
    })

    it('3 pushs before start should emit 3 nexts', done => {
      let next = 0
      q.on('empty', () => {
        expect(next).to.equal(3)
        expect(q.length).to.equal(0)
        done()
      })

      q.on('next', _job => {
        ++next
        q.done()
      })
      q.push('1')
      q.push('2')
      q.push('3')
      q.start()
    })

    it('should push 3 jobs and after start should emit 3 nexts', done => {
      let next = 0
      q.on('empty', () => {
        expect(next).to.equal(3)
        expect(q.length).to.equal(0)
        done()
      })

      q.on('next', job => {
        ++next
        q.done()
      })
      q.start()
      q.push('1')
      q.push('2')
      q.push('3')
    })

    it('should start in middle of 3 pushs and should emit 3 nexts', done => {
      let next = 0
      q.on('empty', () => {
        expect(next).to.equal(3)
        expect(q.length).to.equal(0)
        done()
      })

      q.on('next', job => {
        ++next
        q.done()
      })
      q.push('1')
      q.push('2')
      q.start()
      q.push('3')
    })

    it('should emit stop', done => {
      let stop = 0
      q.on('stop', () => {
        expect(++stop).to.equal(1)
        expect(q.isStarted).to.be.false
        done()
      })

      q.on('empty', () => {
        q.stop()
      })

      q.on('next', job => {
        q.done()
      })
      q.push('1')
      q.push('2')
      q.start()
      q.push('3')
      q.push('4')
    })

    it('should emit open', done => {
      const q1 = new Queue()
      let open = 0
      q1.on('open', () => {
        expect(++open).to.equal(1)
        expect(q1.isOpen).to.be.equal(true)
        q1.close().then(() => {
          done()
        })
      })
      q1.open()
    })

    it('should emit close', done => {
      const q1 = new Queue()
      let close = 0
      q1.on('close', () => {
        expect(++close).to.equal(1)
        expect(q1.isOpen).to.be.false
      })
      q1.open()
        .then(() => {
          return q1.close()
        })
        .then(() => {
          done()
        })
    })
  })
})
