/**
 * @packageDocumentation
 * @module @textile/threads-client/models
 */
import { grpc } from "@improbable-eng/grpc-web"
import { ContextInterface } from "@textile/context"
import {
  FindByIDRequest,
  FindRequest,
  HasRequest,
  ReadTransactionReply,
  ReadTransactionRequest,
  StartTransactionRequest,
} from "@textile/threads-client-grpc/threads_pb"
import { ThreadID } from "@textile/threads-id"
import { Instance, InstanceList, QueryJSON } from "./query"
import { Transaction } from "./Transaction"

/**
 * ReadTransaction performs a read-only bulk transaction on the underlying store.
 * {@inheritDoc @textile/threads-client#Transaction}
 * @example
 * Create a new entry and check for it within a transaction
 * ```typescript
 * import {Client, ThreadID} from '@textile/threads'
 *
 * interface Astronaut {
 *   name: string
 *   missions: number
 *   _id: string
 * }
 *
 * async function createAndCheck (client: Client, threadID: ThreadID) {
 *   const buzz: Astronaut = {
 *     name: 'Buzz',
 *     missions: 2,
 *     _id: '',
 *   }
 *
 *   const ids = await client.create(threadID, 'astronauts', [buzz])
 *   // Create and start transaction
 *   const t = client.readTransaction(threadID, 'astronauts')
 *   await t.start()
 *   const has = await t.has([buzz])
 *   console.log(has) // true
 *   await t.end() // Finish
 * }
 * ```
 */
export class ReadTransaction extends Transaction<
  ReadTransactionRequest,
  ReadTransactionReply
> {
  constructor(
    protected readonly context: ContextInterface,
    protected readonly client: grpc.Client<
      ReadTransactionRequest,
      ReadTransactionReply
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
    const req = new ReadTransactionRequest()
    req.setStarttransactionrequest(startReq)
    const metadata = JSON.parse(JSON.stringify(this.context))
    this.client.start(metadata)
    this.client.send(req)
  }

  /**
   * has checks whether a given instance exists in the given store.
   * @param IDs An array of instance ids to check for.
   */
  public async has(IDs: string[]): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const hasReq = new HasRequest()
      hasReq.setInstanceidsList(IDs)
      const req = new ReadTransactionRequest()
      req.setHasrequest(hasReq)
      this.client.onMessage((message: ReadTransactionReply) => {
        const reply = message.getHasreply()
        resolve(reply ? reply.toObject().exists : false)
      })
      this.setReject(reject)
      this.client.send(req)
    })
  }

  /**
   * find queries the store for entities matching the given query parameters. See Query for options.
   * @param query The object that describes the query. See Query for options. Alternatively, see QueryJSON for the basic interface.
   */
  public async find<T = any>(query: QueryJSON): Promise<InstanceList<T>> {
    return new Promise<InstanceList<T>>((resolve, reject) => {
      const findReq = new FindRequest()
      findReq.setQueryjson(Buffer.from(JSON.stringify(query)))
      const req = new ReadTransactionRequest()
      req.setFindrequest(findReq)
      this.client.onMessage((message: ReadTransactionReply) => {
        const reply = message.getFindreply()
        if (reply === undefined) {
          resolve()
        } else {
          const ret: InstanceList<T> = {
            instancesList: reply
              .toObject()
              .instancesList.map((instance) =>
                JSON.parse(Buffer.from(instance as string, "base64").toString())
              ),
          }
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
  public async findByID<T = any>(ID: string): Promise<Instance<T>> {
    return new Promise<Instance<T>>((resolve, reject) => {
      const findReq = new FindByIDRequest()
      findReq.setInstanceid(ID)
      const req = new ReadTransactionRequest()
      req.setFindbyidrequest(findReq)
      this.client.onMessage((message: ReadTransactionReply) => {
        const reply = message.getFindbyidreply()
        if (reply === undefined) {
          resolve()
        } else {
          const ret: Instance<T> = {
            instance: JSON.parse(
              Buffer.from(
                reply.toObject().instance as string,
                "base64"
              ).toString()
            ),
          }
          resolve(ret)
        }
      })
      this.setReject(reject)
      this.client.send(req)
    })
  }
}
