/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { expect } from 'chai'
import { NewDexie } from '../utils'
import { DocumentInstanceClassFactory } from './document'

const databaseName = 'document'

describe('ThreadDB', function () {
  context('document', function () {
    const dexie = NewDexie(databaseName)

    after(async function () {
      dexie.close()
      await dexie.delete()
    })

    describe('basic', async function () {
      before(async function () {
        // Super low-level access
        dexie.version(1).stores({ things: '++_id,thing' })
      })

      it('should create a (constructable) document class', async function () {
        const Cls = DocumentInstanceClassFactory(dexie.table('things'))
        try {
          new Cls()
        } catch (err) {
          throw new Error('should be constructable')
        }
      })

      it('should create a valid class instance with core methods and expected properties', async function () {
        const Cls = DocumentInstanceClassFactory(dexie.table('things'))
        const instance = new Cls<{ name: string; age: number }>({
          name: 'Lucas',
          age: 99,
        })
        expect(instance.age).to.equal(99)
        expect(instance.name).to.equal('Lucas')
        expect(instance._id).to.not.be.undefined
        expect(instance.exists).to.not.be.undefined
      })
    })
  })
})
