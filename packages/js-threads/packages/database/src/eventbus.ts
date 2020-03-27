import { Datastore } from 'interface-datastore'
import { Service } from '@textile/threads-service'
import { ThreadID, ThreadRecord, Closer } from '@textile/threads-core'
import retry, { Options } from 'async-retry'
import merge from 'deepmerge'
import log from 'loglevel'
import { EventEmitter } from 'tsee'
import { Queue, Job } from './queue'

const logger = log.getLogger('store:eventbus')

const retryOpts: Options = {
  retries: 5,
  onRetry: err => logger.warn(`create record failed (${err.message}), retrying...`),
}

export type Events = {
  record: (rec: ThreadRecord) => void
}

export type EventJob<T> = { id: Buffer; body: T }

export class EventBus<T = any> extends EventEmitter<Events> {
  isStarted = false
  private closer?: Closer
  public queue: Queue<EventJob<T>>
  constructor(
    queue: Queue<EventJob<T>> | Datastore<any>,
    public service: Service,
    opts: Options = {},
  ) {
    super()
    this.queue = queue instanceof Queue ? queue : new Queue(queue)
    this.queue.on('next', async (task?: Job<EventJob<T>>) => {
      if (task === undefined) return
      const { job } = task
      const { id, body } = job
      const threadID = ThreadID.fromBytes(id)
      try {
        await retry(async (_bail, _num) => {
          // @todo: We could use bail here to bail if the service errors out with a 'headers closed error'
          // This would mean that the gRPC service isn't running, i.e., we are in 'offline' mode
          await this.service.createRecord(threadID, body)
          // @todo: Add debugging outputs here
          return this.queue.done()
        }, merge(retryOpts, opts))
      } catch (err) {
        // Skip it for now, we've already retried
        this.queue.done(true)
      }
    })
  }

  private serviceWatcher(id?: ThreadID, start = true) {
    if (start) {
      const func = async (rec?: ThreadRecord) => {
        if (rec) this.emit('record', rec)
      }
      this.closer = id ? this.service.subscribe(func, id) : this.service.subscribe(func)
    } else if (this.closer) {
      return this.closer.close()
    }
  }

  async start(id?: ThreadID) {
    this.isStarted = true
    await this.queue.open()
    this.serviceWatcher(id)
    return this.queue.start()
  }

  async stop() {
    this.isStarted = false
    this.serviceWatcher(undefined, false)
    this.queue.stop()
    await this.queue.close()
  }

  /**
   * Push an event onto to the queue
   * @param event Object to be serialized and pushed to queue via JSON.stringify().
   */
  push(event: EventJob<T>) {
    return this.queue.push(event)
  }
}
