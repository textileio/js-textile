import {
  ArchiveInfoReply,
  ArchiveReply,
  ArchiveStatusReply,
  InitReply,
  LinksReply,
  ListPathItem,
  ListPathReply,
  Root,
} from "@textile/buckets-grpc/buckets_pb"
import { Context, defaultHost } from "@textile/context"
import { Client } from "@textile/hub-threads-client"
import { KeyInfo, UserAuth } from "@textile/security"
import { Identity } from "@textile/threads-core"
import { ThreadID } from "@textile/threads-id"
import log from "loglevel"
import {
  bucketsArchive,
  bucketsArchiveInfo,
  bucketsArchiveStatus,
  bucketsArchiveWatch,
  BucketsGrpcClient,
  bucketsInit,
  bucketsLinks,
  bucketsList,
  bucketsListIpfsPath,
  bucketsListPath,
  bucketsPullIpfsPath,
  bucketsPullPath,
  bucketsPushPath,
  bucketsRemove,
  bucketsRemovePath,
  bucketsRoot,
  PushPathResult,
} from "./api"

const logger = log.getLogger("buckets")

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
export class Buckets extends BucketsGrpcClient {
  /**
   * Creates a new gRPC client instance for accessing the Textile Buckets API.
   * @param auth The user auth object.
   */
  static withUserAuth(
    auth: UserAuth | (() => Promise<UserAuth>),
    host = defaultHost,
    debug = false
  ): Buckets {
    const context =
      typeof auth === "object"
        ? Context.fromUserAuth(auth, host)
        : Context.fromUserAuthCallback(auth, host)
    return new Buckets(context, debug)
  }

  /**
   * Create a new gRPC client Bucket instance from a supplied key and secret
   * @param key The KeyInfo object containing {key: string, secret: string}
   */
  static async withKeyInfo(
    key: KeyInfo,
    host = defaultHost,
    debug = false
  ): Promise<Buckets> {
    const context = new Context(host)
    await context.withKeyInfo(key)
    return new Buckets(context, debug)
  }

  /**
   * Scopes to a Thread by ID
   * @param threadId the ID of the thread
   */
  withThread(threadID?: string): this | undefined {
    if (threadID === undefined) return this
    this.context.withThread(threadID)
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
    threadName = "buckets",
    isPrivate = false,
    threadID?: string
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
        const existingId =
          typeof res.id === "string"
            ? res.id
            : ThreadID.fromBytes(res.id).toString()
        this.withThread(existingId)
      } catch (error) {
        if (error.message !== "Thread not found") {
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
  async getToken(identity: Identity): Promise<string> {
    const client = new Client(this.context)
    return client.getToken(identity)
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
    callback: (challenge: Uint8Array) => Uint8Array | Promise<Uint8Array>
  ): Promise<string> {
    const client = new Client(this.context)
    return client.getTokenChallenge(publicKey, callback)
  }

  /**
   * Initializes a new bucket.
   * @public
   * @param name Human-readable bucket name. It is only meant to help identify a bucket in a UI and is not unique.
   * @param isPrivate encrypt the bucket contents (default `false`)
   * @example
   * Initialize a Bucket called "app-name-files"
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const init = async (buckets: Buckets) => {
   *     return buckets.init("app-name-files")
   * }
   * ```
   */
  async init(name: string, isPrivate = false): Promise<InitReply.AsObject> {
    logger.debug("init request")
    return bucketsInit(this, name, isPrivate)
  }

  /**
   * Returns the bucket root CID
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async root(key: string): Promise<Root.AsObject | undefined> {
    logger.debug("root request")
    return bucketsRoot(this, key)
  }

  /**
   * Returns a list of bucket links.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @example
   * Generate the HTTP, IPNS, and IPFS links for a Bucket
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const getLinks = async (buckets: Buckets, bucketKey: string) => {
   *    const links = await buckets.links(bucketKey)
   *    return links
   * }
   *
   * const getIpfs = async (buckets: Buckets, bucketKey: string) => {
   *    const links = await buckets.links(bucketKey)
   *    return links.ipfs
   * }
   * ```
   */
  async links(key: string): Promise<LinksReply.AsObject> {
    logger.debug("link request")
    return bucketsLinks(this, key)
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
  async list(): Promise<Root.AsObject[]> {
    logger.debug("list request")
    return bucketsList(this)
  }

  /**
   * Returns information about a bucket path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   */
  async listPath(key: string, path: string): Promise<ListPathReply.AsObject> {
    logger.debug("list path request")
    return bucketsListPath(this, key, path)
  }

  /**
   * listIpfsPath returns items at a particular path in a UnixFS path living in the IPFS network.
   * @param path UnixFS path
   */
  async listIpfsPath(path: string): Promise<ListPathItem.AsObject | undefined> {
    logger.debug("list path request")
    return bucketsListIpfsPath(this, path)
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
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const pushFile = async (buckets: Buckets, content: string, bucketKey: string) => {
   *    const file = { path: '/index.html', content: Buffer.from(content) }
   *    return await buckets.pushPath(bucketKey!, 'index.html', file)
   * }
   * ```
   */
  async pushPath(
    key: string,
    path: string,
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    input: any,
    opts?: { progress?: (num?: number) => void }
  ): Promise<PushPathResult> {
    return bucketsPushPath(this, key, path, input, opts)
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
    opts?: { progress?: (num?: number) => void }
  ): AsyncIterableIterator<Uint8Array> {
    return bucketsPullPath(this, key, path, opts)
  }

  /**
   * pullIpfsPath pulls the path from a remote UnixFS dag, writing it to writer if it's a file.
   * @param path A file/object (sub)-path within a bucket.
   * @param opts Options to control response stream. Currently only supports a progress function.
   */
  pullIpfsPath(
    path: string,
    opts?: { progress?: (num?: number) => void }
  ): AsyncIterableIterator<Uint8Array> {
    return bucketsPullIpfsPath(this, path, opts)
  }

  /**
   * Removes an entire bucket. Files and directories will be unpinned.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async remove(key: string): Promise<void> {
    logger.debug("remove request")
    return bucketsRemove(this, key)
  }

  /**
   * Returns information about a bucket path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param root optional to specify a root
   */
  async removePath(key: string, path: string, root?: string): Promise<void> {
    logger.debug("remove path request")
    return bucketsRemovePath(this, key, path, root)
  }

  /**
   * archive creates a Filecoin bucket archive via Powergate.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async archive(key: string): Promise<ArchiveReply.AsObject> {
    logger.debug("archive request")
    return bucketsArchive(this, key)
  }

  /**
   * archiveStatus returns the status of a Filecoin bucket archive.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async archiveStatus(key: string): Promise<ArchiveStatusReply.AsObject> {
    logger.debug("archive status request")
    return bucketsArchiveStatus(this, key)
  }

  /**
   * archiveInfo returns info about a Filecoin bucket archive.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async archiveInfo(key: string): Promise<ArchiveInfoReply.AsObject> {
    logger.debug("archive info request")
    return bucketsArchiveInfo(this, key)
  }

  /**
   * archiveWatch watches status events from a Filecoin bucket archive.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async archiveWatch(
    key: string,
    callback: (
      reply?: { id: string | undefined; msg: string },
      err?: Error
    ) => void
  ): Promise<() => void> {
    logger.debug("archive watch request")
    return bucketsArchiveWatch(this, key, callback)
  }
}
