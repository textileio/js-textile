/**
 * @packageDocumentation
 * @module @textile/threads-client
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { grpc } from '@improbable-eng/grpc-web'
import { API, APIGetToken } from '@textile/threads-client-grpc/threads_pb_service'
import * as pb from '@textile/threads-client-grpc/threads_pb'
import nextTick from 'next-tick'
import { Identity, Libp2pCryptoIdentity } from '@textile/threads-core'
import { Multiaddr } from '@textile/multiaddr'
import { ThreadID } from '@textile/threads-id'
import { Context } from '@textile/context'
import { encode, decode } from 'bs58'
import {
  QueryJSON,
  Instance,
  InstanceList,
  Filter,
  Query,
  Where,
  WriteTransaction,
  ReadTransaction,
} from './models'

export { Query, Where, WriteTransaction, ReadTransaction, Instance, QueryJSON, ThreadID }

/**
 * Client is a web-gRPC wrapper client for communicating with a webgRPC-enabled Textile server.
 * This client library can be used to interact with a local or remote Textile gRPC-service
 *  It is a wrapper around Textile's 'DB' API, which is defined here: https://github.com/textileio/go-threads/blob/master/api/pb/api.proto.
 */
export class Client {
  public serviceHost: string
  public rpcOptions: grpc.RpcOptions
  /**
   * Creates a new gRPC client instance for accessing the Textile Threads API.
   * @param context The context to use for interacting with the APIs. Can be modified later.
   */
  constructor(public context: Context = new Context('http://127.0.0.1:6007')) {
    this.serviceHost = context.host
    this.rpcOptions = {
      transport: context.transport,
      debug: context.debug,
    }
    // If we have a default here, use it. Otherwise, rely on specific calls
    this.rpcOptions.transport && grpc.setDefaultTransport(this.rpcOptions.transport)
  }

  /**
   * Obtain a token for interacting with the remote network API.
   * @param identity The generic identity to use for signing and validation.
   * @param ctx Context object containing web-gRPC headers and settings.
   * @note If an identity is not provided, a random PKI identity is used. This might not be what you want!
   * It is not easy/possible to migrate identities after the fact. Please supply an identity argument if
   * you wish to persist/retrieve user data later.
   */
  async getToken(identity?: Identity, ctx?: Context) {
    const client = grpc.client<pb.GetTokenRequest, pb.GetTokenReply, APIGetToken>(API.GetToken, {
      host: this.serviceHost,
      transport: this.rpcOptions.transport,
      debug: this.rpcOptions.debug,
    })
    const ident = identity ?? (await Libp2pCryptoIdentity.fromRandom())
    return new Promise<string>((resolve, reject) => {
      let token: string
      client.onMessage(async (message: pb.GetTokenReply) => {
        if (message.hasChallenge()) {
          const challenge = message.getChallenge()
          let sig: Buffer = Buffer.from('')
          try {
            sig = await ident.sign(Buffer.from(challenge as string))
          } catch (err) {
            reject(err)
          }
          const req = new pb.GetTokenRequest()
          req.setSignature(sig)
          client.send(req)
        } else if (message.hasToken()) {
          token = message.getToken()
        }
      })
      client.onEnd((code) => {
        client.close()
        if (code === grpc.Code.OK) {
          this.context.withToken(token)
          resolve(token)
        } else {
          reject(new Error(code.toString()))
        }
      })
      const req = new pb.GetTokenRequest()
      req.setKey(ident.public.toString())
      const metadata = JSON.parse(JSON.stringify(this.context.withContext(ctx)))
      client.start(metadata)
      client.send(req)
      // client.finishSend()
    })
  }

  /**
   * newDB creates a new store on the remote node.
   * @param dbID the ID of the database
   * @param ctx Context object containing web-gRPC headers and settings.
   */
  public async newDB(dbID?: ThreadID, ctx?: Context) {
    const id = dbID ?? ThreadID.fromRandom()
    const req = new pb.NewDBRequest()
    req.setDbid(id.toBytes())
    await this.unary(API.NewDB, req)
    this.context.withThread && this.context.withThread(id)
    return id
  }

  /**
   * newCollection registers a new model schema under the given name on the remote node.
   * The schema must be a valid json-schema.org schema, and can be a JSON string or Javascript object.
   * @param dbID the ID of the database
   * @param name The human-readable name for the model.
   * @param schema The actual json-schema.org compatible schema object.
   */
  public async newCollection(dbID: ThreadID, name: string, schema: any) {
    const req = new pb.NewCollectionRequest()
    const config = new pb.CollectionConfig()
    config.setName(name)
    config.setSchema(Buffer.from(JSON.stringify(schema)))
    req.setDbid(dbID.toBytes())
    req.setConfig(config)
    await this.unary(API.NewCollection, req)
    return
  }

  /**
   * newDBFromAddr initializes the client with the given store, connecting to the given
   * thread address (database). It should be called before any operation on the store, and is an
   * alternative to start, which creates a local store. newDBFromAddr should also include the
   * read and follow keys, which should be Buffer, Uint8Array or base58-encoded strings.
   * See `getDBInfo` for a possible source of the address and keys.
   * @param address The address for the thread with which to connect.
   * Should be of the form /ip4/<url/ip-address>/tcp/<port>/p2p/<peer-id>/thread/<thread-id>
   * @param key The set of keys to use to connect to the database
   * @param collections An array of Name and JSON Schemas for collections in the DB.
   */
  public async newDBFromAddr(
    address: string,
    key: string | Uint8Array,
    collections: Array<{ name: string; schema: any }>,
  ) {
    const req = new pb.NewDBFromAddrRequest()
    const addr = new Multiaddr(address).buffer
    req.setAddr(addr)
    req.setKey(typeof key === 'string' ? decode(key) : key)
    req.setCollectionsList(
      collections.map((c) => {
        const config = new pb.CollectionConfig()
        config.setName(c.name)
        config.setSchema(JSON.stringify(c.schema))
        return config
      }),
    )
    return await this.unary(API.NewDBFromAddr, req)
  }

  /**
   * getDBInfo returns invite 'links' unseful for inviting other peers to join a given store/thread.
   * @param dbID the ID of the database
   */
  public async getDBInfo(dbID: ThreadID) {
    const req = new pb.GetDBInfoRequest()
    req.setDbid(dbID.toBytes())
    const res = (await this.unary(API.GetDBInfo, req)) as pb.GetDBInfoReply.AsObject
    const invites: Array<{ address: string; key: string }> = []
    for (const addr of res.addrsList) {
      const dk = Buffer.from(res.key as string, 'base64')
      const a = typeof addr === 'string' ? Buffer.from(addr, 'base64') : Buffer.from(addr)
      const address = new Multiaddr(a).toString()
      invites.push({
        address,
        key: encode(dk),
      })
    }
    return invites
  }

  /**
   * Creates a new model instance in the given store.
   * @param dbID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   * @param values An array of model instances as JSON/JS objects.
   */
  public async create(dbID: ThreadID, collectionName: string, values: any[]) {
    const req = new pb.CreateRequest()
    req.setDbid(dbID.toBytes())
    req.setCollectionname(collectionName)
    const list: any[] = []
    values.forEach((v) => {
      list.push(Buffer.from(JSON.stringify(v)))
    })
    req.setInstancesList(list)
    const res = (await this.unary(API.Create, req)) as pb.CreateReply.AsObject
    return res.instanceidsList
  }

  /**
   * Saves changes to an existing model instance in the given store.
   * @param dbID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   * @param values An array of model instances as JSON/JS objects. Each model instance must have a valid existing `ID` property.
   */
  public async save(dbID: ThreadID, collectionName: string, values: any[]) {
    const req = new pb.SaveRequest()
    req.setDbid(dbID.toBytes())
    req.setCollectionname(collectionName)
    const list: any[] = []
    values.forEach((v) => {
      if (!v.hasOwnProperty('ID')) {
        v['ID'] = '' // The server will add an ID if empty.
      }
      list.push(Buffer.from(JSON.stringify(v)))
    })
    req.setInstancesList(list)
    await this.unary(API.Save, req)
    return
  }

  /**
   * Deletes an existing model instance from the given store.
   * @param dbID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   * @param IDs An array of instance ids to delete.
   */
  public async delete(dbID: ThreadID, collectionName: string, IDs: string[]) {
    const req = new pb.DeleteRequest()
    req.setDbid(dbID.toBytes())
    req.setCollectionname(collectionName)
    req.setInstanceidsList(IDs)
    await this.unary(API.Delete, req)
    return
  }

  /**
   * has checks whether a given instance exists in the given store.
   * @param dbID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   * @param IDs An array of instance ids to check for.
   */
  public async has(dbID: ThreadID, collectionName: string, IDs: string[]) {
    const req = new pb.HasRequest()
    req.setDbid(dbID.toBytes())
    req.setCollectionname(collectionName)
    req.setInstanceidsList(IDs)
    const res = (await this.unary(API.Has, req)) as pb.HasReply.AsObject
    return res.exists
  }

  /**
   * find queries the store for entities matching the given query parameters.
   * @param dbID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   * @param query The object that describes the query. User Query class or primitive QueryJSON type.
   */
  public async find<T = any>(dbID: ThreadID, collectionName: string, query: QueryJSON) {
    const req = new pb.FindRequest()
    req.setDbid(dbID.toBytes())
    req.setCollectionname(collectionName)
    // @todo: Find a more isomorphic way to do this base64 round-trip
    req.setQueryjson(Buffer.from(JSON.stringify(query)).toString('base64'))
    const res = (await this.unary(API.Find, req)) as pb.FindReply.AsObject
    const ret: InstanceList<T> = {
      instancesList: res.instancesList.map((instance) =>
        JSON.parse(Buffer.from(instance as string, 'base64').toString()),
      ),
    }
    return ret
  }

  /**
   * findByID queries the store for the id of an instance.
   * @param dbID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   * @param ID The id of the instance to search for.
   */
  public async findByID<T = any>(dbID: ThreadID, collectionName: string, ID: string) {
    const req = new pb.FindByIDRequest()
    req.setDbid(dbID.toBytes())
    req.setCollectionname(collectionName)
    req.setInstanceid(ID)
    const res = (await this.unary(API.FindByID, req)) as pb.FindByIDReply.AsObject
    const ret: Instance<T> = {
      instance: JSON.parse(Buffer.from(res.instance as string, 'base64').toString()),
    }
    return ret
  }

  /**
   * readTransaction creates a new read-only transaction object. See ReadTransaction for details.
   * @param dbID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   */
  public readTransaction(dbID: ThreadID, collectionName: string): ReadTransaction {
    const client = grpc.client(API.ReadTransaction, {
      host: this.serviceHost,
      transport: this.rpcOptions.transport,
      debug: this.rpcOptions.debug,
    }) as grpc.Client<pb.ReadTransactionRequest, pb.ReadTransactionReply>
    return new ReadTransaction(this.context, client, dbID, collectionName)
  }

  /**
   * writeTransaction creates a new writeable transaction object. See WriteTransaction for details.
   * @param dbID the ID of the database
   * @param collectionName The human-readable name of the model to use.
   */
  public writeTransaction(dbID: ThreadID, collectionName: string): WriteTransaction {
    const client = grpc.client(API.WriteTransaction, {
      host: this.serviceHost,
      transport: this.rpcOptions.transport,
      debug: this.rpcOptions.debug,
    }) as grpc.Client<pb.WriteTransactionRequest, pb.WriteTransactionReply>
    return new WriteTransaction(this.context, client, dbID, collectionName)
  }

  /**
   * listen opens a long-lived connection with a remote node, running the given callback on each new update to the given instance.
   * The return value is a `close` function, which cleanly closes the connection with the remote node.
   * @param dbID the ID of the database
   * @param filters contains an array of Filters
   * @param callback The callback to call on each update to the given instance.
   */
  public listen<T = any>(
    dbID: ThreadID,
    filters: Filter[],
    callback: (reply?: Instance<T>, err?: Error) => void,
  ) {
    const req = new pb.ListenRequest()
    req.setDbid(dbID.toBytes())
    for (const filter of filters) {
      const requestFilter = new pb.ListenRequest.Filter()
      if (filter.instanceID) {
        requestFilter.setInstanceid(filter.instanceID)
      } else if (filter.collectionName) {
        requestFilter.setCollectionname(filter.collectionName)
      }
      if (filter.actionTypes) {
        for (const at of filter.actionTypes) {
          switch (at) {
            case 'ALL': {
              requestFilter.setAction(pb.ListenRequest.Filter.Action.ALL)
              break
            }
            case 'CREATE': {
              requestFilter.setAction(pb.ListenRequest.Filter.Action.CREATE)
              break
            }
            case 'SAVE': {
              requestFilter.setAction(pb.ListenRequest.Filter.Action.SAVE)
              break
            }
            case 'DELETE': {
              requestFilter.setAction(pb.ListenRequest.Filter.Action.DELETE)
              break
            }
          }
        }
      } else {
        requestFilter.setAction(0)
      }
      req.addFilters(requestFilter)
    }

    const metadata = JSON.parse(JSON.stringify(this.context))
    const res = grpc.invoke(API.Listen, {
      host: this.serviceHost,
      transport: this.rpcOptions.transport,
      debug: this.rpcOptions.debug,
      request: req,
      metadata,
      onMessage: (rec: pb.ListenReply) => {
        const ret: Instance<T> = {
          instance: JSON.parse(Buffer.from(rec.getInstance_asU8()).toString()),
        }
        nextTick(() => callback(ret))
      },
      onEnd: (status: grpc.Code, message: string, _trailers: grpc.Metadata) => {
        if (status !== grpc.Code.OK) {
          nextTick(() => callback(undefined, new Error(message)))
        }
        nextTick(callback)
      },
    })
    return res.close.bind(res)
  }

  private async unary<
    TRequest extends grpc.ProtobufMessage,
    TResponse extends grpc.ProtobufMessage,
    M extends grpc.UnaryMethodDefinition<TRequest, TResponse>
  >(methodDescriptor: M, req: TRequest) {
    const metadata = JSON.parse(JSON.stringify(this.context))
    return new Promise((resolve, reject) => {
      grpc.unary(methodDescriptor, {
        transport: this.rpcOptions.transport,
        debug: this.rpcOptions.debug,
        request: req,
        host: this.serviceHost,
        metadata,
        onEnd: (res) => {
          const { status, statusMessage, message } = res
          if (status === grpc.Code.OK) {
            if (message) {
              resolve(message.toObject())
            } else {
              resolve()
            }
          } else {
            reject(new Error(statusMessage))
          }
        },
      })
    })
  }
}

// eslint-disable-next-line import/no-default-export
export default Client
