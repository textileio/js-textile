import {
  JSONSchema4,
  JSONSchema6,
  JSONSchema7,
  JSONSchema4Type,
  JSONSchema6Type,
  JSONSchema7Type,
} from "json-schema";

export type JSONSchema = JSONSchema4 | JSONSchema6 | JSONSchema7;
export type JSONType = JSONSchema4Type | JSONSchema6Type | JSONSchema7Type;

/**
 * Closer interface defines something that can be closed.
 */
export interface Closer {
  /**
   * Close this thing.
   */
  close(): Promise<void>;
}

/**
 * Options is a default set of options for all calls.
 */
export interface Options {
  /**
   * Token is a generic token.
   */
  token?: string;
  /**
   * Whether to automatically attempt to sync with the remote on each update.
   */
  autoSync?: boolean;

  /**
   * Whether to only operate on the local db. This might mean missing/outdated entries.
   */
  localOnly?: boolean;

  /**
   * Whether to only operate on the remote db. This might mean slower responses or errors
   * if no connection to the remote is possible.
   */
  remoteOnly?: boolean;
}
