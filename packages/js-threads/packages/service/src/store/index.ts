import { Datastore, Key } from 'interface-datastore'
import { ThreadID, LogInfo, ThreadInfo, LogID, Key as ThreadKey } from '@textile/threads-core'
import { KeyBook } from './keybook'

export class LogStore {
  constructor(public keys: KeyBook) {}
  static fromDatastore(store: Datastore<Buffer>) {
    return new LogStore(new KeyBook(store))
  }

  async close() {
    await this.keys.close()
    return
  }

  /**
   * Threads returns all threads in the store.
   */
  async threads() {
    const threads = await this.keys.threads()
    return threads
  }

  /**
   * Logs returns all logs under the given thread.
   * @param id Thread ID.
   */
  async logs(id: ThreadID): Promise<Set<LogID>> {
    const logs = await this.keys.logs(id)
    return logs
  }

  /**
   * AddThread adds a thread with keys.
   * @param info Thread information.
   */
  async addThread(info: ThreadInfo) {
    if (info.key?.service === undefined) {
      throw new Error('Service key required')
    }
    await this.keys.addServiceKey(info.id, info.key.service)
    info.key.read && (await this.keys.addReadKey(info.id, info.key.read))
  }

  /**
   * threadInfo returns info about a thread.
   * @param id Thread ID.
   */
  async threadInfo(id: ThreadID) {
    const service = await this.keys.serviceKey(id)
    if (service === undefined) throw new Error('Missing service key')
    const read = await this.keys.readKey(id)
    const key = new ThreadKey(service, read)
    const info: ThreadInfo = {
      id,
      key,
    }
    return info
  }

  /**
   * addLog adds a log to a thread.
   * @param id Thread ID.
   * @param info Log information.
   */
  async addLog(id: ThreadID, info: LogInfo) {
    if (info.pubKey) await this.keys.addPubKey(id, info.id, info.pubKey)
    if (info.privKey) await this.keys.addPrivKey(id, info.id, info.privKey)
    return
  }

  /**
   * logInfo returns info about a given log.
   * @param id The Thread ID.
   * @param log The Log ID.
   */
  async logInfo(id: ThreadID, log: LogID) {
    const privKey = await this.keys.privKey(id, log)
    const pubKey = (await this.keys.pubKey(id, log)) || privKey?.public
    const info: LogInfo = {
      id: log,
      privKey,
      pubKey,
    }
    return info
  }
}
