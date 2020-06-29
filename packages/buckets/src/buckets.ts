import log from 'loglevel'
import * as pb from '@textile/buckets-grpc/buckets_pb'
import { API, APIPushPath } from '@textile/buckets-grpc/buckets_pb_service'
import CID from 'cids'
import { EventIterator } from 'event-iterator'
import { grpc } from '@improbable-eng/grpc-web'
import { ContextInterface, Context, defaultHost } from '@textile/context'
import { UserAuth, KeyInfo } from '@textile/security'
import { ThreadID } from '@textile/threads-id'
import { Client } from '@textile/hub-threads-client'
import { normaliseInput, File } from './normalize'

const logger = log.getLogger('buckets')

/**
 * The expected result format from pushing a path to a bucket
 */
export interface PushPathResult {
  path: {
    path: string
    cid: CID
    root: CID
    remainder: string
  }
  root: string
}

/**
 * Buckets is a web-gRPC wrapper client for communicating with the web-gRPC enabled Textile Buckets API.
 * @example
 * Initialize a the Bucket API
 * ```typescript
 * import { Buckets, UserAuth } from '@textile/hub'
 *
 * const init = async (auth: UserAuth) => {
 *     const buckets = Buckets.withUserAuth(auth)
 *     return buckets
 * }
 * ```
 *
 * @example
 * Find an existing Bucket
 * ```typescript
 * import { Buckets } from '@textile/hub'
 *
 * const exists = async (buckets: Buckets, bucketName: string) => {
 *     const roots = await buckets.list();
 *     return roots.find((bucket) => bucket.name === bucketName)
 * }
 * ```
 */
export class Buckets {
  public serviceHost: string
  public rpcOptions: grpc.RpcOptions
  /**
   * Creates a new gRPC client instance for accessing the Textile Buckets API.
   * @param context The context to use for interacting with the APIs. Can be modified later.
   */
  constructor(public context: ContextInterface = new Context()) {
    this.serviceHost = context.host
    this.rpcOptions = {
      transport: context.transport,
      debug: context.debug,
    }
  }

  /**
   * Creates a new gRPC client instance for accessing the Textile Buckets API.
   * @param auth The user auth object.
   */
  static withUserAuth(auth: UserAuth, host = defaultHost, debug = false) {
    const context = Context.fromUserAuth(auth, host, debug)
    return new Buckets(context)
  }

  /**
   * Create a new gRPC client Bucket instance from a supplied key and secret
   * @param key The KeyInfo object containing {key: string, secret: string, type: 0}. 0 === User Group Key, 1 === Account Key
   */
  static async withKeyInfo(key: KeyInfo, host = defaultHost, debug = false) {
    const context = new Context(host, debug)
    await context.withKeyInfo(key)
    return new Buckets(context)
  }

  /**
   * Create a new gRPC client Bucket instance from a preconfigured threads client
   * @param client a threads client
   */
  static async fromClient(client: Client) {
    return new Buckets(client.context)
  }

  /**
   * Open a new / existing bucket by bucket name and ThreadID
   * @param name name of bucket
   * @param threadName the name of the thread where the bucket is stored (default 'buckets')
   * @param threadID id of thread where bucket is stored
   * @example
   * Initialize a Bucket called "app-name-files"
   * ```tyepscript
   * import { Buckets, UserAuth } from '@textile/hub'
   *
   * const open = async (auth: UserAuth, name: string) => {
   *     const buckets = Buckets.withUserAuth(auth)
   *     await buckets.open(name)
   *     return buckets
   * }
   * ```
   */
  async open(name: string, threadName?: string, threadID?: ThreadID) {
    if (threadID) {
      const id = threadID.toString()
      const client = new Client(this.context)
      const res = await client.listThreads()
      const exists = res.listList.find((thread) => thread.id === id)
      if (!exists) {
        await client.newDB(threadID)
      }
      this.context.withThread(threadID.toString())
    } else {
      const threadname = threadName && threadName !== '' ? threadName : 'buckets'
      const client = new Client(this.context)
      try {
        const res = await client.getThread(threadname)
        const existingId = typeof res.id === 'string' ? res.id : ThreadID.fromBytes(res.id).toString()
        this.context.withThread(existingId)
      } catch (error) {
        if (error.message !== 'Thread not found') {
          throw new Error(error.message)
        }
        const newId = ThreadID.fromRandom()
        await client.newDB(newId, threadname)
        this.context.withThread(newId.toString())
      }
    }

    const roots = await this.list()
    const existing = roots.find((bucket) => bucket.name === name)
    if (existing) {
      return existing
    }
    const created = await this.init(name)
    return created.root
  }

  /**
   * Initializes a new bucket.
   * @public
   * @param name Human-readable bucket name. It is only meant to help identify a bucket in a UI and is not unique.
   * @param ctx Context object containing web-gRPC headers and settings.
   * @example
   * Initialize a Bucket called "app-name-files"
   * ```tyepscript
   * import { Buckets } from '@textile/hub'
   *
   * const init = async (buckets: Buckets) => {
   *     return buckets.init("app-name-files")
   * }
   * ```
   */
  async init(name: string, ctx?: ContextInterface) {
    logger.debug('init request')
    const req = new pb.InitRequest()
    req.setName(name)
    const res: pb.InitReply = await this.unary(API.Init, req, ctx)
    return res.toObject()
  }

  /**
   * Returns a list of all bucket roots.
   * @example
   * Find an existing Bucket named "app-name-files"
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const exists = async (buckets: Buckets) => {
   *     const roots = await buckets.list();
   *     return roots.find((bucket) => bucket.name ===  "app-name-files")
   * }
   * ````
   */
  async list(ctx?: ContextInterface) {
    logger.debug('list request')
    const req = new pb.ListRequest()
    const res: pb.ListReply = await this.unary(API.List, req, ctx)
    return res.toObject().rootsList
  }

  /**
   * Returns a list of bucket links.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param ctx Context object containing web-gRPC headers and settings.
   * @example
   * Generate the HTTP, IPNS, and IPFS links for a Bucket
   * ```tyepscript
   * import { Buckets } from '@textile/hub'
   *
   * const getLinks = async (buckets: Buckets) => {
   *    const links = buckets.links(bucketKey)
   *    return links.ipfs
   * }
   *
   * const getIpfs = async (buckets: Buckets) => {
   *    const links = buckets.links(bucketKey)
   *    return links.ipfs
   * }
   * ```
   */
  async links(key: string, ctx?: ContextInterface) {
    logger.debug('link request')
    const req = new pb.LinksRequest()
    req.setKey(key)
    const res: pb.LinksReply = await this.unary(API.Links, req, ctx)
    return res.toObject()
  }

  /**
   * Returns information about a bucket path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param ctx Context object containing web-gRPC headers and settings.
   */
  async listPath(key: string, path: string, ctx?: ContextInterface) {
    logger.debug('list path request')
    const req = new pb.ListPathRequest()
    req.setKey(key)
    req.setPath(path)
    const res: pb.ListPathReply = await this.unary(API.ListPath, req, ctx)
    return res.toObject()
  }

  /**
   * Removes an entire bucket. Files and directories will be unpinned.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param ctx Context object containing web-gRPC headers and settings.
   */
  async remove(key: string, ctx?: ContextInterface) {
    logger.debug('remove request')
    const req = new pb.RemoveRequest()
    req.setKey(key)
    await this.unary(API.Remove, req, ctx)
    return
  }

  /**
   * Returns information about a bucket path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param ctx Context object containing web-gRPC headers and settings.
   */
  async removePath(key: string, path: string, ctx?: ContextInterface) {
    logger.debug('remove path request')
    const req = new pb.RemovePathRequest()
    req.setKey(key)
    req.setPath(path)
    await this.unary(API.RemovePath, req, ctx)
    return
  }

  /**
   * Pushes a file to a bucket path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param input The input file/stream/object.
   * @param ctx Context object containing web-gRPC headers and settings.
   * @param opts Options to control response stream. Currently only supports a progress function.
   * @remarks
   * This will return the resolved path and the bucket's new root path.
   * @example
   * Push a file to the root of a bucket
   * ```tyepscript
   * import { Buckets } from '@textile/hub'
   *
   * const pushFile = async (content: string, bucketKey: string) => {
   *    const file = { path: '/index.html', content: Buffer.from(content) }
   *    return await buckets.pushPath(bucketKey!, 'index.html', file)
   * }
   * ```
   */
  async pushPath(
    key: string,
    path: string,
    input: any,
    ctx?: ContextInterface,
    opts?: { progress?: (num?: number) => void },
  ) {
    return new Promise<PushPathResult>(async (resolve, reject) => {
      // Only process the first  input if there are more than one
      const source: File | undefined = (await normaliseInput(input).next()).value
      const client = grpc.client<pb.PushPathRequest, pb.PushPathReply, APIPushPath>(API.PushPath, {
        host: this.serviceHost,
        transport: this.rpcOptions.transport,
        debug: this.rpcOptions.debug,
      })
      client.onMessage((message) => {
        if (message.hasError()) {
          // Reject on first error
          reject(new Error(message.getError()))
        } else if (message.hasEvent()) {
          const event = message.getEvent()?.toObject()
          if (event?.path) {
            // @todo: Is there an standard library/tool for this step in JS?
            const pth = event.path.startsWith('/ipfs/') ? event.path.split('/ipfs/')[1] : event.path
            const cid = new CID(pth)
            const res: PushPathResult = {
              path: {
                path: `/ipfs/${cid.toString()}`,
                cid: cid,
                root: cid,
                remainder: '',
              },
              root: event.root?.path ?? '',
            }
            resolve(res)
          } else if (opts?.progress) {
            opts.progress(event?.bytes)
          }
        } else {
          reject(new Error('Invalid reply'))
        }
      })
      client.onEnd((code) => {
        if (code === grpc.Code.OK) {
          resolve()
        } else {
          reject(new Error(code.toString()))
        }
      })
      if (source) {
        const head = new pb.PushPathRequest.Header()
        head.setPath(source.path || path)
        head.setKey(key)
        const req = new pb.PushPathRequest()
        req.setHeader(head)
        const metadata = { ...this.context.toJSON(), ...ctx?.toJSON() }
        client.start(metadata)
        client.send(req)

        if (source.content) {
          for await (const chunk of source.content) {
            const part = new pb.PushPathRequest()
            part.setChunk(chunk as Buffer)
            client.send(part)
          }
          client.finishSend()
        }
      }
    })
  }

  /**
   * Pulls the bucket path, returning the bytes of the given file.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param ctx Context object containing web-gRPC headers and settings.
   * @param opts Options to control response stream. Currently only supports a progress function.
   */
  pullPath(
    key: string,
    path: string,
    ctx?: ContextInterface,
    opts?: { progress?: (num?: number) => void },
  ): AsyncIterableIterator<Uint8Array> {
    const metadata = { ...this.context.toJSON(), ...ctx?.toJSON() }
    const request = new pb.PullPathRequest()
    request.setKey(key)
    request.setPath(path)
    let written = 0
    const events = new EventIterator<Uint8Array>(({ push, stop, fail }) => {
      const resp = grpc.invoke(API.PullPath, {
        host: this.serviceHost,
        transport: this.rpcOptions.transport,
        debug: this.rpcOptions.debug,
        request,
        metadata,
        onMessage: async (res: pb.PullPathReply) => {
          const chunk = res.getChunk_asU8()
          push(chunk)
          written += chunk.byteLength
          if (opts?.progress) {
            opts.progress(written)
          }
        },
        onEnd: async (status: grpc.Code, message: string, _trailers: grpc.Metadata) => {
          if (status !== grpc.Code.OK) {
            fail(new Error(message))
          }
          stop()
        },
      })
      return () => resp.close()
    })
    const it: AsyncIterableIterator<Uint8Array> = {
      [Symbol.asyncIterator]() {
        return this
      },
      ...events[Symbol.asyncIterator](),
    }
    return it
  }

  private unary<
    R extends grpc.ProtobufMessage,
    T extends grpc.ProtobufMessage,
    M extends grpc.UnaryMethodDefinition<R, T>
  >(methodDescriptor: M, req: R, ctx?: ContextInterface): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const metadata = { ...this.context.toJSON(), ...ctx?.toJSON() }
      grpc.unary(methodDescriptor, {
        request: req,
        host: this.serviceHost,
        transport: this.rpcOptions.transport,
        debug: this.rpcOptions.debug,
        metadata,
        onEnd: (res: grpc.UnaryOutput<T>) => {
          const { status, statusMessage, message } = res
          if (status === grpc.Code.OK) {
            if (message) {
              resolve(message)
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
