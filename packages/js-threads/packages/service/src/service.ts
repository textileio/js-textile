import { keys, PrivateKey, PublicKey, randomBytes } from 'libp2p-crypto'
import CID from 'cids'
import log from 'loglevel'
import {
  Block,
  Closer,
  Key,
  KeyOptions,
  LogID,
  LogInfo,
  LogRecord,
  Multiaddr,
  Service as Interface,
  ThreadID,
  ThreadRecord,
} from '@textile/threads-core'
import { createEvent, createRecord } from '@textile/threads-encoding'
import { Client } from '@textile/threads-service-client'
import { Datastore } from 'interface-datastore'
import PeerId from 'peer-id'
import { LogStore } from './store'

const logger = log.getLogger('service')

/**
 * Service is the Network interface for Thread orchestration.
 */
export class Service implements Interface {
  public store: LogStore
  /**
   * Create a new network Service.
   * @param store The store to use for caching keys and log information.
   * @param client A client connected to a remote service peer.
   */
  constructor(store: LogStore | Datastore, readonly client: Client) {
    this.store = store instanceof LogStore ? store : LogStore.fromDatastore(store)
  }

  /**
   * getHostID returns the service's (remote) host peer ID.
   */
  async getHostID() {
    return this.client.getHostID()
  }

  /**
   * createThread with id.
   * This will overwrite any existing thread information.
   * @param id The Thread id.
   * @param opts The set of keys to use when creating the Thread. All keys are "optional", though if no replicator key
   * is provided, one will be created. Similarly, if no log key is provided, then the "host" Peer ID will be used.
   * If no ReadKey is provided, the service will be unable to write records (but it may be able to return records).
   */
  async createThread(id: ThreadID, opts: KeyOptions = {}) {
    const logInfo = await this.deriveLogKeys(opts.logKey)
    // Don't send along readKey, or log's privKey information
    const threadKey = opts.threadKey || Key.fromRandom()
    const newOpts: KeyOptions = {
      threadKey: new Key(threadKey.service),
      logKey: logInfo.pubKey,
    }
    const info = await this.client.createThread(id, newOpts)
    // Now we want to store or create read key
    info.key = new Key(threadKey.service, threadKey.read || randomBytes(32))
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
  async addThread(addr: Multiaddr, opts: KeyOptions) {
    const logInfo = await this.deriveLogKeys(opts.logKey)
    // Don't send along readKey, or log's privKey information
    const threadKey = opts.threadKey
    if (threadKey === undefined) throw new Error('Missing Thread key(s)')
    const newOpts: KeyOptions = {
      threadKey: new Key(threadKey.service),
      logKey: logInfo.pubKey,
    }
    const info = await this.client.addThread(addr, newOpts)
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
    logger.debug(`pulling thread ${id.string()}`)
    // @note: Not need to worry about safety here, the remote peer will handle that for us.
    return this.client.pullThread(id)
  }

  /**
   * deleteThread with id.
   * @param id The Thread ID.
   */
  async deleteThread(id: ThreadID): Promise<void> {
    return this.client.deleteThread(id)
  }

  /**
   * addReplicator to a thread.
   * @param id The Thread ID.
   * @param addr The multiaddress of the replicator peer.
   */
  async addReplicator(id: ThreadID, addr: Multiaddr) {
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
    if (info.key.read === undefined) throw new Error('Missing service key.')
    const event = await createEvent(block, info.key.read)
    if (!logInfo.privKey) throw new Error('Missing private key.')
    // If we have head information for this log, use head CID
    const prev = logInfo.heads?.size ? Array.from(logInfo.heads).shift() : undefined
    const record = await createRecord(event, logInfo.privKey, info.key.service, prev)
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
  subscribe(cb: (rec?: ThreadRecord, err?: Error) => void, ...threads: ThreadID[]): Closer {
    return this.client.subscribe(cb, ...threads)
  }

  async deriveLogKeys(key?: PublicKey | PrivateKey) {
    let pubKey: PublicKey
    let privKey: PrivateKey | undefined
    if (!key) {
      privKey = await keys.supportedKeys.ed25519.generateKeyPair()
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
