import Ajv from 'ajv'
import Dexie, {
  DBCore,
  DBCoreMutateRequest,
  DBCoreMutateResponse,
  DBCoreTable,
  Middleware,
} from 'dexie'
import { JSONSchema4, JSONSchema4Type } from 'json-schema'
import {
  initOverrideCreateTransaction,
  initOverrideParseStoreSpec,
} from '../overrides'

export const SchemasTableName = '_schemas'

export type JSONSchema = JSONSchema4 // | JSONSchema6 | JSONSchema7;
export type JSONType = JSONSchema4Type // | JSONSchema6Type | JSONSchema7Type;

declare module 'dexie' {
  export interface Table {
    setSchema(schema?: JSONSchema): Promise<void>
    getSchema(): Promise<JSONSchema>
  }
}

// TODO: Make this configurable
const defaultSchema: JSONSchema = {
  properties: {
    _id: {
      type: 'string',
    },
  },
}

export function createSchemaMiddleware(core: DBCore): DBCore {
  return {
    ...core,
    table(tableName: string): DBCoreTable {
      const table = core.table(tableName)
      // Utility tables start with _
      // TODO: Is this too simplistic a rule?
      if (tableName.startsWith('_')) return table
      return {
        ...table,
        async mutate(req: DBCoreMutateRequest): Promise<DBCoreMutateResponse> {
          const pair = await core
            .table(SchemasTableName)
            .get({ key: tableName, trans: req.trans })
          const schema: JSONSchema = pair?.schema ?? defaultSchema
          const validator = new Ajv({ useDefaults: true }).compile(schema)
          // We only need to worry about validation when mutating data
          try {
            switch (req.type) {
              case 'add':
              case 'put':
                // Clone values to avoid mutating input request values
                const values = Dexie.deepClone(req.values)
                values.forEach((value) => {
                  if (validator(value) === false && validator.errors) {
                    throw new Ajv.ValidationError(validator.errors)
                  }
                })
                // Clone request and replace with updated values
                req = { ...req, values }
            }
          } catch (err) {
            throw err
          }
          return table.mutate(req)
        },
      }
    },
  }
}

export const schemaMiddleware: Middleware<DBCore> = {
  stack: 'dbcore',
  name: 'SchemaMiddleware',
  create: createSchemaMiddleware,
}

/**
 * SchemaAddon function
 */
export function schemaAddon(db: Dexie): void {
  // Enable the middleware so we don't have to do it manually
  db.use(schemaMiddleware)
  // Override creating a new transaction. This adds the schemas table
  // to all transactions
  const overrideCreateTransaction = initOverrideCreateTransaction(
    db,
    SchemasTableName,
  )
  db._createTransaction = Dexie.override(
    db._createTransaction,
    overrideCreateTransaction,
  )
  // Override parsing the stores to add schemas table.
  const overrideParseStoresSpec = initOverrideParseStoreSpec({
    [SchemasTableName]: '&name',
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(db.Version.prototype as any)._parseStoresSpec = Dexie.override(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db.Version.prototype as any)._parseStoresSpec,
    overrideParseStoresSpec,
  )
  // setSchema will default to setting a wide open schema
  db.Table.prototype.setSchema = async function (
    schema: JSONSchema = defaultSchema,
  ): Promise<void> {
    await this.db.table(SchemasTableName).put({ name: this.name, schema })
  }
  // getSchema will always return a default schema, even if one doesn't exist
  db.Table.prototype.getSchema = async function (): Promise<any> {
    const pair = await this.db.table(SchemasTableName).get({ name: this.name })
    const obj = pair?.schema
    if (
      obj === undefined ||
      (Object.keys(obj).length === 0 && obj.constructor === Object)
    ) {
      // Empty or undefined object
      return defaultSchema
    }
    return obj
  }
}
