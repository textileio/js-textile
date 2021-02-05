import Dexie, { DexieOptions } from 'dexie'
import setGlobalVars from 'indexeddbshim'
import { changesAddon } from '../middleware/changes'
// This is a pure side-effects addon :(
import '../middleware/mongo'
import { schemaAddon } from '../middleware/schemas'
import { ulidMiddleware } from '../middleware/ulid'
// eslint-disable-next-line @typescript-eslint/ban-types
let indexedDB: { open: Function } | undefined,
  IDBKeyRange: // eslint-disable-next-line @typescript-eslint/ban-types
  { bound: Function; lowerBound: Function; upperBound: Function } | undefined
if (setGlobalVars instanceof Function) {
  const globals: DexieOptions = setGlobalVars({}, { checkOrigin: false })
  indexedDB = globals.indexedDB
  IDBKeyRange = globals.IDBKeyRange
}

/**
 * Create a new Dexie database using indexedDB shim by default.
 * @param databaseName The name of the new db.
 */
export function NewDexie(databaseName: string): Dexie {
  // TODO: This options stuff is kinda messy, but required for nodejs support and tests with polendina
  const options: DexieOptions = {
    addons: [...Dexie.addons, changesAddon, schemaAddon],
  }
  if (indexedDB) options.indexedDB = indexedDB
  if (IDBKeyRange) options.IDBKeyRange = IDBKeyRange
  const dexie = new Dexie(databaseName, options)
  dexie.use(ulidMiddleware)
  // If another window/tab is accessing this db, we want to "gracefully"
  // handle any version upgrades due to new collections being created
  // @see {@link https://stackoverflow.com/a/39015986/1256988}
  dexie.on('versionchange', () => {
    dexie.close() // Allow other page to upgrade schema
    dexie
      .open() // Reopen the db
      .then(() => {
        // New table can be accessed from now on.
        console.log('Database reloaded with updated version')
      })
      .catch((err) => {
        // Failed to open. Log or show!
        console.log('Failed to reload database with updated version')
        throw err
      })
    return false // Tell Dexie's default implementation not to run
  })
  return dexie
}

export function nameFromKeyPath(keyPath?: string | string[]): string {
  return typeof keyPath === 'string'
    ? keyPath
    : keyPath
    ? '[' + [].join.call(keyPath, '+') + ']'
    : ''
}

export function createIndexString(
  {
    path,
    unique,
    multi,
    auto,
  }: {
    path: string
    unique?: boolean
    multi?: boolean
    auto?: boolean
  },
  isPrimKey = false,
): string {
  return (
    (unique && !isPrimKey ? '&' : '') +
    (multi ? '*' : '') +
    (auto ? '++' : '') +
    nameFromKeyPath(path)
  )
}

/**
 * A decent hash function.
 * @param s Input string
 * @link https://stackoverflow.com/a/52171480/1256988
 */
export const hashString = (s: string): number => {
  let i, h
  for (i = 0, h = 9; i < s.length; ) {
    h = Math.imul(h ^ s.charCodeAt(i++), 9 ** 9)
  }
  // Add max 32bit integer + 1
  return (h ^ (h >>> 9)) + 0x7fffffff + 1
}
