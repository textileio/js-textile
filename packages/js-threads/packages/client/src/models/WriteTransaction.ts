/**
 * @packageDocumentation
 * @module @textile/threads-client/models
 */
import { grpc } from '@improbable-eng/grpc-web'
import {
  CreateRequest,
  SaveRequest,
  DeleteRequest,
  HasRequest,
  FindRequest,
  FindByIDRequest,
  StartTransactionRequest,
  WriteTransactionRequest,
  WriteTransactionReply,
} from '@textile/threads-client-grpc/api_pb'
import { Config } from './config'
import { Instance, InstanceList, QueryJSON } from './query'
import { Transaction } from './Transaction'

/**
 * WriteTransaction performs a mutating bulk transaction on the underlying store.
 */
export class WriteTransaction extends Transaction<WriteTransactionRequest, WriteTransactionReply> {
  constructor(
    protected readonly config: Config,
    protected readonly client: grpc.Client<WriteTransactionRequest, WriteTransactionReply>,
    protected readonly dbID: Buffer,
    protected readonly modelName: string,
  ) {
    super(client, dbID, modelName)
  }
  /**
   * start begins the transaction. All operations between start and end will be applied as a single transaction upon a call to end.
   */
  public async start() {
    const startReq = new StartTransactionRequest()
    startReq.setDbid(this.dbID)
    startReq.setCollectionname(this.modelName)
    const req = new WriteTransactionRequest()
    req.setStarttransactionrequest(startReq)
    const metadata = this.config.toJSON()
    this.client.start(metadata)
    this.client.send(req)
  }
  /**
   * create creates a new model instance in the given store.
   * @param values An array of model instances as JSON/JS objects.
   */
  public async create<T = any>(values: any[]) {
    return new Promise<Array<string> | undefined>((resolve, reject) => {
      const createReq = new CreateRequest()
      const list: any[] = []
      values.forEach((v) => {
        list.push(Buffer.from(JSON.stringify(v)))
      })
      createReq.setInstancesList(list)
      const req = new WriteTransactionRequest()
      req.setCreaterequest(createReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getCreatereply()
        if (reply === undefined) {
          resolve()
        } else {
          resolve(reply.toObject().instanceidsList)
        }
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  /**
   * save saves changes to an existing model instance in the given store.
   * @param values An array of model instances as JSON/JS objects. Each model instance must have a valid existing `ID` property.
   */
  public async save(values: any[]) {
    return new Promise<void>((resolve, reject) => {
      const saveReq = new SaveRequest()
      const list: any[] = []
      values.forEach((v) => {
        if (!v.hasOwnProperty('ID')) {
          v['ID'] = '' // The server will add an ID if empty.
        }
        list.push(Buffer.from(JSON.stringify(v)))
      })
      saveReq.setInstancesList(list)
      const req = new WriteTransactionRequest()
      req.setSaverequest(saveReq)
      this.client.onMessage((_message: WriteTransactionReply) => {
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
  public async delete(IDs: string[]) {
    return new Promise<void>((resolve, reject) => {
      const deleteReq = new DeleteRequest()
      deleteReq.setInstanceidsList(IDs)
      const req = new WriteTransactionRequest()
      req.setDeleterequest(deleteReq)
      this.client.onMessage((_message: WriteTransactionReply) => {
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
  public async has(IDs: string[]) {
    return new Promise<boolean>((resolve, reject) => {
      const hasReq = new HasRequest()
      hasReq.setInstanceidsList(IDs)
      const req = new WriteTransactionRequest()
      req.setHasrequest(hasReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getHasreply()
        resolve(reply ? reply.toObject().exists == true : false)
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }
  /**
   * find queries the store for entities matching the given query parameters. See Query for options.
   * @param query The object that describes the query. See Query for options. Alternatively, see QueryJSON for the basic interface.
   */
  public async find<T = any>(query: QueryJSON) {
    return new Promise<InstanceList<T>>((resolve, reject) => {
      const findReq = new FindRequest()
      findReq.setQueryjson(Buffer.from(JSON.stringify(query)))
      const req = new WriteTransactionRequest()
      req.setFindrequest(findReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getFindreply()
        if (reply === undefined) {
          resolve()
        } else {
          const ret: InstanceList<T> = {
            instancesList: reply
              .toObject()
              .instancesList.map((instance) =>
                JSON.parse(Buffer.from(instance as string, 'base64').toString()),
              ),
          }
          resolve(ret)
        }
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }

  /**
   * findByID queries the store for the id of an instance.
   * @param ID The id of the instance to search for.
   */
  public async findByID<T = any>(ID: string) {
    return new Promise<Instance<T> | undefined>((resolve, reject) => {
      const findReq = new FindByIDRequest()
      findReq.setInstanceid(ID)
      const req = new WriteTransactionRequest()
      req.setFindbyidrequest(findReq)
      this.client.onMessage((message: WriteTransactionReply) => {
        const reply = message.getFindbyidreply()
        if (reply === undefined) {
          resolve()
        } else {
          const ret: Instance<T> = {
            instance: JSON.parse(
              Buffer.from(reply.toObject().instance as string, 'base64').toString(),
            ),
          }
          resolve(ret)
        }
      })
      super.setReject(reject)
      this.client.send(req)
    })
  }
}
