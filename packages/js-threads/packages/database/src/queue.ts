import { decode, encode } from "cbor-sync"
import {
  Datastore,
  Key,
  MemoryDatastore,
  Query,
  Result,
} from "interface-datastore"
import log from "loglevel"
import { collect, map, reduce } from "streaming-iterables"
import { EventEmitter } from "tsee"
import { ulid } from "ulid"

const logger = log.getLogger("store:queue")

const notOpenError = new Error("Database not open")

export interface Job<T> {
  id: string
  job: T
}

/**
 * Events for Queue's EventEmitter
 */
type Events<T> = {
  start: () => void
  trigger_next: (index?: number) => void
  stop: () => void
  next: (task: Job<T>) => void
  empty: () => void
  push: (task: Job<T>) => void
  open: (store: Datastore<Buffer>) => void
  close: () => void
  delete: (id: string) => void
  error: (err: Error) => void
}

/**
 * Persistent queue for running many short tasks.
 * Based on https://github.com/damoclark/node-persistent-queue
 */
export class Queue<T = any> extends EventEmitter<Events<T>> {
  /**
   * Instance variable for whether the queue is empty (not known at instantiation).
   */
  private _empty? = false

  /**
   * The queue of objects to operate on
   */
  private _queue: any[] = []

  /**
   * Total number of jobs left to run.
   */
  private _length = 0

  /**
   * Whether the queue's Datastore is open.
   */
  private _opened = false

  /**
   * Whether the queue should process messages.
   */
  public run = false

  /**
   *
   * @param store The underlying persistent Datastore.
   * @param batchSize How many objects to retrieve from DB into queue array at a time.
   */
  constructor(
    public store: Datastore<Buffer> = new MemoryDatastore(),
    public batchSize: number = 10
  ) {
    super()

    if (batchSize < 1) throw new Error("Invalid batch size")

    this.on("trigger_next", (index = 0) => {
      logger.debug("on.trigger_next")
      // Check state of queue
      if (!this.run || this.isEmpty) {
        logger.debug("run=" + this.run + " and empty=" + this.isEmpty)
        logger.debug("not started or empty queue")
        // If queue not started or is empty, then just return
        return
      }

      // Define our embedded recursive function to be called later
      const trigger = () => {
        this.emit("next", this._queue[index])
      }

      // If our in-memory list is empty, but queue is not, re-hydrate from db
      if (this._queue.length === 0 && this.length !== 0) {
        this.hydrateQueue()
          .then(() => {
            // Schedule job for next check phase in event loop
            setImmediate(trigger)
          })
          .catch((err) => {
            this.emit("error", err)
            console.error(err)
          })
      } else if (this._queue.length) {
        // If in-memory queue not empty, trigger next job
        // https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/
        setImmediate(trigger)
      } else {
        // Otherwise queue is empty
        this._empty = true
        this.emit("empty")
      }
    })

    // If a job is pushed, trigger_next event
    this.on("push", (/** job */) => {
      if (this.isEmpty) {
        this._empty = false
        logger.debug("No longer empty")
        if (this.run) this.emit("trigger_next")
      }
    })
  }

  get length(): number | undefined {
    if (this.isOpen) return this._length
  }

  /**
   * Open persistent storage.
   */
  async open(): Promise<Array<Job<T>>> {
    await this.store.open()
    this._opened = true
    await this.countQueue()
    const jobs = await this.hydrateQueue()
    // If no msg left, set empty to true (but don't emit event)
    this._empty = this._queue.length === 0
    this.emit("open", this.store)
    return jobs
  }

  /**
   * Close persistent storage.
   */
  async close(): Promise<void> {
    await this.store.close()
    this._opened = false
    this._empty = undefined
    this.run = false
    this._queue = []
    this.emit("close")
    return
  }

  /**
   * Start processing the queue.
   */
  start(): void {
    this.emit("start")
    if (!this.isOpen) throw notOpenError
    if (this.run === false) {
      this.run = true
      this.emit("trigger_next")
    }
  }

  /**
   * Stop processing the queue
   */
  stop(): void {
    this.run = false
    this.emit("stop")
  }

  /**
   * Calling done indicates that the current job is complete (or failed).
   * Generally called from within a 'next' event handler when finished.
   * It will remove the current job from the persistent queue and emit another 'next' event.
   * @param skip Whether to temporarily skip the (probably failed job). If true (default is false) the current job is
   * dropped from the in-memory queue, but will be re-hydrated from persistent storage once the current batch of jobs
   * are complete. Useful to keep a single job from holding up the whole queue, without throwing it out entirely.
   */
  done(skip = false): void {
    if (skip) {
      logger.debug("Skipping job for now.")
      // Skips this job until re-hydration from persistent storage
      this._queue.shift()
      this.emit("trigger_next")
      return
    }
    logger.debug("Calling done.")
    // Remove the job from the queue
    this.removeJob()
      .then(() => {
        logger.debug("Job deleted from db")
        // Decrement our job length
        // @todo: Should this be moved to the actual removeJob method?
        this._length--
        this.emit("trigger_next")
      })
      .catch((err) => {
        this.emit("error", err)
        console.error(err)
      })
  }

  /**
   * Called by user from within their 'next' event handler when error occurred and job to remain at head of queue
   * It will leave the current job in the queue and stop the queue
   */
  abort(): void {
    logger.debug("Calling abort!")
    this.stop()
  }

  /**
   * Called by user to push a job to the queue
   * @param job Object to be serialized and pushed to queue as CBOR.
   */
  push(job: T, id: string = ulid()): Promise<string> {
    return new Promise<string>((resolve) => {
      this.store.put(new Key(id), encode(job)).then(() => {
        // Increment our job length
        this._length++
        this.emit("push", { id, job })
        resolve(id)
      })
    })
  }

  /**
   * Control logging level.
   * @param level The logging level to enable.
   */
  setLogLevel(level: log.LogLevelDesc): this {
    logger.setLevel(level)
    return this
  }

  /**
   * Is the persistent storage queue empty
   * @throws If open method hasn't been called first
   * @return True if empty, false if jobs still remain
   */
  get isEmpty(): boolean | undefined {
    if (!this.isOpen) throw notOpenError
    return this._empty
  }

  /**
   * Is the queue started and processing jobs
   * @return True if started, otherwise false
   */
  get isStarted(): boolean {
    return this.run
  }

  /**
   * Is the queue's persistent storage open.
   * @return True if opened, otherwise false
   */
  get isOpen(): boolean {
    return this._opened
  }

  /**
   * Returns true if there is a job with 'id' still in queue, otherwise false
   * @param id The job id to search for
   * @return Promise resolves true if the job id is still in the queue, otherwise false
   */
  has(id: string): Promise<boolean> {
    // First search the in-memory queue as its quick
    return new Promise<boolean>((reject, resolve) => {
      for (let i = 0; i < this._queue.length; i++) {
        if (this._queue[i].id === id) resolve(true)
      }
      // Now check the on-disk queue
      this.store
        .has(new Key(id))
        .then((has) => {
          // Return true if there is a record, otherwise return false
          resolve(has)
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  /**
   * Return an array of job id numbers matching the given job data in order of execution.
   * @param job The job to search for.
   */
  getJobIds(job: T): Promise<string[]> {
    return this.searchQueue(job)
  }

  /**
   * Return an array of job id numbers matching the given job data in order of execution.
   * @param job The job to search for.
   */
  getFirstJobId(job: T): Promise<string> {
    return new Promise<string>((resolve) => {
      // search in-memory queue first, compare as JSON string?
      const jobstr = JSON.stringify(job)
      const i = this._queue.findIndex((j) => {
        return JSON.stringify(j.job) === jobstr
      })
      if (i !== -1) {
        resolve(this._queue[i].id)
        return
      }
      // Otherwise have to search rest of db queue
      this.searchQueue(job).then((data) => {
        if (data.length === 0) {
          resolve(undefined)
          return
        }
        resolve(data[0])
      })
    })
  }

  /**
   * Delete a job from the queue (if it exists).
   * @param id The job id number to delete.
   * @return The id number that was deleted.
   */
  delete(id: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.removeJob(id)
        .then(() => {
          logger.debug("Job deleted from db")
          this.emit("delete", id)
          // Decrement our job length
          this._length--
          resolve(id)
        })
        .catch(reject)
    })
  }

  private countQueue(): Promise<number> {
    logger.debug("CountQueue")
    return new Promise<number>((resolve, reject) => {
      if (!this.isOpen) reject(notOpenError)
      reduce((a /** b */) => a + 1, 0, this.store.query({})).then((count) => {
        this._length = count
        resolve(count)
      })
    })
  }

  private searchQueue(job: T): Promise<Array<string>> {
    logger.debug("SearchQueue")
    const encoded = encode(job)
    return new Promise<Array<string>>((resolve, reject) => {
      if (!this.isOpen) reject(notOpenError)
      const filter: Query.Filter = ({ value }) => value.equals(encoded)
      collect(
        map(
          ({ key }) => key.baseNamespace(),
          this.store.query({ filters: [filter], keysOnly: true })
        )
      )
        .then((jobs) => {
          resolve(jobs)
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  /**
   * This function will load from the database, 'size' number of records into queue array.
   * @param limit How many records to hydrate.
   */
  private hydrateQueue(limit: number = this.batchSize): Promise<Array<Job<T>>> {
    logger.debug("HydrateQueue")
    return new Promise((resolve, reject) => {
      if (!this.isOpen) reject(notOpenError)
      const mapper = ({ key, value }: Result) => {
        return { id: key.baseNamespace(), job: decode(value) }
      }
      collect(map(mapper, this.store.query({ limit })))
        .then((jobs) => {
          // Update our queue array
          this._queue = jobs
          resolve(jobs)
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  /**
   * This function will remove the given or current job from the database and in-memory array.
   * @param id Optional job id number to remove, if omitted, remove current job at front of queue.
   */
  private removeJob(id?: string): Promise<string> {
    if (id === undefined) {
      id = this._queue.shift().id
    } else {
      // Search queue for id and remove if exists
      for (let i = 0; i < this._queue.length; i++) {
        if (this._queue[i].id === id) {
          this._queue.splice(i, 1)
          break
        }
      }
    }

    return new Promise<string>((resolve, reject) => {
      if (!this.isOpen) reject(notOpenError)
      logger.debug("Removing job: " + id)
      logger.debug("With queue length: " + this.length)

      this.store
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        .delete(new Key(id!))
        .then(() => {
          resolve(id)
        })
        .catch((err) => {
          reject(err)
        })
    })
  }
}
