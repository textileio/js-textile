import { keys, PrivateKey, PublicKey, randomBytes } from 'libp2p-crypto'
import CID from 'cids'
import log from 'loglevel'
import {
  Block,
  Closer,
  ThreadKey,
  LogID,
  LogInfo,
  LogRecord,
  Multiaddr,
  Network as Interface,
  ThreadID,
  ThreadRecord,
  ThreadInfo,
  Identity,
  NewThreadOptions,
} from '@textile/threads-core'
import { createEvent, createRecord } from '@textile/threads-encoding'
import { Client } from '@textile/threads-network-client'
import { Datastore } from 'interface-datastore'
import PeerId from 'peer-id'
import { LogStore } from './store'

const logger = log.getLogger('network')

const ed25519 = keys.supportedKeys.ed25519

/**
 * Network is the Network interface for Thread orchestration.
 */
export class Network implements Interface {
  public store: LogStore
  /**
   * Create a new network Network.
   * @param store The store to use for caching keys and log information.
   * @param client A client connected to a remote network peer.
   * @param identity Identity represents an entity with a public key capable of signing a message.
   * @note If an identity is not provided, the a random PKI identity is used. This might not be what you want!
   * It is not easy/possible to migrate identities after the fact. Please supply an identity argument if
   * you wish to persist/retrieve user data later.
   */
  constructor(store: LogStore | Datastore, readonly client: Client, public identity?: Identity) {
    this.store = store instanceof LogStore ? store : LogStore.fromDatastore(store)
  }

  /**
   * Obtain a token for interacting with the remote network API. Will attempt to return a cached token if available.
   * @param identity The generic identity to use for signing and validation. Will default to the  identity specified
   * at construction if available, otherwise a new Identity is required here.
   */
  async getToken(identity: Identity | undefined = this.identity): Promise<string> {
    const existing: string | undefined = this.client.context.get('authorization')
    if (existing !== undefined) return existing
    if (identity === undefined) throw new Error('Identity required.')
    this.identity = identity
    return this.client.getToken(identity)
  }

  /**
   * getHostID returns the network's (remote) host peer ID.
   */
  async getHostID(): Promise<PeerId> {
    return this.client.getHostID()
  }

  /**
   * createThread with id.
   * This will overwrite any existing thread information.
   * @param id The Thread id.
   * @param opts The set of keys to use when creating the Thread. All keys are "optional", though if no replicator key
   * is provided, one will be created. Similarly, if no log key is provided, then the "host" Peer ID will be used.
   * If no ReadKey is provided, the network will be unable to write records (but it may be able to return records).
   */
  async createThread(id: ThreadID, opts?: NewThreadOptions) {
    const logInfo = await this.deriveLogKeys(opts?.logKey)
    // Don't send along readKey, or log's privKey information
    const threadKey = opts?.threadKey || ThreadKey.fromRandom()
    const newOpts: NewThreadOptions = {
      threadKey: new ThreadKey(threadKey.service),
      logKey: logInfo.pubKey,
    }
    const info: ThreadInfo = await this.client.createThread(id, newOpts)
    // Now we want to store or create read key
    info.key = new ThreadKey(threadKey.service, threadKey.read || randomBytes(32))
    logger.debug('caching thread + log information')
    await this.store.addThread(info)
    await this.store.addLog(id, logInfo)
    return info
  }

  /**
   * addThread from a multiaddress.
   * @param addr The Thread multiaddress.
   * @param opts The set of keys to use when adding the Thread.
   */
  async addThread(addr: Multiaddr, opts?: NewThreadOptions) {
    const logInfo = await this.deriveLogKeys(opts?.logKey)
    // Don't send along readKey, or log's privKey information
    const threadKey = opts?.threadKey
    if (threadKey === undefined) throw new Error('Missing Thread key(s)')
    const newOpts: NewThreadOptions = {
      threadKey: new ThreadKey(threadKey.service),
      logKey: logInfo.pubKey,
    }
    const info: ThreadInfo = await this.client.addThread(addr, newOpts)
    // Now we want to store full key information
    info.key = threadKey
    logger.debug('caching thread + log information')
    await this.store.addThread(info)
    await this.store.addLog(info.id, logInfo)
    return info
  }

  /**
   * getThread with id.
   * @param id The Thread ID.
   */
  async getThread(id: ThreadID) {
    const info = await this.client.getThread(id)
    // Merge local thread info with remote thread info
    const local = await this.store.threadInfo(id)
    return { ...info, ...local }
  }

  /**
   * pullThread for new records.
   * Logs owned by this host are traversed on the (possibly remote) network client. Remotely addressed logs are pulled
   * from the network on the (possible remote) client and forwarded to this peer.
   * @param id The Thread ID.
   */
  async pullThread(id: ThreadID) {
    logger.debug(`pulling thread ${id.toString()}`)
    // @note: Not need to worry about safety here, the remote peer will handle that for us.
    return this.client.pullThread(id)
  }

  /**
   * deleteThread with id.
   * @param id The Thread ID.
   */
  async deleteThread(id: ThreadID) {
    await this.client.deleteThread(id)
    return this.store.deleteThread(id)
  }

  /**
   * addReplicator to a thread.
   * @param id The Thread ID.
   * @param addr The multiaddress of the replicator peer.
   */
  async addReplicator(id: ThreadID, addr: Multiaddr): Promise<PeerId> {
    return this.client.addReplicator(id, addr)
  }

  /**
   * createRecord with body.
   * @param id The Thread ID.
   * @param body The body to add as content.
   */
  async createRecord(id: ThreadID, body: any) {
    const block = Block.encoder(body, 'dag-cbor')
    const info = await this.getThread(id)
    // Get (or create a new set of) log keys
    const logInfo = await this.getOwnLog(id, true)
    if (info.key === undefined) throw new Error('Missing key info.')
    if (info.key.read === undefined) throw new Error('Missing network key.')
    const event = await createEvent(block, info.key.read)
    if (!logInfo.privKey) throw new Error('Missing private key.')
    // If we have head information for this log, use head CID
    const prev = logInfo.head
    // Use supplied identity if available, otherwise, default to log private key
    // Using log private key assumes the log owner is also the identity owner, which might not always be the case.
    // In most cases, there _will_ be an available identity because it is required for `getToken`.
    const pubKey = this.identity?.public ?? logInfo.privKey.public
    const record = await createRecord(event, {
      privKey: logInfo.privKey,
      servKey: info.key.service,
      prev,
      pubKey,
    })
    await this.client.addRecord(id, logInfo.id, record)
    const res: ThreadRecord = {
      record,
      threadID: id,
      logID: logInfo.id,
    }
    return res
  }

  /**
   * addRecord to the given log.
   * @param id The Thread ID.
   * @param logID The Log ID.
   * @param rec The log record to add.
   */
  async addRecord(id: ThreadID, logID: LogID, rec: LogRecord) {
    await this.client.addRecord(id, logID, rec)
  }

  /**
   * getRecord returns the record at cid.
   * @param id The Thread ID.
   * @param rec The record's CID.
   */
  async getRecord(id: ThreadID, rec: CID) {
    return this.client.getRecord(id, rec)
  }

  /**
   * subscribe to new record events in the given threads.
   * @param cb The callback to call on each new thread record.
   * @param threads The variadic set of threads to subscribe to.
   */
  subscribe(cb: (rec?: ThreadRecord, err?: Error) => void, threads: ThreadID[] = []): Closer {
    return this.client.subscribe(cb, threads)
  }

  /**
   * deriveLogKeys returns a set of log keys from the given inputs.
   * @param key Optional public or private log key.
   */
  async deriveLogKeys(key?: PublicKey | PrivateKey) {
    let pubKey: PublicKey
    let privKey: PrivateKey | undefined
    if (!key) {
      privKey = await ed25519.generateKeyPair()
      pubKey = privKey.public
    } else if ((key as PrivateKey).public) {
      privKey = key as PrivateKey
      pubKey = privKey.public
    } else {
      pubKey = key as PublicKey
    }
    const info: LogInfo = {
      id: await PeerId.createFromPubKey(pubKey.bytes),
      privKey,
      pubKey,
    }
    return info
  }

  /**
   * getOwnLog returns the local peers log. If the given log does not yet exist and create is true, a new log is
   * created, otherwise (i.e., if create is false), undefined is returned.
   * @param id
   * @param create
   */
  async getOwnLog(id: ThreadID, create?: true): Promise<LogInfo>
  async getOwnLog(id: ThreadID, create?: false): Promise<LogInfo | undefined>
  async getOwnLog(id: ThreadID, create?: boolean): Promise<LogInfo | undefined> {
    const info = await this.getThread(id)
    const logs = info.logs || new Set()
    for (const log of logs.values()) {
      const local = await this.store.logInfo(id, log.id)
      const merged = { ...log, ...local }
      if (merged.privKey) return merged
    }
    if (create) {
      return this.deriveLogKeys()
    }
    return
  }
}
