import { grpc } from '@improbable-eng/grpc-web'
import CID from 'cids'
import PeerId from 'peer-id'
import { keys } from 'libp2p-crypto'
import log from 'loglevel'
import {
  ThreadID,
  LogID,
  ThreadInfo,
  KeyOptions,
  LogInfo,
  Block,
  ThreadRecord,
  LogRecord,
  Network,
  marshalKey,
  Multiaddr,
  ThreadKey,
} from '@textile/threads-core'
import * as pb from '@textile/threads-net-grpc/api_pb'
import { API } from '@textile/threads-net-grpc/api_pb_service'
import { recordFromProto, recordToProto } from '@textile/threads-encoding'
import { Config, BaseConfig } from './config'

export { Config, BaseConfig }

const logger = log.getLogger('network-client')

function getThreadKeys(opts: KeyOptions) {
  const threadKeys = new pb.Keys()
  opts.threadKey && threadKeys.setThreadkey(opts.threadKey.toBytes())
  opts.logKey && threadKeys.setLogkey(marshalKey(opts.logKey))
  return threadKeys
}

function threadRecordFromProto(proto: pb.NewRecordReply.AsObject, key: ThreadKey) {
  const threadID = ThreadID.fromBytes(Buffer.from(proto.threadid as string, 'base64'))
  const rawID = Buffer.from(proto.logid as string, 'base64')
  const logID = PeerId.createFromBytes(rawID)
  const record = proto.record && recordFromProto(proto.record, key.service)
  const info: ThreadRecord = {
    record,
    threadID,
    logID,
  }
  return info
}

async function threadInfoFromProto(proto: pb.ThreadInfoReply.AsObject) {
  const id = ThreadID.fromBytes(Buffer.from(proto.id as string, 'base64'))
  const threadKey = Buffer.from(proto.threadkey as string, 'base64')
  const key = ThreadKey.fromBytes(threadKey)
  const logs: Set<LogInfo> = new Set()
  for (const log of proto.logsList) {
    const rawId = Buffer.from(log.id as string, 'base64')
    const pid = PeerId.createFromBytes(rawId)
    // @todo: Currently it looks like private key unmarshaling isn't compatible between Go and JS?
    // const pkBytes = Buffer.from(log.privkey as string, 'base64')
    // const privKey = await keys.unmarshalPrivateKey(pkBytes)
    const logInfo: LogInfo = {
      id: pid,
      addrs: new Set(log.addrsList.map(addr => new Multiaddr(Buffer.from(addr as string, 'base64')))),
      heads: new Set(log.headsList.map(head => new CID(Buffer.from(head as string, 'base64')))),
      pubKey: keys.unmarshalPublicKey(Buffer.from(log.pubkey as string, 'base64')),
      // privKey,
    }
    logs.add(logInfo)
  }
  const threadInfo: ThreadInfo = {
    id,
    key,
    logs,
  }
  return threadInfo
}

/**
 * Client is a web-gRPC wrapper client for communicating with a webgRPC-enabled Textile server.
 * This client library can be used to interact with a local or remote Threads gRPC Network.
 */
export class Client implements Network {
  /**
   * Controls the remote API settings.
   */
  public readonly config: Config

  /**
   * Client creates a new gRPC client instance.
   * @param config The remote API configuration object or a set of parameters.
   */
  constructor(config: Config | BaseConfig = {}) {
    if (config instanceof Config) {
      this.config = config
    } else {
      this.config = new Config(config.host, config.transport)
    }
    grpc.setDefaultTransport(this.config.transport)
  }

  /**
   * getHostID returns the network's (remote) host peer ID.
   */
  async getHostID() {
    logger.debug('making get host ID request')
    const req = new pb.GetHostIDRequest()
    const res = (await this.unary(API.GetHostID, req)) as pb.GetHostIDReply.AsObject
    return PeerId.createFromBytes(Buffer.from(res.peerid as string, 'base64'))
  }

  /**
   * createThread with id.
   * @param id The Thread id.
   * @param opts The set of keys to use when creating the Thread. All keys are "optional", though if no replicator key
   * is provided, one will be created (and returned) on the remote network. Similarly, if no LogKey is provided, then
   * a private key will be generated (and returned) on the remote network. If no ReadKey is provided, the remote
   * network will be unable to write records (but it can return records).
   */
  async createThread(id: ThreadID, opts: KeyOptions) {
    logger.debug('making create thread request')
    const keys = getThreadKeys(opts)
    const req = new pb.CreateThreadRequest()
    req.setThreadid(id.toBytes())
    req.setKeys(keys)
    const res = (await this.unary(API.CreateThread, req)) as pb.ThreadInfoReply.AsObject
    return threadInfoFromProto(res)
  }

  /**
   * addThread from a multiaddress.
   * @param addr The Thread multiaddr.
   * @param opts The set of keys to use when adding the Thread.
   */
  async addThread(addr: Multiaddr, opts: KeyOptions) {
    logger.debug('making add thread request')
    const keys = getThreadKeys(opts)
    const req = new pb.AddThreadRequest()
    req.setAddr(addr.buffer)
    req.setKeys(keys)
    const res = (await this.unary(API.AddThread, req)) as pb.ThreadInfoReply.AsObject
    return threadInfoFromProto(res)
  }

  /**
   * getThread with id.
   * @param id The Thread ID.
   */
  async getThread(id: ThreadID) {
    logger.debug('making get thread request')
    const req = new pb.GetThreadRequest()
    req.setThreadid(id.toBytes())
    const res = (await this.unary(API.GetThread, req)) as pb.ThreadInfoReply.AsObject
    return threadInfoFromProto(res)
  }

  /**
   * pullThread for new records.
   * @param id The Thread ID.
   */
  async pullThread(id: ThreadID) {
    logger.debug('making pull thread request')
    const req = new pb.PullThreadRequest()
    req.setThreadid(id.toBytes())
    await this.unary(API.PullThread, req)
    return
  }

  /**
   * deleteThread with id.
   * @param id The Thread ID.
   */
  async deleteThread(id: ThreadID) {
    logger.debug('making delete thread request')
    const req = new pb.DeleteThreadRequest()
    req.setThreadid(id.toBytes())
    await this.unary(API.DeleteThread, req)
    return
  }

  /**
   * addReplicator to a thread.
   * @param id The Thread ID.
   * @param addr The multiaddress of the replicator peer.
   */
  async addReplicator(id: ThreadID, addr: Multiaddr) {
    logger.debug('making add replicator request')
    const req = new pb.AddReplicatorRequest()
    req.setThreadid(id.toBytes())
    req.setAddr(addr.buffer)
    const res = (await this.unary(API.AddReplicator, req)) as pb.AddReplicatorReply.AsObject
    const rawId = Buffer.from(res.peerid as string, 'base64')
    return PeerId.createFromBytes(rawId)
  }

  /**
   * createRecord with body.
   * @param id The Thread ID.
   * @param body The body to add as content.
   */
  async createRecord(id: ThreadID, body: any) {
    logger.debug('making create record request')
    const info = await this.getThread(id)
    const block = Block.encoder(body, 'dag-cbor').encode()
    const req = new pb.CreateRecordRequest()
    req.setThreadid(id.toBytes())
    req.setBody(block)
    const res = (await this.unary(API.CreateRecord, req)) as pb.NewRecordReply.AsObject
    return info.key && threadRecordFromProto(res, info.key)
  }

  /**
   * addRecord to the given log.
   * @param id The Thread ID.
   * @param logID The Log ID.
   * @param rec The log record to add.
   */
  async addRecord(id: ThreadID, logID: LogID, rec: LogRecord) {
    logger.debug('making add record request')
    const prec = recordToProto(rec)
    const req = new pb.AddRecordRequest()
    req.setThreadid(id.toBytes())
    req.setLogid(logID.toBytes())
    const record = new pb.Record()
    record.setBodynode(prec.bodynode)
    record.setEventnode(prec.eventnode)
    record.setHeadernode(prec.headernode)
    record.setRecordnode(prec.recordnode)
    req.setRecord(record)
    await this.unary(API.AddRecord, req)
    return
  }

  /**
   * getRecord returns the record at cid.
   * @param id The Thread ID.
   * @param rec The record's CID.
   */
  async getRecord(id: ThreadID, rec: CID) {
    logger.debug('making get record request')
    const info = await this.getThread(id)
    if (info.key === undefined) throw new Error('Missing thread keys')
    const req = new pb.GetRecordRequest()
    req.setThreadid(id.toBytes())
    req.setRecordid(rec.buffer)
    const record = (await this.unary(API.GetRecord, req)) as pb.GetRecordReply.AsObject
    if (!record.record) throw new Error('Missing return value')
    return recordFromProto(record.record, info.key.service)
  }

  /**
   * subscribe to new record events in the given threads.
   * @param cb The callback to call on each new thread record.
   * @param threads The variadic set of threads to subscribe to.
   */
  subscribe(cb: (rec?: ThreadRecord, err?: Error) => void, ...threads: ThreadID[]) {
    logger.debug('making subscribe request')
    const ids = threads.map(thread => thread.toBytes())
    const request = new pb.SubscribeRequest()
    request.setThreadidsList(ids)
    const keys = new Map<ThreadID, Uint8Array | undefined>() // replicator key cache
    const callback = async (reply?: pb.NewRecordReply, err?: Error) => {
      if (!reply) {
        return cb(undefined, err)
      }
      const proto = reply.toObject()
      const id = ThreadID.fromBytes(Buffer.from(proto.threadid as string, 'base64'))
      const rawID = Buffer.from(proto.logid as string, 'base64')
      const logID = PeerId.createFromBytes(rawID)
      if (!keys.has(id)) {
        const info = await this.getThread(id)
        keys.set(id, info.key?.service)
      }
      const keyiv = keys.get(id)
      if (!keyiv) return cb(undefined, new Error('Missing key'))
      const record = proto.record && recordFromProto(proto.record, keyiv)
      return cb(
        {
          record,
          threadID: id,
          logID,
        },
        err,
      )
    }
    return grpc.invoke(API.Subscribe, {
      host: this.config.host,
      metadata: this.config._wrapMetadata(),
      request,
      onMessage: (rec: pb.NewRecordReply) => callback(rec),
      onEnd: (status: grpc.Code, message: string, _trailers: grpc.Metadata) => {
        if (status !== grpc.Code.OK) {
          return callback(undefined, new Error(message))
        }
        callback()
      },
    })
  }

  private unary<
    TRequest extends grpc.ProtobufMessage,
    TResponse extends grpc.ProtobufMessage,
    M extends grpc.UnaryMethodDefinition<TRequest, TResponse>
  >(methodDescriptor: M, req: TRequest) {
    return new Promise((resolve, reject) => {
      grpc.unary(methodDescriptor, {
        request: req,
        host: this.config.host,
        metadata: this.config._wrapMetadata(),
        onEnd: res => {
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
