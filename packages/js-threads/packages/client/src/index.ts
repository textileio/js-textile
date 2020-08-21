/**
 * @packageDocumentation
 * @module @textile/threads-client
 */
import { grpc } from "@improbable-eng/grpc-web"
import { Context, ContextInterface, defaultHost } from "@textile/context"
import { WebsocketTransport } from "@textile/grpc-transport"
import { Multiaddr } from "@textile/multiaddr"
import { KeyInfo, UserAuth } from "@textile/security"
import * as pb from "@textile/threads-client-grpc/threads_pb"
import {
  API,
  APIGetToken,
  APIListen,
} from "@textile/threads-client-grpc/threads_pb_service"
import {
  Identity,
  Libp2pCryptoIdentity,
  ThreadKey,
} from "@textile/threads-core"
import { ThreadID } from "@textile/threads-id"
import toJsonSchema from "to-json-schema"
import {
  Filter,
  Instance,
  InstanceList,
  Query,
  QueryJSON,
  ValueJSON,
  CriterionJSON,
  SortJSON,
  ReadTransaction,
  Where,
  WriteTransaction,
} from "./models"

export {
  Filter,
  Query,
  Where,
  WriteTransaction,
  ReadTransaction,
  Instance,
  InstanceList,
  QueryJSON,
  ValueJSON,
  CriterionJSON,
  SortJSON,
}

export interface CollectionConfig {
  name: string
  schema: any
  indexes: pb.Index.AsObject
}

const encoder = new TextEncoder()

export function maybeLocalAddr(ip: string): boolean | RegExpMatchArray {
  return (
    ["localhost", "", "::1"].includes(ip) ||
    ip.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/) ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.0.") ||
    ip.endsWith(".local")
  )
}

export enum Action {
  CREATE = 0,
  SAVE,
  DELETE,
}

export interface Update<T = any> extends Instance<T> {
  collectionName: string
  instanceID: string
  action: Action
}

/**
 * DBInfo contains joining/sharing information for a Thread/DB.
 */
export interface DBInfo {
  /**
   * The Thread Key, encoded as a base32 string.
   * @see ThreadKey for details.
   */
  key: string
  /**
   * The Multiaddrs for a peer hosting the given Thread/DB.
   */
  addrs: string[]
}

/**
 * Client is a web-gRPC wrapper client for communicating with a webgRPC-enabled Threads server.
 * This client library can be used to interact with a local or remote Textile gRPC-service
 * It is a wrapper around Textile Thread's 'DB' API, which is defined here:
 * https://github.com/textileio/go-threads/blob/master/api/pb/api.proto.
 *
 * @example
 * ```typescript
 * import {Client, Identity, UserAuth} from '@textile/threads'
 *
 * async function setupDB(auth: UserAuth, identity: Identity) {
 *   // Initialize the client
 *   const client = Client.withUserAuth(auth)
 *
 *   // Connect the user to your API
 *   const userToken = await client.getToken(identity)
 *
 *   // Create a new DB
 *   const threadID = await client.newDB(undefined, 'nasa')
 *
 *   // Create a new Collection from an Object
 *   const buzz = {
 *     name: 'Buzz',
 *     missions: 2,
 *     _id: '',
 *   }
 *   await client.newCollectionFromObject(threadID, 'astronauts', buzz)
 *
 *   // Store the buzz object in the new collection
 *   await client.create(threadID, 'astronauts', [buzz])
 *
 *   return threadID
 * }
 * ```
 */
export class Client {
  public serviceHost: string
  public rpcOptions: grpc.RpcOptions
  /**
   * Creates a new gRPC client instance for accessing the Textile Threads API.
   * @param context The context to use for interacting with the APIs. Can be modified later.
   * @param debug Should we run in debug mode. Defaults to false.
   */
  constructor(public context: ContextInterface = new Context(), debug = false) {
    this.serviceHost = context.host
    this.rpcOptions = {
      transport: WebsocketTransport(),
      debug,
    }
  }

  /**
   * Create a new gRPC client instance from a supplied user auth object.
   * Assumes all default gRPC settlings. For customization options, use a context object directly.
   * The callback method will automatically refresh expiring credentials.
   * @param auth The user auth object or an async callback that returns a user auth object.
   * @example
   * ```typescript
   * import {UserAuth, Client} from '@textile/threads'
   *
   * function create (auth: UserAuth) {
   *   return Client.withUserAuth(auth)
   * }
   * ```
   * @example
   * ```typescript
   * import {UserAuth, Client} from '@textile/threads'
   *
   * function setCallback (callback: () => Promise<UserAuth>) {
   *   return Client.withUserAuth(callback)
   * }
   * ```
   */
  static withUserAuth(
    auth: UserAuth | (() => Promise<UserAuth>),
    host = defaultHost,
    debug = false
  ): Client {
    const context =
      typeof auth === "object"
        ? Context.fromUserAuth(auth, host)
        : Context.fromUserAuthCallback(auth, host)
    return new Client(context, debug)
  }

  /**
   * Create a new gRPC client instance from a supplied key and secret
   * @param key The KeyInfo object containing {key: string, secret: string, type: 0}. 0 === User Group Key, 1 === Account Key
   * @param host The remote gRPC host to connect with. Should be left as default.
   * @param debug Whether to run in debug mode. Defaults to false.
   * @example
   * ```typescript
   * import {KeyInfo, Client} from '@textile/threads'
   *
   * async function create (keyInfo: KeyInfo) {
   *   return await Client.withKeyInfo(keyInfo)
   * }
   * ```
   */
  static async withKeyInfo(
    key: KeyInfo,
    host = defaultHost,
    debug = false
  ): Promise<Client> {
    const context = new Context(host)
    await context.withKeyInfo(key)
    return new Client(context, debug)
  }

  /**
   * Create a random user identity.
   * @deprecated
   * @remarks
   * See `PrivateKey`
   */
  static async randomIdentity(): Promise<Libp2pCryptoIdentity> {
    return Libp2pCryptoIdentity.fromRandom()
  }

  /**
   * Obtain a token per user (identity) for interacting with the remote API.
   * @param identity A user identity to use for creating records in the database. A random identity
   * can be created with `Client.randomIdentity(), however, it is not easy/possible to migrate
   * identities after the fact. Please store or otherwise persist any identity information if
   * you wish to retrieve user data later, or use an external identity provider.
   * @param ctx Context object containing web-gRPC headers and settings.
   * @example
   * ```typescript
   * import {Client, Identity} from '@textile/threads'
   *
   * async function newToken (client: Client, user: Identity) {
   *   // Token is added to the client connection at the same time
   *   const token = await client.getToken(user)
   *   return token
   * }
   * ```
   */
  async getToken(identity: Identity, ctx?: ContextInterface): Promise<string> {
    return this.getTokenChallenge(
      identity.public.toString(),
      async (challenge: Uint8Array) => {
        return identity.sign(challenge)
      },
      ctx
    )
  }

  /**
   * Obtain a token per user (identity) for interacting with the remote API.
   * @param publicKey The public key of a user identity to use for creating records in the database.
   * A random identity can be created with `Client.randomIdentity(), however, it is not
   * easy/possible to migrate identities after the fact. Please store or otherwise persist any
   * identity information if you wish to retrieve user data later, or use an external identity
   * provider.
   * @param callback A callback function that takes a `challenge` argument and returns a signed
   * message using the input challenge and the private key associated with `publicKey`.
   * @param ctx Context object containing web-gRPC headers and settings.
   * @remarks `publicKey` must be the corresponding public key of the private key used in `callback`.
   */
  async getTokenChallenge(
    publicKey: string,
    callback: (challenge: Uint8Array) => Uint8Array | Promise<Uint8Array>,
    ctx?: ContextInterface
  ): Promise<string> {
    const client = grpc.client<
      pb.GetTokenRequest,
      pb.GetTokenReply,
      APIGetToken
    >(API.GetToken, {
      host: this.serviceHost,
      transport: this.rpcOptions.transport,
      debug: this.rpcOptions.debug,
    })
    return new Promise<string>((resolve, reject) => {
      let token = ""
      client.onMessage(async (message: pb.GetTokenReply) => {
        if (message.hasChallenge()) {
          const challenge = message.getChallenge_asU8()
          const signature = await callback(challenge)
          const req = new pb.GetTokenRequest()
          req.setSignature(signature)
          client.send(req)
          client.finishSend()
        } else if (message.hasToken()) {
          token = message.getToken()
        }
      })
      client.onEnd((
        code: grpc.Code,
        message: string /** trailers: grpc.Metadata */
      ) => {
        client.close()
        if (code === grpc.Code.OK) {
          this.context.withToken(token)
          resolve(token)
        } else {
          reject(new Error(message))
        }
      })
      const req = new pb.GetTokenRequest()
      req.setKey(publicKey)
      this.context.toMetadata(ctx).then((metadata) => {
        client.start(metadata)
        client.send(req)
      })
    })
  }

  /**
   * newDB creates a new store on the remote node.
   * @param threadID the ID of the database
   * @param name The human-readable name for the database
   * @example
   * ```typescript
   * import {Client, ThreadID} from '@textile/threads'
   *
   * async function createDB (client: Client) {
   *   const threadID: ThreadID = await client.newDB()
   *   return threadID
   * }
   * ```
   */
  public async newDB(threadID?: ThreadID, name?: string): Promise<ThreadID> {
    const dbID = threadID ?? ThreadID.fromRandom()
    const req = new pb.NewDBRequest()
    req.setDbid(dbID.toBytes())
    if (name !== undefined) {
      this.context.withThreadName(name)
      req.setName(name)
    }
    await this.unary(API.NewDB, req)
    // Update our context with out new thread id
    this.context.withThread(dbID.toString())
    return dbID
  }

  /**
   * open creates and enters a new store on the remote node.
   * @param threadID the ID of the database
   * @param name The human-readable name for the database
   * @example
   * ```typescript
   * import {Client, ThreadID} from '@textile/threads'
   *
   * async function openDB (client: Client, threadID: ThreadID) {
   *   await client.open(threadID)
   * }
   * ```
   */
  public async open(threadID: ThreadID, name?: string): Promise<void> {
    const req = new pb.ListDBsRequest()
    const res = (await this.unary(API.ListDBs, req)) as pb.ListDBsReply.AsObject
    for (const db of res.dbsList) {
      const id = ThreadID.fromBytes(Buffer.from(db.dbid as string, "base64"))
      if (id === threadID) {
        this.context.withThread(threadID.toString())
        return
      }
    }
    await this.newDB(threadID, name)
    this.context.withThread(threadID.toString())
  }

  /**
   * Deletes an entire DB.
   * @param threadID the ID of the database.
   * @example
   * ```typescript
   * import {Client, ThreadID} from '@textile/threads'
   *
   * async function deleteDB (client: Client, threadID: ThreadID) {
   *   await client.deleteDB(threadID)
   *   return
   * }
   * ```
   */
  public async deleteDB(threadID: ThreadID): Promise<void> {
    const req = new pb.DeleteDBRequest()
    req.setDbid(threadID.toBytes())
    await this.unary(API.DeleteDB, req)
    return
  }

  /**
   * Lists all known DBs.
   * @remarks this API is blocked on the Hub. Use `listThreads` when importing Client
   * from `@textile/hub` as an alternative.
   */
  public async listDBs(): Promise<
    Record<string, pb.GetDBInfoReply.AsObject | undefined>
  > {
    const req = new pb.ListDBsRequest()
    const res = (await this.unary(API.ListDBs, req)) as pb.ListDBsReply.AsObject
    const dbs: Record<string, pb.GetDBInfoReply.AsObject | undefined> = {}
    for (const db of res.dbsList) {
      const id = ThreadID.fromBytes(
        Buffer.from(db.dbid as string, "base64")
      ).toString()
      dbs[id] = db.info
    }
    return dbs
  }

  /**
   * newCollection registers a new collection schema under the given name.
   * The schema must be a valid json-schema.org schema, and can be a JSON string or object.
   * @param threadID the ID of the database
   * @param name The human-readable name for the collection.
   * @param schema The actual json-schema.org compatible schema object.
   * @param indexes A set of index definitions for indexing instance fields.
   *
   * @example
   * Change a new astronauts collection
   * ```typescript
   * import {Client, ThreadID} from '@textile/threads'
   *
   * const astronauts = {
   *   title: "Astronauts",
   *   type: "object",
   *   required: ["_id"],
   *   properties: {
   *     _id: {
   *       type: "string",
   *       description: "The instance's id.",
   *     },
   *     name: {
   *       type: "string",
   *       description: "The astronauts name.",
   *     },
   *     missions: {
   *       description: "The number of missions.",
   *       type: "integer",
   *       minimum: 0,
   *     },
   *   },
   * }
   *
   * async function newCollection (client: Client, threadID: ThreadID) {
   *   return await client.updateCollection(threadID, 'astronauts', astronauts)
   * }
   * ```
   */
  public async newCollection(
    threadID: ThreadID,
    name: string,
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    schema: any,
    indexes?: pb.Index.AsObject[]
  ): Promise<void> {
    const req = new pb.NewCollectionRequest()
    const config = new pb.CollectionConfig()
    config.setName(name)
    config.setSchema(encoder.encode(JSON.stringify(schema)))
    const idx: pb.Index[] = []
    for (const item of indexes ?? []) {
      const index = new pb.Index()
      index.setPath(item.path)
      index.setUnique(item.unique)
      idx.push(index)
    }
    config.setIndexesList(idx)
    req.setDbid(threadID.toBytes())
    req.setConfig(config)
    await this.unary(API.NewCollection, req)
    return
  }

  /**
   * newCollectionFromObject creates and registers a new collection under the given name.
   * The input object must be serializable to JSON, and contain only json-schema.org types.
   * @param threadID the ID of the database
   * @param name The human-readable name for the collection.
   * @param obj The actual object to attempt to extract a schema from.
   * @param indexes A set of index definitions for indexing instance fields.
   *
   * @example
   * Change a new astronauts collection based of Buzz
   * ```typescript
   * import {Client, ThreadID} from '@textile/threads'
   *
   * async function newCollection (client: Client, threadID: ThreadID) {
   *   const buzz = {
   *     name: 'Buzz',
   *     missions: 2,
   *     _id: '',
   *   }
   *   return await client.newCollectionFromObject(threadID, 'astronauts', buzz)
   * }
   * ```
   */
  public async newCollectionFromObject(
    threadID: ThreadID,
    name: string,
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    obj: any,
    indexes?: pb.Index.AsObject[]
  ): Promise<void> {
    const schema = toJsonSchema(obj)
    return this.newCollection(threadID, name, schema, indexes)
  }

  /**
   * updateCollection updates an existing collection.
   * Currently, updates can include name and schema.
   * @todo Allow update of indexing information.
   * @param threadID the ID of the database
   * @param name the new name of the collection
   * @param schema the new schema of the collection
   *
   * @example
   * Change the name of our astronauts collection
   * ```typescript
   * import {Client, ThreadID} from '@textile/threads'
   *
   * const astronauts = {
   *   title: "Astronauts",
   *   type: "object",
   *   required: ["_id"],
   *   properties: {
   *     _id: {
   *       type: "string",
   *       description: "The instance's id.",
   *     },
   *     name: {
   *       type: "string",
   *       description: "The astronauts name.",
   *     },
   *     missions: {
   *       description: "The number of missions.",
   *       type: "integer",
   *       minimum: 0,
   *     },
   *   },
   * }
   *
   * async function changeName (client: Client, threadID: ThreadID) {
   *   return await client.updateCollection(threadID, 'toy-story-characters', astronauts)
   * }
   * ```
   */
  public async updateCollection(
    threadID: ThreadID,
    name: string,
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    schema: any,
    indexes?: pb.Index.AsObject[]
  ): Promise<void> {
    const req = new pb.UpdateCollectionRequest()
    const conf = new pb.CollectionConfig()
    conf.setName(name)
    conf.setSchema(encoder.encode(JSON.stringify(schema)))
    const idx: pb.Index[] = []
    for (const item of indexes ?? []) {
      const index = new pb.Index()
      index.setPath(item.path)
      index.setUnique(item.unique)
      idx.push(index)
    }
    conf.setIndexesList(idx)
    req.setDbid(threadID.toBytes())
    req.setConfig(conf)
    await this.unary(API.UpdateCollection, req)
    return
  }

  /**
   * Deletes an existing collection.
   * @param threadID the ID of the database.
   * @param name The human-readable name for the collection.
   * @param schema The actual json-schema.org compatible schema object.
   * @example
   * ```typescript
   * import {Client, ThreadID} from '@textile/threads'
   *
   * async function deleteAstronauts (client: Client, thread: ThreadID) {
   *   await client.deleteCollection(thread, 'astronauts')
   *   return
   * }
   * ```
   */
  public async deleteCollection(
    threadID: ThreadID,
    name: string
  ): Promise<void> {
    const req = new pb.DeleteCollectionRequest()
    req.setDbid(threadID.toBytes())
    req.setName(name)
    await this.unary(API.DeleteCollection, req)
    return
  }

  /**
   * Returns an existing indexes for a collection.
   * @param threadID the ID of the database.
   * @param name The human-readable name for the collection.
   *
   * @example
   * Return a set of indexes for our astronauts collection
   * ```typescript
   * import {Client, ThreadID} from '@textile/threads'
   *
   * async function getIndexes (client: Client, threadID: ThreadID) {
   *   return await client.getCollectionIndexes(threadID, 'astronauts')
   * }
   * ```
   */
  public async getCollectionIndexes(
    threadID: ThreadID,
    name: string
  ): Promise<pb.Index.AsObject[]> {
    const req = new pb.GetCollectionIndexesRequest()
    req.setDbid(threadID.toBytes())
    req.setName(name)
    const res = (await this.unary(
      API.GetCollectionIndexes,
      req
    )) as pb.GetCollectionIndexesReply.AsObject
    return res.indexesList
  }

  /**
   * newDBFromAddr initializes the client with the given store, connecting to the given
   * thread address (database). It should be called before any operation on the store, and is an
   * alternative to start, which creates a local store. newDBFromAddr should also include the
   * read/follow key, which should be a Buffer, Uint8Array or base32-encoded string.
   * @remarks
   * See getDBInfo for a possible source of the address and keys. See ThreadKey for
   * information about thread keys.
   * @param address The address for the thread with which to connect.
   * Should be of the form /ip4/<url/ip-address>/tcp/<port>/p2p/<peer-id>/thread/<thread-id>
   * @param key The set of keys to use to connect to the database
   * @param collections Array of `name` and JSON schema pairs for seeding the DB with collections.
   */
  public async newDBFromAddr(
    address: string,
    key: string | Uint8Array,
    collections?: Array<{ name: string; schema: any }>
  ): Promise<void> {
    const req = new pb.NewDBFromAddrRequest()
    const addr = new Multiaddr(address).buffer
    req.setAddr(addr)
    // Should always be encoded string, but might already be bytes
    req.setKey(
      typeof key === "string" ? ThreadKey.fromString(key).toBytes() : key
    )
    if (collections !== undefined) {
      req.setCollectionsList(
        collections.map((c) => {
          const config = new pb.CollectionConfig()
          config.setName(c.name)
          config.setSchema(encoder.encode(JSON.stringify(c.schema)))
          return config
        })
      )
    }
    await this.unary(API.NewDBFromAddr, req)
    return
  }

  /**
   * Connect client to an existing database using information in the DBInfo object
   * This should be called before any operation on the store, and is an alternative
   * to open, which re-opens a database already opened by the user.
   * @remarks This is a helper method around newDBFromAddr, which takes the 'raw' output
   * from getDBInfo. See getDBInfo for a possible source of the address and keys.
   * @param info The output from a call to getDBInfo on a separate peer.
   * @param includeLocal Whether to try dialing addresses that appear to be on the local host.
   * Defaults to false, preferring to add from public ip addresses.
   * @param collections Array of `name` and JSON schema pairs for seeding the DB with collections.
   *
   * @example
   * Get DB info and use DB info to join an existing remote thread (e.g. invited)
   * ```typescript
   * import {Client, DBInfo, ThreadID} from '@textile/threads'
   *
   * async function getInfo (client: Client, threadID: ThreadID): Promise<DBInfo> {
   *   return await client.getDBInfo(threadID)
   * }
   *
   * async function joinFromInfo (client: Client, info: DBInfo) {
   *   return await client.joinFromInfo(info)
   * }
   * ```
   */
  public async joinFromInfo(
    info: DBInfo,
    includeLocal = false,
    collections?: Array<{ name: string; schema: any }>
  ): Promise<void> {
    const req = new pb.NewDBFromAddrRequest()
    const filtered = info.addrs
      .map((addr) => new Multiaddr(addr))
      .filter((addr) => includeLocal || !maybeLocalAddr(addr.toOptions().host))
    for (const addr of filtered) {
      req.setAddr(addr.buffer)
      // Should always be encoded string, but might already be bytes
      req.setKey(
        typeof info.key === "string"
          ? ThreadKey.fromString(info.key).toBytes()
          : info.key
      )
      if (collections !== undefined) {
        req.setCollectionsList(
          collections.map((c) => {
            const config = new pb.CollectionConfig()
            config.setName(c.name)
            config.setSchema(encoder.encode(JSON.stringify(c.schema)))
            return config
          })
        )
      }
      // Try to add addrs one at a time, if one succeeds, we are done.
      await this.unary(API.NewDBFromAddr, req)
      return
    }
    throw new Error("No viable addresses for dialing")
  }

  /**
   * Returns a DBInfo objection containing metadata required to invite other peers to join a given thread.
   * @param threadID the ID of the database
   * @returns An object with an encoded thread key, and a list of multiaddrs.
   *
   * @example
   * Get DB info and use DB info to join an existing remote thread (e.g. invited)
   * ```typescript
   * import {Client, DBInfo, ThreadID} from '@textile/threads'
   *
   * async function getInfo (client: Client, threadID: ThreadID): Promise<DBInfo> {
   *   return await client.getDBInfo(threadID)
   * }
   *
   * async function joinFromInfo (client: Client, info: DBInfo) {
   *   return await client.joinFromInfo(info)
   * }
   * ```
   */
  public async getDBInfo(threadID: ThreadID): Promise<DBInfo> {
    const req = new pb.GetDBInfoRequest()
    req.setDbid(threadID.toBytes())
    const res = (await this.unary(
      API.GetDBInfo,
      req
    )) as pb.GetDBInfoReply.AsObject
    const threadKey = Buffer.from(res.key as string, "base64")
    const key = ThreadKey.fromBytes(threadKey)
    const addrs: string[] = []
    for (const addr of res.addrsList) {
      const a =
        typeof addr === "string"
          ? Buffer.from(addr, "base64")
          : Buffer.from(addr)
      const address = new Multiaddr(a).toString()
      addrs.push(address)
    }
    return { key: key.toString(), addrs }
  }

  /**
   * Creates a new model instance in the given store.
   * @param threadID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   * @param values An array of model instances as JSON/JS objects.
   *
   * @example
   * Create a new entry in our collection
   * ```typescript
   * import {Client, ThreadID, Where} from '@textile/threads'
   *
   * interface Astronaut {
   *   name: string
   *   missions: number
   *   _id: string
   * }
   *
   * async function createBuzz (client: Client, threadID: ThreadID) {
   *   const buzz: Astronaut = {
   *     name: 'Buzz',
   *     missions: 2,
   *     _id: '',
   *   }
   *
   *   await client.create(threadID, 'astronauts', [buzz])
   * }
   * ```
   */
  public async create(
    threadID: ThreadID,
    collectionName: string,
    values: any[]
  ): Promise<string[]> {
    const req = new pb.CreateRequest()
    req.setDbid(threadID.toBytes())
    req.setCollectionname(collectionName)
    const list: any[] = []
    values.forEach((v) => {
      list.push(encoder.encode(JSON.stringify(v)))
    })
    req.setInstancesList(list)
    const res = (await this.unary(API.Create, req)) as pb.CreateReply.AsObject
    return res.instanceidsList
  }

  /**
   * Saves changes to an existing model instance in the given store.
   * @param threadID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   * @param values An array of model instances as JSON/JS objects. Each model instance must have a valid existing `ID` property.
   *
   * @example
   * Update an existing instance
   * ```typescript
   * import {Client, ThreadID, Where} from '@textile/threads'
   *
   * interface Astronaut {
   *   name: string
   *   missions: number
   *   _id: string
   * }
   *
   * async function updateBuzz (client: Client, threadID: ThreadID) {
   *   const query = new Where('name').eq('Buzz')
   *   const result = await client.find<Astronaut>(threadID, 'astronauts', query)
   *
   *   if (result.instancesList.length < 1) return
   *
   *   const buzz = result.instancesList[0]
   *   buzz.missions += 1
   *
   *   return await client.save(threadID, 'astronauts', [buzz])
   * }
   * ```
   */
  public async save(
    threadID: ThreadID,
    collectionName: string,
    values: any[]
  ): Promise<void> {
    const req = new pb.SaveRequest()
    req.setDbid(threadID.toBytes())
    req.setCollectionname(collectionName)
    const list: any[] = []
    values.forEach((v) => {
      if (!v.hasOwnProperty("ID")) {
        v["ID"] = "" // The server will add an ID if empty.
      }
      list.push(encoder.encode(JSON.stringify(v)))
    })
    req.setInstancesList(list)
    await this.unary(API.Save, req)
    return
  }

  /**
   * Deletes an existing model instance from the given store.
   * @param threadID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   * @param IDs An array of instance ids to delete.
   *
   * @example
   * Delete any instances that return from a query
   * ```typescript
   * import {Client, ThreadID, Where} from '@textile/threads'
   *
   * interface Astronaut {
   *   name: string
   *   missions: number
   *   _id: string
   * }
   *
   * async function deleteBuzz (client: Client, threadID: ThreadID) {
   *   const query = new Where('name').eq('Buzz')
   *   const result = await client.find<Astronaut>(threadID, 'astronauts', query)
   *
   *   if (result.instancesList.length < 1) return
   *
   *   const ids = await result.instancesList.map((instance) => instance._id)
   *   await client.delete(threadID, 'astronauts', ids)
   * }
   * ```
   */
  public async delete(
    threadID: ThreadID,
    collectionName: string,
    IDs: string[]
  ): Promise<void> {
    const req = new pb.DeleteRequest()
    req.setDbid(threadID.toBytes())
    req.setCollectionname(collectionName)
    req.setInstanceidsList(IDs)
    await this.unary(API.Delete, req)
    return
  }

  /**
   * Check if a given instance exists in the collection.
   * @param threadID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   * @param IDs An array of instance ids to check for.
   *
   * @example
   * Check if an instance exists
   * ```typescript
   * import {Client, ThreadID, Where} from '@textile/threads'
   *
   * async function instanceExists (client: Client, threadID: ThreadID, id: string) {
   *   return await client.has(threadID, 'astronauts', [id])
   * }
   * ```
   */
  public async has(
    threadID: ThreadID,
    collectionName: string,
    IDs: string[]
  ): Promise<boolean> {
    const req = new pb.HasRequest()
    req.setDbid(threadID.toBytes())
    req.setCollectionname(collectionName)
    req.setInstanceidsList(IDs)
    const res = (await this.unary(API.Has, req)) as pb.HasReply.AsObject
    return res.exists
  }

  /**
   * Queries a collection for entities matching the given query parameters.
   * @param threadID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   * @param query The object that describes the query. User Query class or primitive QueryJSON type.
   *
   * @example
   * Query with return type
   * ```typescript
   * import {Client, ThreadID, Where} from '@textile/threads'
   *
   * interface Astronaut {
   *   name: string
   *   missions: number
   *   _id: string
   * }
   *
   * async function getAstronautByName (client: Client, threadID: ThreadID, name: string) {
   *   const query = new Where('name').eq(name)
   *   const astronaut = await client.find<Astronaut>(threadID, 'astronauts', query)
   *   return astronaut
   * }
   * ```
   */
  public async find<T = any>(
    threadID: ThreadID,
    collectionName: string,
    query: QueryJSON
  ): Promise<InstanceList<T>> {
    const req = new pb.FindRequest()
    req.setDbid(threadID.toBytes())
    req.setCollectionname(collectionName)
    // @todo: Find a more isomorphic way to do this base64 round-trip
    req.setQueryjson(encoder.encode(JSON.stringify(query)))
    const res = (await this.unary(API.Find, req)) as pb.FindReply.AsObject
    const ret: InstanceList<T> = {
      instancesList: res.instancesList.map((instance) =>
        JSON.parse(Buffer.from(instance as string, "base64").toString())
      ),
    }
    return ret
  }

  /**
   * Queries the collection by a known instance ID.
   * @param threadID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   * @param ID The id of the instance to search for.
   *
   * @example
   * Find and cast a known model by instance ID.
   * ```typescript
   * import {Client, ThreadID} from '@textile/threads'
   *
   * interface Astronaut {
   *   name: string
   *   missions: number
   *   _id: string
   * }
   *
   * async function getAstronaut (client: Client, threadID: ThreadID, id: string) {
   *   const astronaut = await client.findByID<Astronaut>(threadID, 'astronauts', id)
   *   return astronaut
   * }
   * ```
   *
   * @example
   * Simple find and return any instance
   * ```typescript
   * import {Client, ThreadID} from '@textile/threads'
   *
   * async function getInstance (client: Client, threadID: ThreadID, id: string) {
   *   return await client.findByID(threadID, 'astronauts', id)
   * }
   * ```
   */
  public async findByID<T = any>(
    threadID: ThreadID,
    collectionName: string,
    ID: string
  ): Promise<Instance<T>> {
    const req = new pb.FindByIDRequest()
    req.setDbid(threadID.toBytes())
    req.setCollectionname(collectionName)
    req.setInstanceid(ID)
    const res = (await this.unary(
      API.FindByID,
      req
    )) as pb.FindByIDReply.AsObject
    const ret: Instance<T> = {
      instance: JSON.parse(
        Buffer.from(res.instance as string, "base64").toString()
      ),
    }
    return ret
  }

  /**
   * readTransaction creates a new read-only transaction object. See ReadTransaction for details.
   * @param threadID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   */
  public readTransaction(
    threadID: ThreadID,
    collectionName: string
  ): ReadTransaction {
    const client = grpc.client(API.ReadTransaction, {
      host: this.serviceHost,
      transport: this.rpcOptions.transport,
      debug: this.rpcOptions.debug,
    }) as grpc.Client<pb.ReadTransactionRequest, pb.ReadTransactionReply>
    return new ReadTransaction(this.context, client, threadID, collectionName)
  }

  /**
   * writeTransaction creates a new writeable transaction object. See WriteTransaction for details.
   * @param threadID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   */
  public writeTransaction(
    threadID: ThreadID,
    collectionName: string
  ): WriteTransaction {
    const client = grpc.client(API.WriteTransaction, {
      host: this.serviceHost,
      transport: this.rpcOptions.transport,
      debug: this.rpcOptions.debug,
    }) as grpc.Client<pb.WriteTransactionRequest, pb.WriteTransactionReply>
    return new WriteTransaction(this.context, client, threadID, collectionName)
  }

  /**
   * listen opens a long-lived connection with a remote node, running the given callback on each new update to the given instance.
   * The return value is a `close` function, which cleanly closes the connection with the remote node.
   * @param threadID the ID of the database
   * @param filters contains an array of Filters
   * @param callback The callback to call on each update to the given instance.
   *
   * @example
   * ```typescript
   * import {Client, ThreadID, Update} from '@textile/threads'
   *
   * interface Astronaut {
   *   name: string
   *   missions: number
   *   _id: string
   * }
   * function setupListener (client: Client, threadID: ThreadID) {
   *   const callback = (update?: Update<Astronaut>) => {
   *     // Not safe if more than the Astronauts collection existed in the same DB
   *     if (!update || !update.instance) return
   *     console.log('New update:', update.instance.name, update.instance.missions)
   *   }
   *   const closer = client.listen(threadID, [], callback)
   *   return closer
   * }
   * ```
   *
   * @example
   * Listen to only CREATE events on a specific Collection.
   * ```typescript
   * import {Client, ThreadID, Update} from '@textile/threads'
   *
   * interface Astronaut {
   *   name: string
   *   missions: number
   *   _id: string
   * }
   * function setupListener (client: Client, threadID: ThreadID) {
   *   const callback = (update?: Update<Astronaut>) => {
   *     if (!update || !update.instance) return
   *     console.log('New update:', update.instance.name, update.instance.missions)
   *   }
   *   const filters = [
   *     {collectionName: 'Astronauts'},
   *     {actionTypes: ['CREATE']}
   *   ]
   *   const closer = client.listen(threadID, filters, callback)
   *   return closer
   * }
   * ```
   */
  public listen<T = any>(
    threadID: ThreadID,
    filters: Filter[],
    callback: (reply?: Update<T>, err?: Error) => void
  ): grpc.Request {
    const req = new pb.ListenRequest()
    req.setDbid(threadID.toBytes())
    for (const filter of filters) {
      const requestFilter = new pb.ListenRequest.Filter()
      if (filter.instanceID) {
        requestFilter.setInstanceid(filter.instanceID)
      } else if (filter.collectionName) {
        requestFilter.setCollectionname(filter.collectionName)
      }
      if (filter.actionTypes) {
        for (const at of filter.actionTypes) {
          switch (at) {
            case "ALL": {
              requestFilter.setAction(pb.ListenRequest.Filter.Action.ALL)
              break
            }
            case "CREATE": {
              requestFilter.setAction(pb.ListenRequest.Filter.Action.CREATE)
              break
            }
            case "SAVE": {
              requestFilter.setAction(pb.ListenRequest.Filter.Action.SAVE)
              break
            }
            case "DELETE": {
              requestFilter.setAction(pb.ListenRequest.Filter.Action.DELETE)
              break
            }
          }
        }
      } else {
        requestFilter.setAction(0)
      }
      req.addFilters(requestFilter)
    }

    const decoder = new TextDecoder()

    const client = grpc.client<pb.ListenRequest, pb.ListenReply, APIListen>(
      API.Listen,
      {
        host: this.serviceHost,
        transport: this.rpcOptions.transport,
        debug: this.rpcOptions.debug,
      }
    )
    client.onMessage((message: pb.ListenReply) => {
      // Pull it apart explicitly
      const instanceString = decoder.decode(message.getInstance_asU8())
      const actionInt = message.getAction()
      const action = (Action[actionInt] as unknown) as Action
      const collectionName = message.getCollectionname()
      const instanceID = message.getInstanceid()

      const ret: Update<T> = {
        collectionName,
        instanceID,
        action,
        instance: undefined,
      }
      if (instanceString !== "") {
        ret.instance = JSON.parse(instanceString)
      }
      callback(ret)
    })

    client.onEnd((
      status: grpc.Code,
      message: string /** trailers: grpc.Metadata */
    ) => {
      if (status !== grpc.Code.OK) {
        callback(undefined, new Error(message))
      }
      callback()
    })

    this.context.toMetadata().then((metadata) => {
      client.start(metadata)
      client.send(req)
      client.finishSend()
    })
    return { close: () => client.close() }
  }

  private async unary<
    TRequest extends grpc.ProtobufMessage,
    TResponse extends grpc.ProtobufMessage,
    M extends grpc.UnaryMethodDefinition<TRequest, TResponse>
  >(methodDescriptor: M, req: TRequest) {
    const metadata = await this.context.toMetadata()
    return new Promise((resolve, reject) => {
      grpc.unary(methodDescriptor, {
        transport: this.rpcOptions.transport,
        debug: this.rpcOptions.debug,
        request: req,
        host: this.serviceHost,
        metadata,
        onEnd: (res) => {
          const { status, statusMessage, message } = res
          if (status === grpc.Code.OK) {
            if (message) {
              resolve(message.toObject())
            } else {
              resolve()
            }
          } else {
            reject(new Error(statusMessage))
          }
        },
      })
    })
  }
}

export default Client
