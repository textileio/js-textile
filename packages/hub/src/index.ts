/**
 * A web-gRPC wrapper client for communicating with the web-gRPC enabled Textile ThreadDB & Buckets APIs.
 * @packageDocumentation
 */

export {
  mismatchError,
  missingIdentity,
  existingKeyError,
  DatabaseSettings,
  StartOptions,
  Database,
  FilterQuery,
  JSONSchema,
  Config,
  Options,
  Document,
  Collection,
  ReadonlyCollection,
} from '@textile/threads-database'
export { ThreadID, Variant } from '@textile/threads-id'
export { Identity } from '@textile/threads-core'
export { Client } from '@textile/hub-threads-client'
export * from '@textile/buckets'
export * from '@textile/security'
