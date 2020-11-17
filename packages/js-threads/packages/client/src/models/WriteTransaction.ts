/**
 * @packageDocumentation
 * @module @textile/threads-client/models
 */
import { grpc } from "@improbable-eng/grpc-web"
import { ContextInterface } from "@textile/context"
import {
  CreateRequest,
  DeleteRequest,
  DiscardRequest,
  FindByIDRequest,
  FindRequest,
  HasRequest,
  SaveRequest,
  StartTransactionRequest,
  VerifyRequest,
  WriteTransactionReply,
  WriteTransactionRequest,
} from "@textile/threads-client-grpc/threads_pb"
import { ThreadID } from "@textile/threads-id"
import { QueryJSON } from "./query"
import { Transaction } from "./Transaction"

const decoder = new TextDecoder()
const encoder = new TextEncoder()

/**
 * WriteTransaction performs a mutating bulk transaction on the underlying store.
 * {@inheritDoc @textile/threads-client#Transaction}
 * @example
 * Create a new entry in our collection
 * ```typescript
 * import {Client, ThreadID} from '@textile/threads'
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
 *   const t = client.writeTransaction(threadID, 'astronauts')
 *   await t.start()
 *   await t.create([buzz])
 *   await t.end() // Commit
 * }
 * ```
 *
 * @example
 * Abort an in-flight transaction
 * ```typescript
 * import {Client, ThreadID} from '@textile/threads'
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
 *   const t = client.writeTransaction(threadID, 'astronauts')
 *   await t.start()
 *   await t.create([buzz])
 *   await t.discard() // Abort
 *   await t.end()
 * }
 * ```
 */
export class WriteTransaction extends Transaction<
  WriteTransactionRequest,
  WriteTransactionReply
> {
  constructor(
    protected readonly context: ContextInterface,
    protected readonly client: grpc.Client<
      WriteTransactionRequest,
      WriteTransactionReply
    >,
    protected readonly threadID: ThreadID,
    protected readonly modelName: string
  ) {
    super(client, threadID, modelName)
  }
  /**
   * start begins the transaction. All operations between start and end will be applied as a single transaction upon a call to end.
   */
  public async start(): Promise<void> {
    const startReq = new StartTransactionRequest()
    startReq.setDbid(this.threadID.toBytes())
    startReq.setCollectionname(this.modelName)
    const req = new WriteTransactionRequest()
    req.setStarttransactionrequest(startReq)
    const metadata = JSON.parse(JSON.stringify(this.context))
    this.client.start(metadata)
    this.client.send(req)
  }
  /**
   * create creates a new model instance in the given store.
   * @param values An array of model instances as JSON/JS objects.
   */
  public async create<T = unknown>(values: T[]): Promise<string[]> {
    return new Promise<Array<string>>((resolve, reject) => {
      const createReq = new CreateRequest()
      const list: Uint8Array[] = []
      values.forEach((v) => {
        list.push(encoder.encode(JSON.stringify(v)))
      })
      createReq.setInstancesList(list)
      const req = new WriteTransactionRequest()
      req.setCreaterequest(createReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getCreatereply()
        const err = reply?.getTransactionerror()
        if (err) {
          reject(new Error(err))
        }
        if (reply === undefined) {
          resolve([])
        } else {
          resolve(reply.toObject().instanceidsList)
        }
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  /**
   * verify verifies existing instance changes.
   * @param values An array of instances as JSON/JS objects.
   */
  public async verify<T = unknown>(values: T[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const innerRequest = new VerifyRequest()
      const list = values.map((v) => encoder.encode(JSON.stringify(v)))
      innerRequest.setInstancesList(list)
      const req = new WriteTransactionRequest()
      req.setVerifyrequest(innerRequest)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getVerifyreply()
        const err = reply?.getTransactionerror()
        if (err) {
          reject(new Error(err))
        }
        resolve()
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  /**
   * save saves changes to an existing model instance in the given store.
   * @param values An array of model instances as JSON/JS objects. Each model instance must have a valid existing `ID` property.
   */
  public async save<T = unknown>(values: T[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const saveReq = new SaveRequest()
      const list: Uint8Array[] = []
      values.forEach((v) => {
        if (!("_id" in v)) {
          ;(v as any)._id = "" // The server will add an _id if empty.
        }
        list.push(encoder.encode(JSON.stringify(v)))
      })
      saveReq.setInstancesList(list)
      const req = new WriteTransactionRequest()
      req.setSaverequest(saveReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getSavereply()
        const err = reply?.getTransactionerror()
        if (err) {
          reject(new Error(err))
        }
        resolve()
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  /**
   * delete deletes an existing model instance from the given store.
   * @param IDs An array of instance ids to delete.
   */
  public async delete(IDs: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const deleteReq = new DeleteRequest()
      deleteReq.setInstanceidsList(IDs)
      const req = new WriteTransactionRequest()
      req.setDeleterequest(deleteReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getDeletereply()
        const err = reply?.getTransactionerror()
        if (err) {
          reject(new Error(err))
        }
        resolve()
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }
  /**
   * has checks whether a given instance exists in the given store.
   * @param IDs An array of instance ids to check for.
   */
  public async has(IDs: string[]): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const hasReq = new HasRequest()
      hasReq.setInstanceidsList(IDs)
      const req = new WriteTransactionRequest()
      req.setHasrequest(hasReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getHasreply()
        const err = reply?.getTransactionerror()
        if (err) {
          reject(new Error(err))
        }
        resolve(reply && reply.getExists())
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }
  /**
   * find queries the store for entities matching the given query parameters. See Query for options.
   * @param query The object that describes the query. See Query for options. Alternatively, see QueryJSON for the basic interface.
   */
  public async find<T = unknown>(query: QueryJSON): Promise<Array<T>> {
    return new Promise<Array<T>>((resolve, reject) => {
      const findReq = new FindRequest()
      findReq.setQueryjson(encoder.encode(JSON.stringify(query)))
      const req = new WriteTransactionRequest()
      req.setFindrequest(findReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getFindreply()
        const err = reply?.getTransactionerror()
        if (err) {
          reject(new Error(err))
        }
        if (reply === undefined) {
          resolve()
        } else {
          const ret: Array<T> = reply
            .getInstancesList_asU8()
            .map((instance) => JSON.parse(decoder.decode(instance)))
          resolve(ret)
        }
      })
      this.setReject(reject)
      this.client.send(req)
    })
  }

  /**
   * findByID queries the store for the id of an instance.
   * @param ID The id of the instance to search for.
   */
  public async findByID<T = unknown>(ID: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const findReq = new FindByIDRequest()
      findReq.setInstanceid(ID)
      const req = new WriteTransactionRequest()
      req.setFindbyidrequest(findReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getFindbyidreply()
        const err = reply?.getTransactionerror()
        if (err) {
          reject(new Error(err))
        }
        if (reply === undefined) {
          resolve()
        } else {
          resolve(JSON.parse(decoder.decode(reply.getInstance_asU8())))
        }
      })
      this.setReject(reject)
      this.client.send(req)
    })
  }

  /**
   * Discard drops all active transaction changes.
   * It also invalidates the transaction, so it will fail upon calling end.
   * @example
   * Abort an in-flight transaction
   * ```typescript
   * import {Client, ThreadID} from '@textile/threads'
   *
   * interface Astronaut {
   *   name: string
   *   missions: number
   *   _id: string
   * }
   *
   * async function example (client: Client, threadID: ThreadID) {
   *   const buzz: Astronaut = {
   *     name: 'Buzz',
   *     missions: 2,
   *     _id: '',
   *   }
   *
   *   const t = client.writeTransaction(threadID, 'astronauts')
   *   await t.start()
   *   await t.create([buzz])
   *   await t.discard() // Abort
   *   await t.end()
   * }
   * ```
   */
  public async discard(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const req = new WriteTransactionRequest()
      req.setDiscardrequest(new DiscardRequest())
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getDiscardreply()
        if (reply) {
          resolve()
        } else {
          reject(new Error("unexpected response type"))
        }
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }
}
