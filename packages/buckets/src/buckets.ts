import log from 'loglevel'
import * as pb from '@textile/buckets-grpc/buckets_pb'
import { API, APIPushPath } from '@textile/buckets-grpc/buckets_pb_service'
import CID from 'cids'
import { EventIterator } from 'event-iterator'
import nextTick from 'next-tick'
import { grpc } from '@improbable-eng/grpc-web'
import { ContextInterface, Context, defaultHost } from '@textile/context'
import { Client } from '@textile/hub-threads-client'
import { Identity } from '@textile/threads-core'
import { UserAuth, KeyInfo } from '@textile/security'
import { ThreadID } from '@textile/threads-id'
import { Root } from '@textile/buckets-grpc/buckets_pb'
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
   * Open a new / existing bucket by bucket name and ThreadID (init not required)
   * @param name name of bucket
   * @param threadName the name of the thread where the bucket is stored (default `buckets`)
   * @param isPrivate encrypt the bucket contents (default `false`)
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
  async open(
    name: string,
    threadName = 'buckets',
    isPrivate = false,
    threadID?: string,
  ): Promise<Root.AsObject | undefined> {
    const client = new Client(this.context)
    if (threadID) {
      const id = threadID
      const res = await client.listThreads()
      const exists = res.listList.find((thread) => thread.id === id)
      if (!exists) {
        const id = ThreadID.fromString(threadID)
        await client.newDB(id, threadName)
      }
      this.withThread(threadID)
    } else {
      try {
        const res = await client.getThread(threadName)
        const existingId = typeof res.id === 'string' ? res.id : ThreadID.fromBytes(res.id).toString()
        this.withThread(existingId)
      } catch (error) {
        if (error.message !== 'Thread not found') {
          throw new Error(error.message)
        }
        const newId = ThreadID.fromRandom()
        await client.newDB(newId, threadName)
        this.withThread(newId.toString())
      }
    }

    const roots = await this.list()
    const existing = roots.find((bucket) => bucket.name === name)
    if (existing) {
      return existing
    }
    const created = await this.init(name, isPrivate)
    return created.root
  }

  /**
   * Obtain a token for interacting with the remote API.
   * @param identity A user identity to use for interacting with buckets.
   */
  async getToken(identity: Identity, ctx?: ContextInterface) {
    const client = new Client(this.context)
    return client.getToken(identity, ctx)
  }

  /**
   * Obtain a token for interacting with the remote API.
   * @param identity A user identity to use for interacting with buckets.
   * @param callback A callback function that takes a `challenge` argument and returns a signed
   * message using the input challenge and the private key associated with `publicKey`.
   * @note `publicKey` must be the corresponding public key of the private key used in `callback`.
   */
  async getTokenChallenge(
    publicKey: string,
    callback: (challenge: Uint8Array) => Uint8Array | Promise<Uint8Array>,
    ctx?: ContextInterface,
  ): Promise<string> {
    const client = new Client(this.context)
    return client.getTokenChallenge(publicKey, callback, ctx)
  }

  /**
   * Creates a new gRPC client instance for accessing the Textile Buckets API.
   * @param auth The user auth object.
   */
  static withUserAuth(auth: UserAuth | (() => Promise<UserAuth>), host = defaultHost, debug = false) {
    const context =
      typeof auth === 'object'
        ? Context.fromUserAuth(auth, host, debug)
        : Context.fromUserAuthCallback(auth, host, debug)
    return new Buckets(context)
  }

  /**
   * Create a new gRPC client Bucket instance from a supplied key and secret
   * @param key The KeyInfo object containing {key: string, secret: string}
   */
  static async withKeyInfo(key: KeyInfo, host = defaultHost, debug = false) {
    const context = new Context(host, debug)
    await context.withKeyInfo(key)
    return new Buckets(context)
  }

  /**
   * Scopes to a Thread by ID
   * @param threadId the ID of the thread
   */
  withThread(threadID?: string) {
    if (threadID === undefined) return this
    this.context.withThread(threadID)
  }

  /**
   * Initializes a new bucket.
   * @public
   * @param name Human-readable bucket name. It is only meant to help identify a bucket in a UI and is not unique.
   * @param isPrivate encrypt the bucket contents (default `false`)
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
  async init(name: string, isPrivate = false, ctx?: ContextInterface) {
    logger.debug('init request')
    const req = new pb.InitRequest()
    req.setName(name)
    req.setPrivate(isPrivate)
    const res: pb.InitReply = await this.unary(API.Init, req, ctx)
    return res.toObject()
  }

  /**
   * Returns the bucket root CID
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async root(key: string, ctx?: ContextInterface): Promise<pb.Root.AsObject | undefined> {
    logger.debug('root request')
    const req = new pb.RootRequest()
    req.setKey(key)
    const res: pb.RootReply = await this.unary(API.Root, req, ctx)
    return res.toObject().root
  }

  /**
   * Returns a list of bucket links.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
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
  async links(key: string, ctx?: ContextInterface): Promise<pb.LinksReply.AsObject> {
    logger.debug('link request')
    const req = new pb.LinksRequest()
    req.setKey(key)
    const res: pb.LinksReply = await this.unary(API.Links, req, ctx)
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
  async list(ctx?: ContextInterface): Promise<Array<pb.Root.AsObject>> {
    logger.debug('list request')
    const req = new pb.ListRequest()
    const res: pb.ListReply = await this.unary(API.List, req, ctx)
    return res.toObject().rootsList
  }

  /**
   * Returns information about a bucket path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
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
   * listIpfsPath returns items at a particular path in a UnixFS path living in the IPFS network.
   * @param path UnixFS path
   */
  async listIpfsPath(path: string, ctx?: ContextInterface) {
    logger.debug('list path request')
    const req = new pb.ListIpfsPathRequest()
    req.setPath(path)
    const res: pb.ListIpfsPathReply = await this.unary(API.ListIpfsPath, req, ctx)
    return res.toObject().item
  }

  /**
   * Pushes a file to a bucket path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param input The input file/stream/object.
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
    opts?: { progress?: (num?: number) => void },
    ctx?: ContextInterface,
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
   * @param opts Options to control response stream. Currently only supports a progress function.
   */
  pullPath(
    key: string,
    path: string,
    opts?: { progress?: (num?: number) => void },
    ctx?: ContextInterface,
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

  /**
   * pullIpfsPath pulls the path from a remote UnixFS dag, writing it to writer if it's a file.
   * @param path A file/object (sub)-path within a bucket.
   * @param opts Options to control response stream. Currently only supports a progress function.
   */
  pullIpfsPath(
    path: string,
    opts?: { progress?: (num?: number) => void },
    ctx?: ContextInterface,
  ): AsyncIterableIterator<Uint8Array> {
    const metadata = { ...this.context.toJSON(), ...ctx?.toJSON() }
    const request = new pb.PullIpfsPathRequest()
    request.setPath(path)
    let written = 0
    const events = new EventIterator<Uint8Array>(({ push, stop, fail }) => {
      const resp = grpc.invoke(API.PullIpfsPath, {
        host: this.serviceHost,
        transport: this.rpcOptions.transport,
        debug: this.rpcOptions.debug,
        request,
        metadata,
        onMessage: async (res: pb.PullIpfsPathReply) => {
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

  /**
   * Removes an entire bucket. Files and directories will be unpinned.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
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
   * archive creates a Filecoin bucket archive via Powergate.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async archive(key: string, ctx?: ContextInterface) {
    logger.debug('archive request')
    const req = new pb.ArchiveRequest()
    req.setKey(key)
    return await this.unary(API.Archive, req, ctx)
  }

  /**
   * archiveStatus returns the status of a Filecoin bucket archive.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async archiveStatus(key: string, ctx?: ContextInterface) {
    logger.debug('archive status request')
    const req = new pb.ArchiveStatusRequest()
    req.setKey(key)
    return await this.unary(API.ArchiveStatus, req, ctx)
  }

  /**
   * archiveInfo returns info about a Filecoin bucket archive.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async archiveInfo(key: string, ctx?: ContextInterface) {
    logger.debug('archive info request')
    const req = new pb.ArchiveInfoRequest()
    req.setKey(key)
    return await this.unary(API.ArchiveInfo, req, ctx)
  }

  /**
   * archiveWatch watches status events from a Filecoin bucket archive.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async archiveWatch(
    key: string,
    callback: (reply?: { id: string | undefined; msg: string }, err?: Error) => void,
    ctx?: ContextInterface,
  ) {
    logger.debug('archive watch request')
    const req = new pb.ArchiveWatchRequest()
    req.setKey(key)

    const metadata = { ...this.context.toJSON(), ...ctx?.toJSON() }
    const res = grpc.invoke(API.ArchiveWatch, {
      host: this.context.host,
      request: req,
      metadata,
      onMessage: (rec: pb.ArchiveWatchReply) => {
        const response = {
          id: rec.getJsPbMessageId(),
          msg: rec.getMsg(),
        }
        nextTick(() => callback(response))
      },
      onEnd: (status: grpc.Code, message: string, _trailers: grpc.Metadata) => {
        if (status !== grpc.Code.OK) {
          return callback(undefined, new Error(message))
        }
        callback()
      },
    })
    return res.close.bind(res)
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
