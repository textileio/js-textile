import toJsonSchema from 'to-json-schema'
import cbor from 'cbor-sync'
import parse from 'url-parse'
import { Network, Client } from '@textile/threads-network'
import { EventEmitter2 } from 'eventemitter2'
import { Dispatcher, Instance, DomainDatastore, Event, Update, Op } from '@textile/threads-store'
import { Datastore, MemoryDatastore, Key } from 'interface-datastore'
import { ThreadID, ThreadRecord, Multiaddr, ThreadInfo, Key as ThreadKey } from '@textile/threads-core'
import { EventBus } from './eventbus'
import { Collection, JSONSchema } from './collection'
import { createThread, decodeRecord, Cache } from './utils'

const metaKey = new Key('meta')
const schemaKey = metaKey.child(new Key('schema'))
const duplicateCollection = new Error('Duplicate collection')

export type Options = {
  dispatcher?: Dispatcher
  eventBus?: EventBus
  network?: Network
}

export class Database {
  /**
   * ThreadID is the id for the thread to use for this
   */
  public threadID?: ThreadID
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
   * Child is the primary datastore, and is used to partition out stores as sub-domains
   */
  public child: DomainDatastore<any>

  public emitter: EventEmitter2 = new EventEmitter2({ wildcard: true })

  /**
   * Database creates a new database using the provided thread.
   * @param datastore The primary datastore, and is used to partition out stores as sub-domains.
   * @param options A set of database options.
   */
  constructor(datastore: Datastore<any> = new MemoryDatastore<any>(), options: Options = {}) {
    this.child = new DomainDatastore(datastore, new Key('db'))
    this.dispatcher =
      options.dispatcher ?? new Dispatcher(new DomainDatastore(datastore, new Key('dispatcher')))
    this.network =
      options.network ??
      new Network(new DomainDatastore(datastore, new Key('network')), new Client())
    this.eventBus =
      options.eventBus ??
      new EventBus(new DomainDatastore(this.child, new Key('eventbus')), this.network)
  }

  /**
   * fromAddress creates a new database from a thread hosted by another peer.
   * @param addr The address for the thread with which to connect.
   * Should be of the form /ip4/<url/ip-address>/tcp/<port>/p2p/<peer-id>/thread/<thread-id>
   * @param threadKey Set of symmetric keys.
   * @param datastore The primary datastore, and is used to partition out stores as sub-domains.
   * @param options A set of database options.
   */
  static async fromAddress(
    addr: Multiaddr,
    threadKey?: ThreadKey,
    datastore: Datastore<any> = new MemoryDatastore<any>(),
    options: Options = {},
  ) {
    const db = new Database(datastore, options)
    const info = await db.network.addThread(addr, { threadKey })
    await db.open(info.id)
    await db.network.pullThread(info.id)
    return db
  }

  @Cache()
  async ownLogInfo() {
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
    if (!this.threadID?.defined()) {
      await this.open()
    }
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
   * Open the database.
   * Opens the underlying datastore if not already open, and enables the dispatcher and
   * underlying services (event bus, network network, etc). If threadID is undefined, and the
   * database was already bootstrapped on a thread, it will continue using that thread. In the
   * opposite case, it will create a new thread. If threadID is provided, and the database was
   * not bootstrapped on an existing thread, it will attempt to use the provided threadID,
   * otherwise, a thread id mismatch error is thrown.
   */
  async open(threadID?: ThreadID) {
    await this.child.open()
    const idKey = metaKey.child(new Key('threadid'))
    const hasExisting = await this.child.has(idKey)

    if (threadID === undefined) {
      if (hasExisting) {
        this.threadID = ThreadID.fromBytes(await this.child.get(idKey))
      } else {
        const info = await createThread(this.network)
        await this.child.put(idKey, info.id.bytes())
        this.threadID = info.id
      }
    } else {
      if (hasExisting) {
        const existing = ThreadID.fromBytes(await this.child.get(idKey))
        if (!existing.equals(threadID)) {
          throw new Error('Thread id mismatch')
        }
        this.threadID = existing
      } else {
        let info: ThreadInfo
        try {
          info = await this.network.getThread(threadID)
        } catch (_err) {
          info = await createThread(this.network, threadID)
        }
        await this.child.put(idKey, info.id.bytes())
        this.threadID = info.id
      }
    }
    await this.rehydrate()
    await this.eventBus.start(this.threadID)
    this.eventBus.on('record', this.onRecord.bind(this))
  }

  /**
   * Return db (remote) address and keys.
   */
  async getInfo() {
    if (this.threadID !== undefined) {
      const info = await this.network.getThread(this.threadID)
      const hostID = await this.network.getHostID()
      // This is the only address we know about... and the port is wrong
      const hostAddr = Multiaddr.fromNodeAddress(parse(this.network.client.config.host), 'tcp')
      const pa = new Multiaddr(`/p2p/${hostID.toB58String()}`)
      const ta = new Multiaddr(`/thread/${info.id.string()}`)
      const full = hostAddr.encapsulate(pa.encapsulate(ta))
      return {
        dbKey: info.key,
        addresses: [ full.toString() ]
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
    await this.child.close()
    // @todo: Should we also 'close' the dispatcher?
    return
  }

  private async onRecord(rec: ThreadRecord) {
    if (this.threadID?.equals(rec.threadID)) {
      const logInfo = await this.network.getOwnLog(this.threadID, false)
      if (logInfo?.id.equals(rec.logID)) {
        return // Ignore our own events since DB already dispatches to DB reducers
      }
      // @todo Should just cache this information, as its unlikely to change
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
    const id = this.threadID?.bytes()
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
      this.emitter.emit(event, update)
    }
  }

  private async rehydrate() {
    const it = this.child.query({ prefix: schemaKey.toString() })
    for await (const { key, value } of it) {
      await this.newCollection(key.name(), cbor.decode(value) as JSONSchema)
    }
  }
}
