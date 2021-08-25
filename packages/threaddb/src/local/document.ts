import { Table } from 'dexie'
import { ulid } from 'ulid'
import { JSONType } from '../middleware/schemas'

/**
 * Document is any JSON object with an _id field.
 * It can be operated on directly, and its updates should be reflected in its saved state.
 */
export type Document<T extends unknown> = T & {
  _id: string
}

/**
 * Instance is a document with methods on it.
 */
export interface Instance {
  save(): Promise<string>
  remove(): Promise<void>
  exists(): Promise<boolean>
  toJSON(): JSONType
}

/**
 * DocumentInstanceConstructor is an object that can be used to create new DocumentInstances.
 */
export interface DocumentInstanceConstructor {
  new <T = unknown>(data?: Partial<T>): Document<T> & Instance
}

/**
 * Create new DocumentInstances within a given collection/table.
 * @param table Input dexie-compatible table.
 */
export function DocumentInstanceClassFactory(
  table: Table<unknown, string>,
): DocumentInstanceConstructor {
  /**
   * DocumentInstance is a document and a reference to its underlying collection.
   */
  const cls = class DocumentInstance<T = unknown> {
    _id!: string

    constructor(data: Partial<T> = {}) {
      // Spread on data should override existing _id if provided
      return Object.assign(this, { _id: ulid(), ...data })
    }

    /**
     * Save this instance to its parent collection.
     */
    save(): Promise<string> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return table.put({ ...this } as any)
    }

    /**
     * Remove this instance (by id) from its parent collection.
     */
    remove(): Promise<void> {
      return table.delete(this._id)
    }

    /**
     * Check if this instance (by id) exists in its parent collection.
     */
    async exists(): Promise<boolean> {
      return (await table.get(this._id)) !== undefined
    }

    /**
     * Get a JSON representation of this instance.
     */
    toJSON(): JSONType {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { ...(this as any) }
    }
  }
  return cls as DocumentInstanceConstructor
}
