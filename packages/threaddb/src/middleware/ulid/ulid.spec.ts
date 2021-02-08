import { expect } from 'chai'
import Dexie from 'dexie'
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
import setGlobalVars from 'indexeddbshim'
import { ulidMiddleware } from '.'
const { indexedDB, IDBKeyRange } = setGlobalVars({}, { checkOrigin: false })

const databaseName = 'ulid'

describe('ThreadDB', function () {
  context('ulid middleware', function () {
    let db: Dexie

    before(async function () {
      db = new Dexie(databaseName, {
        indexedDB,
        IDBKeyRange,
      })
      db.use(ulidMiddleware)

      db.version(1).stores({
        // Assumes auto-incrementing primary keys named _id should be ulids
        friends: '++_id,name,shoeSize,address.city',
        // But ++id (no underscore) should _not_ be a ulid
        others: '++id, name',
      })

      await db.open()
    })

    after(async function () {
      db.close()
      await db.delete()
    })

    it('should automatically create ulid ids', async function () {
      const [_id, id] = await db.transaction(
        'readwrite',
        ['friends', 'others'],
        async () => {
          const _id = await db.table<unknown, string>('friends').put({
            name: 'steve',
            shoeSize: 99,
            address: {
              city: 'nowhere',
            },
          })

          const id = await db.table<unknown, number>('others').put({
            name: 'steve',
            shoeSize: 0,
            address: {
              city: 'somewhere',
            },
          })
          return [_id, id]
        },
      )

      const obj1 = await db.table('friends').get(_id)
      expect(obj1).to.not.be.undefined
      expect(obj1).to.have.ownProperty('_id', _id)
      // base32-encoded 26-character string representing 128 bytes
      expect(obj1?._id).to.have.length(26)

      const obj2 = await db.table('others').get(id)
      expect(obj2.id).to.equal(1)
    })
  })
})
