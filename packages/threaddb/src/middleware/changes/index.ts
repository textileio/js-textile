/**
 * Dexie add-on that provides DB-level change tracking.
 * https://gist.github.com/medmunds/17c331c694ae00ce072ff642619f473b
 */
import Dexie, {
  DBCore,
  DBCoreAddRequest,
  DBCoreDeleteRequest,
  DBCoreIndex,
  DBCoreMutateRequest,
  DBCoreMutateResponse,
  DBCorePutRequest,
  DBCoreTable,
  Middleware,
} from 'dexie'
import jsonpatch, { Operation } from 'fast-json-patch'
import {
  initOverrideCreateTransaction,
  initOverrideParseStoreSpec,
} from '../overrides'

export const ChangeTableName = '_changes'
export const StashTableName = '_stash'
export const MetaTableName = '_meta'

export interface Change<T = any> {
  name: string
  key: string
  type: 'put' | 'delete' | 'add'
  ops: Operation[]
  before: T | undefined
  after: T | undefined
}

const isEmpty = (obj: any) =>
  Object.keys(obj).length === 0 && obj.constructor === Object

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const zip = <T = any, R = T>(arr1: T[], arr2: R[], fill: any = undefined) => {
  // Missing values should be undefined
  return arr1.map((k, i) => [k, arr2[i] ?? fill])
}

export function createTrackedChangesMiddleware(core: DBCore): DBCore {
  return {
    ...core,
    // transaction(req: DBCoreTransactionRequest): DBCoreTransaction {
    //   return dbCore.transaction(req);
    // },
    table(name: string): DBCoreTable {
      const table = core.table(name)
      // Utility tables start with _
      // TODO: Is this too simplistic a rule?
      if (name.startsWith('_')) return table
      return {
        ...table,
        async mutate(req: DBCoreMutateRequest): Promise<DBCoreMutateResponse> {
          // Shortcut for utility tables
          if (name.startsWith('_')) return table.mutate(req)
          if (req.type === 'deleteRange') {
            // The only type we don't handle right now is "deleteRange".
            // If we needed "deleteRange" tracking, we could probably enumerate
            // the existing keys in the range, and then continue as below?
            // For now, we just don't track this change. So we'll never send this information
            // to the remote... it is always considered a "local" operation.
            return table.mutate(req)
            // throw new Error(`Cannot handle ${req.type} operation`);
          }
          // Extract primary key to check for auto-incrementing
          const { primaryKey } = table.schema
          // Things change slightly if we're auto-incrementing
          // TODO: We might not need to worry about this given our use of ulid
          const autoIncrement = Boolean(primaryKey.autoIncrement)
          // TODO: Does this need to run in a special promise (like hooks middleware uses)?
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          let keys = req.keys || getEffectiveKeys(primaryKey, req)
          // Extract the state of things _before_ this mutation
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          let before = await getExistingValues(table, req, keys)
          // If we're auto-incrementing and adding things, we want results
          if (autoIncrement && (req.type === 'add' || req.type === 'put')) {
            req = { ...req, wantResults: true }
          }
          // Do the default mutation
          const response = await table.mutate(req)
          // Check that we do indeed have our results
          if (autoIncrement && (req.type === 'add' || req.type === 'put')) {
            if (response.results === undefined) {
              throw new Error(
                `autoIncrement keys not returned from ${req.type} mutation`,
              )
            }
            // Keys can be derived from results if we're auto-incrementing
            keys = response.results
          }
          // TODO: This should be optimized (just use undefined[] for deletes,
          // use req.values for add/put if not auto-incrementing, etc.)
          // NOTE: The auto-increment thing might not be an issue, in which
          // case, we could just compute these after the fact using
          // `jsonpatch.applyPatch`
          let after = await table.getMany({ trans: req.trans, keys })
          // Compute json-patch ops...
          // We pair up before with our requested values, this is either
          // nothing (delete) or the new state
          let ops = zip(
            before,
            req.type === 'delete' ? [] : req.values,
            {}, // Fill with {} if missing
          ).map(([prev, next]) => jsonpatch.compare(prev, next))
          // Check for any failures
          const { failures, numFailures } = response
          // If we have some, we need to filter out the results
          // TODO: Clean all this up to avoid the multiple loops etc
          if (numFailures > 0) {
            // Filter out failed items
            before = before.filter((_obj, i) => !failures[i])
            keys = keys.filter((_key, i) => !failures[i])
            ops = ops.filter((_obj, i) => !failures[i])
            after = after.filter((_obj, i) => !failures[i])
          }
          // If we still have some changes, we'll want to compute the diffs
          if (keys.length > 0) {
            // Create the changes values, which will always be a list of 1
            const values: Change[] = []
            for (let i = 0; i < keys.length; i++) {
              const b = before[0]
              // If "putting" here, but is new object, should actually "add" it, otherwise, leave
              const type = req.type === 'put' && isEmpty(b) ? 'add' : req.type
              values.push({
                name,
                type,
                key: keys[i],
                before: b,
                ops: ops[i],
                after: after[i],
              })
            }
            // Grab a reference to our change table for updating
            const changes = core.table(ChangeTableName)
            // Create the update object, which will always be an "add" op
            const update: DBCoreAddRequest = {
              type: 'add',
              trans: req.trans,
              values,
            }
            // Mutate the changes table (within the same transaction)
            await changes.mutate(update)
          }
          // This contains our modified response (mostly un-touched)
          return response
        },
      }
    },
  }
}

// These DBCore helpers aren't exported by Dexie; borrowed directly from:
// https://github.com/dfahlander/Dexie.js/blob/v3.0.1/src/dbcore/get-effective-keys.ts

function getEffectiveKeys(
  primaryKey: DBCoreIndex,
  req:
    | (Pick<DBCoreAddRequest | DBCorePutRequest, 'type' | 'values'> & {
        keys?: any[]
      })
    | Pick<DBCoreDeleteRequest, 'keys' | 'type'>,
) {
  if (req.type === 'delete') return req.keys
  return req.keys || req.values.map(primaryKey.extractKey)
}

function getExistingValues(
  table: DBCoreTable,
  req: DBCoreAddRequest | DBCorePutRequest | DBCoreDeleteRequest,
  effectiveKeys: unknown[],
) {
  return req.type === 'add'
    ? Promise.resolve(new Array(req.values.length).fill({}))
    : table
        .getMany({ trans: req.trans, keys: effectiveKeys })
        .then((values) => values.map((obj) => (obj === undefined ? {} : obj)))
}

/**
 * ChangesMiddleware object
 */
export const changesMiddleware: Middleware<DBCore> = {
  stack: 'dbcore',
  name: 'ChangesMiddleware',
  create: createTrackedChangesMiddleware,
}

/**
 * ChangesAddon function
 */
export function changesAddon(db: Dexie): void {
  // Override creating a new transaction. This adds the changes table
  // to all transactions
  const overrideCreateTransaction = initOverrideCreateTransaction(
    db,
    ChangeTableName,
  )
  db._createTransaction = Dexie.override(
    db._createTransaction,
    overrideCreateTransaction,
  )

  // Override parsing the stores to add changes, stash, and meta data tables.
  const overrideParseStoresSpec = initOverrideParseStoreSpec({
    [ChangeTableName]: '++id,name',
    [StashTableName]: '++id,name',
    [MetaTableName]: '&key',
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(db.Version.prototype as any)._parseStoresSpec = Dexie.override(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.Version.prototype as any)._parseStoresSpec,
    overrideParseStoresSpec,
  )
  // Enable the middleware so we don't have to do it manually
  db.use(changesMiddleware)
}
