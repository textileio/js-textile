import toJsonSchema from 'to-json-schema'
import cbor from 'cbor-sync'
import { Network, Client } from '@textile/threads-network'
import { Context, UserAuth, defaultHost } from '@textile/context'
import { EventEmitter2 } from 'eventemitter2'
import { Dispatcher, Instance, DomainDatastore, Event, Update, Op } from '@textile/threads-store'
import { Datastore, Key } from 'interface-datastore'
import {
  ThreadID,
  ThreadRecord,
  ThreadInfo,
  ThreadKey,
  Multiaddr,
  Identity,
  Libp2pCryptoIdentity,
  LogInfo,
} from '@textile/threads-core'
import LevelDatastore from 'datastore-level'
import { EventBus } from './eventbus'
import { Collection, JSONSchema, Config } from './collection'
import { createThread, decodeRecord, Cache } from './utils'

const metaKey = new Key('meta')
const schemaKey = metaKey.child(new Key('schema'))
const duplicateCollection = new Error('Duplicate collection')

export const mismatchError = new Error(
  'Input ThreadID does not match existing database ThreadID. Consider creating new database or use a matching ThreadID.',
)
export const missingIdentity = new Error(
  'Identity required. You may use Database.randomIdentity() to generate a new one, but see caveats in docs.',
)

/**
 * DatabaseSettings specifies a set of settings to constrol the operation of the Database.
 * Implementations should provide reasonable defaults.
 */
export interface DatabaseSettings {
  /**
   * Dispatcher is used to dispatch local events from producers to reducers (collections).
   * This option should generally be left undefined to use defaults.
   */
  dispatcher: Dispatcher
  /**
   * EventBus is used to marshal events to and from a Threads network.
   * This option should generally be left undefined to use defaults.
   */
  eventBus: EventBus
  /**
   * Network is the networking layer. Can be used to provide a custom networking configuration.
   */
  network: Network
  /**
   * The primary datastore. It is used to partition out "sub-domains" for collections.
   * By default, this will be a LevelDatastore.
   */
  child: Datastore<any>
}

export interface StartOptions {
  /**
   * An array of Collection Config objects to use when initializing the Database
   */
  collections?: Config[]
  /**
   * The ID of the Thread to use for this database. If specified for a new database,
   * a Thread with the given ID will be used to orchestrate the database. If accessing an existing
   * database by name, this should be left undefined.
   */
  threadID?: ThreadID
}

export class Database extends EventEmitter2 implements DatabaseSettings {
  /**
   * Collections is a map of collections (database tables)
   */
  public collections: Map<string, Collection> = new Map()
  /**
   * Network is the networking layer
   */
  public network: Network
  /**
   * EventBus is used to marshal events to and from a Threads network
   */
  public eventBus: EventBus
  /**
   * Dispatcher is used to dispatch local events from producers to reducers (collections)
   */
  public dispatcher: Dispatcher
  /**
   * Child is the primary datastore. It is used to partition out "sub-domains" for collections.
   */
  public child: DomainDatastore<any>
  /**
   * The ID of the Thread to use for this database.
   */
  public threadID?: ThreadID

  /**
   * Database creates a new database using the provided thread.
   * @param datastore The primary datastore or a name for a datastore.
   * It is used to partition out "sub-domains" for collections.
   * @param options A set of database options.
   * These are used to control the operation of the underlying database.
   */
  constructor(store: Datastore<any> | string, options: Partial<DatabaseSettings> = {}) {
    super({ wildcard: true })
    const datastore = typeof store === 'string' ? new LevelDatastore(store) : store
    this.child = new DomainDatastore(datastore, new Key('db'))
    this.dispatcher =
      options.dispatcher ?? new Dispatcher(new DomainDatastore(datastore, new Key('dispatcher')))
    if (options.network === undefined) {
      const client = new Client()
      this.network = new Network(new DomainDatastore(datastore, new Key('network')), client)
    } else {
      this.network = options.network
    }
    this.eventBus =
      options.eventBus ??
      new EventBus(new DomainDatastore(this.child, new Key('eventbus')), this.network)
  }

  /**
   * Create a new network connected instance from a supplied user auth object.
   * @param auth The user auth object.
   */
  static withUserAuth(
    auth: UserAuth,
    store: Datastore,
    options?: Partial<DatabaseSettings>,
    host = defaultHost,
    debug = false,
  ) {
    const context = Context.fromUserAuth(auth, host, debug)
    const client = new Client(context)
    const network = new Network(store, client)
    const opts: Partial<DatabaseSettings> = {
      ...options,
      network,
    }
    return new Database(store, opts)
  }

  @Cache({ duration: 1800000 })
  async ownLogInfo(): Promise<LogInfo | undefined> {
    return this.threadID && this.network.getOwnLog(this.threadID, false)
  }

  /**
   * newCollectionFromObject creates a new collection from an initial input object.
   * It will attempt to infer the JSON schema from the input object.
   * @param name A name for the collection.
   * @param data A valid JSON object.
   */
  newCollectionFromObject<T extends Instance>(name: string, data: T) {
    const schema = toJsonSchema(data) as JSONSchema
    return this.newCollection<T>(name, schema)
  }

  /**
   * newCollection creates a new empty collection from an input JSON schema.
   * @param name A name for the collection.
   * @param schema A valid JSON schema object.
   */
  async newCollection<T extends Instance>(name: string, schema: JSONSchema) {
    if (this.collections.has(name)) {
      throw duplicateCollection
    }
    const key = schemaKey.instance(name)
    const exists = await this.child.has(key)
    if (!exists) {
      await this.child.put(key, cbor.encode(schema))
    }
    const { dispatcher, child } = this
    const collection = new Collection<T>(name, schema, { child, dispatcher })
    collection.child.on('update', this.onUpdate.bind(this))
    collection.child.on('events', this.onEvents.bind(this))
    this.collections.set(name, collection)
    return collection
  }

  /**
   * Open (and sync) a remote database.
   * Opens the underlying datastore if not already open, and enables the dispatcher and
   * underlying services (event bus, network network, etc). This method will also begin pulling
   * from the underlying remote Thread. Only one of `start` or `startFromAddress` should be used.
   * @param identity An identity to use for creating records in the database. A random identity
   * can be created with `Database.randomIdentity()`, however, it is not easy/possible to migrate
   * identities after the fact. Please store or otherwise persist any identity information
   * if you wish to retrieve user data later, or use an external identity provider.
   * @param addr The address for the thread with which to connect.
   * Should be of the form /ip4/<url/ip-address>/tcp/<port>/p2p/<peer-id>/thread/<thread-id>
   * @param threadKey Set of symmetric keys.
   * @param opts A set of options to configure the setup and usage of the underlying database.
   */
  async startFromAddress(
    identity: Identity,
    addr: Multiaddr,
    threadKey?: ThreadKey,
    opts: StartOptions = {},
  ) {
    if (identity === undefined) {
      throw missingIdentity
    }
    await this.network.getToken(identity)
    await this.child.open()
    const idKey = metaKey.child(new Key('threadid'))
    const hasExisting = await this.child.has(idKey)
    if (hasExisting) {
      throw mismatchError
    }
    const info = await this.network.addThread(addr, { threadKey })
    await this.child.put(idKey, info.id.toBytes())
    this.threadID = info.id
    for (const { name, schema } of (opts.collections || []).values()) {
      await this.newCollection(name, schema)
    }
    await this.eventBus.start(this.threadID)
    this.eventBus.on('record', this.onRecord.bind(this))
    if (this.threadID) this.network.pullThread(this.threadID) // Don't await
  }

  /**
   * Open the database.
   * Opens the underlying datastore if not already open, and enables the dispatcher and
   * underlying services (event bus, network network, etc).
   * @param identity An identity to use for creating records in the database. A random identity
   * can be created with `Database.randomIdentity()`, however, it is not easy/possible to migrate
   * identities after the fact. Please store or otherwise persist any identity information
   * if you wish to retrieve user data later, or use an external identity provider.
   * @param opts A set of options to configure the setup and usage of the underlying database.
   */
  async start(identity: Identity, opts: StartOptions = {}) {
    if (identity === undefined) {
      throw missingIdentity
    }
    await this.network.getToken(identity)
    await this.child.open()
    const idKey = metaKey.child(new Key('threadid'))
    const hasExisting = await this.child.has(idKey)

    if (opts.threadID === undefined) {
      if (hasExisting) {
        this.threadID = ThreadID.fromBytes(await this.child.get(idKey))
      } else {
        const info = await createThread(this.network)
        await this.child.put(idKey, info.id.toBytes())
        this.threadID = info.id
      }
    } else {
      if (hasExisting) {
        const existing = ThreadID.fromBytes(await this.child.get(idKey))
        if (!existing.equals(opts.threadID)) {
          throw mismatchError
        }
        this.threadID = existing
      } else {
        let info: ThreadInfo
        try {
          info = await this.network.getThread(opts.threadID)
        } catch (_err) {
          info = await createThread(this.network, opts.threadID)
        }
        await this.child.put(idKey, info.id.toBytes())
        this.threadID = info.id
      }
    }
    await this.rehydrate()
    // Now that we have re-hydrated any existing collections, add the ones specified here
    for (const { name, schema } of (opts.collections || []).values()) {
      await this.newCollection(name, schema)
    }
    await this.eventBus.start(this.threadID)
    this.eventBus.on('record', this.onRecord.bind(this))
    if (this.threadID) this.network.pullThread(this.threadID) // Don't await
  }

  /**
   * Return db (remote) address and keys.
   */
  async getInfo() {
    if (this.threadID !== undefined) {
      const info = await this.network.getThread(this.threadID)
      return {
        key: info.key,
        addrs: info.addrs,
      }
    }
  }

  /**
   * Close and stop the database.
   * Stops the underlying datastore if not already stopped, and disables the dispatcher and
   * underlying services (event bus, network network, etc.)
   */
  async close() {
    this.collections.clear()
    await this.eventBus.stop()
    return this.child.close()
  }

  private async onRecord(rec: ThreadRecord) {
    if (this.threadID?.equals(rec.threadID)) {
      const logInfo = await this.network.getOwnLog(this.threadID, false)
      if (logInfo?.id.equals(rec.logID)) {
        return // Ignore our own events since DB already dispatches to DB reducers
      }
      // @todo should just cache this information, as its unlikely to change
      const info = await this.network.getThread(this.threadID)
      const value: Event | undefined = decodeRecord(rec, info)
      if (value !== undefined) {
        const collection = this.collections.get(value.collection)
        if (collection !== undefined) {
          const key = collection.child.prefix.child(new Key(value.id))
          await this.dispatcher.dispatch({ key, value })
        }
      }
    }
  }

  private async onEvents(...events: Event[]) {
    const id = this.threadID?.toBytes()
    if (id !== undefined) {
      for (const body of events) {
        await this.eventBus.push({ id, body })
      }
    }
  }

  private async onUpdate<T extends Instance>(...updates: Update<Op<T>>[]) {
    for (const update of updates) {
      // Event name: <collection>.<id>.<type>
      const event: string[] = [update.collection, update.id]
      if (update.type !== undefined) {
        event.push(update.type.toString())
      }
      this.emit(event, update)
    }
  }

  private async rehydrate() {
    const it = this.child.query({ prefix: schemaKey.toString() })
    for await (const { key, value } of it) {
      await this.newCollection(key.name(), cbor.decode(value) as JSONSchema)
    }
  }

  /**
   * Create a random user identity.
   */
  static async randomIdentity() {
    return Libp2pCryptoIdentity.fromRandom()
  }
}
