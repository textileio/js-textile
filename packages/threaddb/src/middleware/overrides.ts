import type { DbSchema, Dexie, Transaction, Version } from 'dexie'

export function initOverrideCreateTransaction(db: Dexie, ...names: string[]) {
  return function overrideCreateTransaction(
    origFunc: typeof db._createTransaction,
  ) {
    return function (
      this: Dexie,
      mode: IDBTransactionMode,
      storenames: Array<string>,
      dbschema: DbSchema,
      parent?: Transaction,
    ): ReturnType<typeof origFunc> {
      // Don't observe dynamically opened databases.
      if (db.dynamicallyOpened())
        // eslint-disable-next-line prefer-rest-params,@typescript-eslint/no-explicit-any
        return origFunc.apply(this, (arguments as unknown) as any)
      if (
        mode === 'readwrite' &&
        // Lame, but it should be fine for our purposes
        storenames.some((name) => !name.startsWith('_'))
      ) {
        // Make sure to also include the changes store.
        storenames = storenames.slice(0) // Clone
        // Otherwise, firefox will hang...
        for (const name of names) {
          if (storenames.indexOf('name') === -1) storenames.push(name)
        }
      }
      // Call original db._createTransaction()
      const trans = origFunc.call(this, mode, storenames, dbschema, parent)
      return trans
    }
  }
}

export function initOverrideParseStoreSpec(extras: {
  [tableName: string]: string | null
}) {
  return function overrideParseStoresSpec(
    origFunc: (
      stores: { [tableName: string]: string | null },
      outSchema: DbSchema,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) => any,
  ) {
    return function (
      this: Version,
      stores: { [tableName: string]: string | null },
      outSchema: DbSchema,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): any {
      stores = { ...stores, ...extras }
      // Call default implementation. Will populate the dbSchema structures.
      origFunc.call(this, stores, outSchema)
    }
  }
}
