// This is a pure side-effects addon :(
import 'dexie-mongoify'
import { FilterQuery as Query } from './query'

// Export here for callers
export { Query }

// Module augmentation to add methods to Dexie's default instance
declare module 'dexie' {
  interface DeleteResult {
    result: {
      ok: number
      n: number
    }
    deletedCount: number
  }

  interface InsertResult<T = any> {
    insertedCount: number
    insertedId: string
    ops: T[]
    result: {
      ok: number
      n: number
    }
  }

  interface UpdateResult {
    result: {
      ok: 1
      nModified: number
    }
    modifiedCount: number
    upsertedCount: number
    upsertedId: string | null
  }

  interface Table<T = any, TKey = IndexableType> {
    count(query?: Query<T>): PromiseExtended<number>
    find(query?: Query<T>): Collection<T, TKey>
    findOne(query?: Query<T>): PromiseExtended<T | undefined>
    insert(item: T): PromiseExtended<InsertResult<T> | never>
    remove(query?: Query<T>): PromiseExtended<DeleteResult | never>
    drop(): PromiseExtended<DeleteResult | never>
    update(
      query: Query<T>,
      update: T,
      options?: {
        upsert?: boolean
        $set?: any
        $addToSet?: any
        $push?: any
      },
    ): PromiseExtended<UpdateResult | never>
  }
}
