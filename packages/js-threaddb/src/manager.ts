import { ThreadID } from "@textile/threads-id";
import { Closer, Options } from "./utils";
import { Database } from "./db";

/**
 * Manager interface defines a collection of dbs.
 * The manager can be used to manage multiple dbs, used across multiple identities. It is up to the
 * caller to track the identities, but the manager can be used to obtain tokens for each/all.
 */
export interface Manager extends Closer {
  /**
   * Obtain a token for interacting with the remote service(s).
   * @param privateKey The private key of a user identity to use for auth with the database.
   */
  getToken(privateKey: Uint8Array): Promise<string>;
  /**
   * Obtain a token for interacting with the remote service(s).
   * @param publicKey The public key of a user identity to use for cauth with the database.
   * @param callback A callback function that takes a `challenge` argument and returns a signed
   * message using the input challenge.
   * @note `publicKey` must be the corresponding public key of the object/service used to sign
   * the `challenge` in the `callback`.
   * @note This is an method does not exist on the Go API.
   */
  getTokenChallenge(
    publicKey: Uint8Array,
    callback: (challenge: Uint8Array) => Uint8Array | Promise<Uint8Array>
  ): Promise<string>;

  /**
   * Creates a new db and prefixes its datastore with base key.
   * @param id The thread id to use for the db.
   * @note This is the same as `NewDB` on the Go API, but is longer to match class name.
   * @note NewDBFromAddress is not outlined here, as it may not actually be required.
   */
  newDatabase(id: ThreadID, opts?: Options): Promise<Database>;

  /**
   * Return a list of all available dbs.
   * @note This is the same as `ListDBs` on the Go API, but is shorter here to match Map-style access.
   */
  list(opts?: Options): Promise<Map<ThreadID, Database>>;

  /**
   * Return a db by thread id.
   * @param id The thread id of the db.
   * @note This is the same as `GetDB` on the Go API, but is shorter here to match Map-style access.
   */
  get(id: ThreadID, opts?: Options): Promise<Database>;

  /**
   * Delete a db by thread id.
   * @param id The thread id of the db.
   * @note This is the same as `DeleteDB` on the Go API, but is shorter here to match Map-style access.
   */
  delete(id: ThreadID, opts?: Options): Promise<void>;
}

/**
 * ManagerConstructor interface defines the contructor and static methods for Manager
 */
export interface ManagerConstructor {
  /**
   * Create a new Manager.
   * @note This is a hypothetical constructor based on Dexie.io and others (plus seems intuitive).
   */
  new (
    remote: string | { host: string; port: number },
    opts?: Options
  ): Manager;
}
