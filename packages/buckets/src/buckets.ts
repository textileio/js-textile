import { Identity } from '@textile/crypto'
import {
  CopyAuthOptions,
  GrpcAuthentication,
  WithKeyInfoOptions,
  WithUserAuthOptions,
} from '@textile/grpc-authentication'
import { Client } from '@textile/hub-threads-client'
import { KeyInfo, UserAuth } from '@textile/security'
import { ThreadID } from '@textile/threads-id'
import log from 'loglevel'
import {
  bucketsArchive,
  bucketsArchives,
  bucketsArchiveWatch,
  bucketsCreate,
  bucketsDefaultArchiveConfig,
  bucketsLinks,
  bucketsList,
  bucketsListIpfsPath,
  bucketsMovePath,
  bucketsPullIpfsPath,
  bucketsPullPath,
  bucketsPullPathAccessRoles,
  bucketsPushPath,
  bucketsPushPathAccessRoles,
  bucketsPushPaths,
  bucketsRemove,
  bucketsRemovePath,
  bucketsRoot,
  bucketsSetDefaultArchiveConfig,
  bucketsSetPath,
  CHUNK_SIZE,
} from './api'
import {
  ArchiveConfig,
  ArchiveOptions,
  Archives,
  CreateOptions,
  CreateResponse,
  GetOrCreateOptions,
  GetOrCreateResponse,
  Links,
  Path,
  PathAccessRole,
  PathItem,
  PushOptions,
  PushPathResult,
  PushPathsResult,
  RemovePathOptions,
  RemovePathResponse,
  Root,
} from './types'
import { listPathFlat, listPathRecursive } from './utils'

const logger = log.getLogger('buckets')

/**
 * Buckets a client wrapper for interacting with the Textile Buckets API.
 * @example
 * Initialize the Bucket API and open an existing bucket (or create if new).
 * ```typescript
 * import { Buckets, UserAuth } from '@textile/hub'
 *
 * const getOrCreate = async (auth: UserAuth, bucketName: string) => {
 *   const buckets = Buckets.withUserAuth(auth)
 *   // Automatically scopes future calls on `buckets` to the Thread containing the bucket
 *   const { root, threadID } = await buckets.getOrCreate(bucketName)
 *   if (!root) throw new Error('bucket not created')
 *   const bucketKey = root.key
 *   return { buckets, bucketKey }
 * }
 * ```
 *
 * @example
 * Print the links for the bucket
 * ```typescript
 * import { Buckets } from '@textile/hub'
 *
 * // This method requires that you run "getOrCreate" or have specified "withThread"
 * async function logLinks (buckets: Buckets, bucketKey: string) {
 *   const links = await buckets.links(bucketKey)
 *   console.log(links)
 * }
 * ```
 *
 * @example
 * Find an existing Bucket
 * ```typescript
 * import { Buckets } from '@textile/hub'
 *
 * // This method requires that you already specify the Thread containing
 * // the bucket with buckets.withThread(<thread name>).
 * const exists = async (buckets: Buckets, bucketName: string) => {
 *     const roots = await buckets.list();
 *     return roots.find((bucket) => bucket.name === bucketName)
 * }
 * ```
 *
 * @example
 * Push an folder in node.js
 * ```typescript
 * import fs from 'fs'
 * import util from 'util'
 * import glob from 'glob'
 * import { Buckets } from '@textile/hub'
 *
 * const globDir = util.promisify(glob)
 *
 * // expects an already setup buckets session using getOrCreate or withThread
 * const exists = async (buckets: Buckets, bucketKey: string, dir: string) => {
 *   const files = await globDir('<dir glob options>')
 *   return await Promise.all(files.map(async (file) => {
 *     const filePath = dir + '/' + file
 *     var content = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 * 3 });
 *     const upload = {
 *       path: file,
 *       content
 *     }
 *     return await buckets.pushPath(bucketKey, file, upload)
 *   }))
 * }
 * ```
 */
export class Buckets extends GrpcAuthentication {
  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.copyAuth}
   *
   * @example
   * Copy an authenticated Users api instance to Buckets.
   * ```typescript
   * import { Buckets, Users } from '@textile/hub'
   *
   * const usersToBuckets = async (user: Users) => {
   *   const buckets = Buckets.copyAuth(user)
   *   return buckets
   * }
   * ```
   *
   * @example
   * Copy an authenticated Buckets api instance to Users.
   * ```typescript
   * import { Buckets, Users } from '@textile/hub'
   *
   * const bucketsToUsers = async (buckets: Buckets) => {
   *   const user = Users.copyAuth(buckets)
   *   return user
   * }
   * ```
   */
  static copyAuth(
    auth: GrpcAuthentication,
    options?: CopyAuthOptions,
  ): Buckets {
    return new Buckets(auth.context, options?.debug)
  }
  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.withUserAuth}
   *
   * @example
   * ```@typescript
   * import { Buckets, UserAuth } from '@textile/hub'
   *
   * async function example (userAuth: UserAuth) {
   *   const buckets = await Buckets.withUserAuth(userAuth)
   * }
   * ```
   */
  static withUserAuth(
    auth: UserAuth | (() => Promise<UserAuth>),
    options?: WithUserAuthOptions,
  ): Buckets {
    const res = super.withUserAuth(auth, options)
    return this.copyAuth(res, options)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.withKeyInfo}
   *
   * @example
   * ```@typescript
   * import { Buckets, KeyInfo } from '@textile/hub'
   *
   * async function start () {
   *   const keyInfo: KeyInfo = {
   *     key: '<api key>',
   *     secret: '<api secret>'
   *   }
   *   const buckets = await Buckets.withKeyInfo(keyInfo)
   * }
   * ```
   */
  static async withKeyInfo(
    key: KeyInfo,
    options?: WithKeyInfoOptions,
  ): Promise<Buckets> {
    const auth = await super.withKeyInfo(key, options)
    return this.copyAuth(auth, options)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.withThread}
   *
   * @example
   * ```@typescript
   * import { Buckets, ThreadID } from '@textile/hub'
   *
   * async function example (threadID: ThreadID) {
   *   const id = threadID.toString()
   *   const buckets = await Buckets.withThread(id)
   * }
   * ```
   */
  withThread(threadID?: string): void {
    return super.withThread(threadID)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.getToken}
   *
   * @example
   * ```@typescript
   * import { Buckets, PrivateKey } from '@textile/hub'
   *
   * async function example (buckets: Buckets, identity: PrivateKey) {
   *   const token = await buckets.getToken(identity)
   *   return token // already added to `buckets` scope
   * }
   * ```
   */
  async getToken(identity: Identity): Promise<string> {
    return super.getToken(identity)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.getToken}
   */
  setToken(token: string): Promise<void> {
    return super.setToken(token)
  }

  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.getTokenChallenge}
   *
   * @example
   * ```typescript
   * import { Buckets, PrivateKey } from '@textile/hub'
   *
   * async function example (buckets: Buckets, identity: PrivateKey) {
   *   const token = await buckets.getTokenChallenge(
   *     identity.public.toString(),
   *     (challenge: Uint8Array) => {
   *       return new Promise((resolve, reject) => {
   *         // This is where you should program PrivateKey to respond to challenge
   *         // Read more here: https://docs.textile.io/tutorials/hub/production-auth/
   *       })
   *     }
   *   )
   *   return token
   * }
   * ```
   */
  async getTokenChallenge(
    publicKey: string,
    callback: (challenge: Uint8Array) => Uint8Array | Promise<Uint8Array>,
  ): Promise<string> {
    return super.getTokenChallenge(publicKey, callback)
  }

  /**
   * (Deprecated) Open a new / existing bucket by bucket name and ThreadID (create not required)
   * @param name name of bucket
   * @param threadName the name of the thread where the bucket is stored (default `buckets`)
   * @param encrypted encrypt the bucket contents (default `false`)
   * @param threadID id of thread where bucket is stored
   * @deprecated Open has been replaced with getOrCreate
   */
  async open(
    name: string,
    threadName = 'buckets',
    encrypted = false,
    threadID?: string,
  ): Promise<{ root?: Root; threadID?: string }> {
    const options: GetOrCreateOptions = {
      threadName: threadName && threadName !== '' ? threadName : 'buckets',
      encrypted: !!encrypted,
      threadID,
    }
    return this.getOrCreate(name, options)
  }

  /**
   * (Deprecated) Open a new / existing bucket by bucket name and ThreadID (create not required)
   * @param name name of bucket
   * @param threadName the name of the thread where the bucket is stored (default `buckets`)
   * @param encrypted encrypt the bucket contents (default `false`)
   * @param threadID id of thread where bucket is stored
   * @deprecated getOrInit has been replaced with getOrCreate
   */
  async getOrInit(
    name: string,
    threadName = 'buckets',
    encrypted = false,
    threadID?: string,
  ): Promise<{ root?: Root; threadID?: string }> {
    const options: GetOrCreateOptions = {
      threadName: threadName && threadName !== '' ? threadName : 'buckets',
      encrypted: !!encrypted,
      threadID,
    }
    return this.getOrCreate(name, options)
  }

  /**
   * Open a new / existing bucket by bucket name and ThreadID (create not required)
   * Replaces `open` command in older versions.
   * @param name name of bucket
   * @param threadName (optional) the name of the thread where the bucket is stored (default `buckets`)
   * @param encrypted (optional) encrypt the bucket contents (default `false`)
   * @param cid (optional) Bootstrap the bucket with a UnixFS Cid from the IPFS network
   * @param threadID (optional) id of thread where bucket is stored
   *
   * @remarks
   * The IPFS protocol and its implementations are still in heavy
   * development. By using Textile, you are acknowledging that you
   * understand there may be risks to storing your content on or
   * using decentralized storage services.
   *
   * @example
   * Create a Bucket called "app-name-files"
   * ```typescript
   * import { Buckets, UserAuth } from '@textile/hub'
   *
   * const open = async (auth: UserAuth, name: string) => {
   *     const buckets = Buckets.withUserAuth(auth)
   *     const { root, threadID } = await buckets.getOrCreate(name)
   *     return { buckets, root, threadID }
   * }
   * ```
   */
  async getOrCreate(
    name: string,
    options?: GetOrCreateOptions,
  ): Promise<GetOrCreateResponse>
  async getOrCreate(
    name: string,
    options?: string | GetOrCreateOptions,
    encrypted?: boolean,
    cid?: string,
    threadID?: string,
  ): Promise<{ root?: Root; threadID?: string }> {
    if (!options && (encrypted || cid || threadID)) {
      // Case where threadName passed as undefined using old signature
      console.warn(
        'Update Buckets.getOrCreate to use GetOrCreateOptions input.',
      )
      return this._getOrCreate(name, 'buckets', !!encrypted, cid, threadID)
    } else if (!options) {
      return this._getOrCreate(name)
    } else if (typeof options !== 'object') {
      // Case where using old signature
      console.warn(
        'Update Buckets.getOrCreate to use GetOrCreateOptions input.',
      )
      return this._getOrCreate(name, options, !!encrypted, cid, threadID)
    } else {
      // Using new signature
      const threadName =
        options.threadName && options.threadName !== ''
          ? options.threadName
          : 'buckets'
      const encrypted = !!options.encrypted
      return this._getOrCreate(
        name,
        threadName,
        encrypted,
        options.cid,
        options.threadID,
      )
    }
  }
  /**
   * @internal
   */
  private async _getOrCreate(
    name: string,
    threadName = 'buckets',
    encrypted = false,
    cid?: string,
    threadID?: string,
  ): Promise<{ root?: Root; threadID?: string }> {
    const client = new Client(this.context)
    if (threadID) {
      const id = threadID
      const res = await client.listThreads()
      const exists = res.find((thread: any) => thread.id === id)
      if (!exists) {
        const id = ThreadID.fromString(threadID)
        await client.newDB(id, threadName)
      }
      this.withThread(threadID)
    } else {
      try {
        const res = await client.getThread(threadName)
        threadID =
          typeof res.id === 'string'
            ? res.id
            : ThreadID.fromBytes(res.id).toString()
        this.withThread(threadID)
      } catch (error) {
        if (
          error.message !== 'Thread not found' &&
          !error.message.includes('mongo: no documents in result')
        ) {
          throw new Error(error.message)
        }
        const newId = ThreadID.fromRandom()
        await client.newDB(newId, threadName)
        threadID = newId.toString()
        this.withThread(threadID)
      }
    }

    const roots = await this.list()
    const existing = roots.find((bucket) => bucket.name === name)
    if (existing) {
      return { root: existing, threadID }
    }
    const created = await this.create(name, { encrypted, cid })
    return { root: created.root, threadID }
  }

  /**
   * Existing lists all remote buckets in the thread or in all threads.
   * @param threadID (optional) if threadID is not defined, this will return buckets from all threads.
   */
  async existing(threadID?: string): Promise<Root[]> {
    const client = new Client(this.context)
    const threads = []

    if (threadID) {
      threads.push(threadID)
    } else {
      const res = await client.listThreads()
      for (const thread of res) {
        if (thread.id) threads.push(thread.id)
      }
    }

    const bucketList: Root[] = []
    for (const id of threads) {
      this.withThread(id)
      for (const root of await this.list()) {
        bucketList.push(root)
      }
    }
    // Clear the currently used thread
    this.withThread(undefined)

    return bucketList
  }

  /**
   * (Deprecated) Creates a new bucket.
   * @param name Human-readable bucket name. It is only meant to help identify a bucket in a UI and is not unique.
   * @param encrypted encrypt the bucket contents (default `false`)
   * @deprecated Init has been replaced by create
   */
  async init(name: string, encrypted = false): Promise<CreateResponse> {
    return this.create(name, { encrypted })
  }

  /**
   * Creates a new bucket.
   * @public
   * @param name Human-readable bucket name. It is only meant to help identify a bucket in a UI and is not unique.
   * @param encrypted encrypt the bucket contents (default `false`)
   * @param cid (optional) Bootstrap the bucket with a UnixFS Cid from the IPFS network
   * @example
   * Create a Bucket called "app-name-files"
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const create = async (buckets: Buckets) => {
   *     return buckets.create("app-name-files")
   * }
   * ```
   */
  async create(name: string, options?: CreateOptions): Promise<CreateResponse>
  async create(
    name: string,
    options?: boolean | CreateOptions,
    cid?: string,
  ): Promise<CreateResponse> {
    logger.debug('create request')
    if (typeof options == 'object') {
      return bucketsCreate(this, name, !!options.encrypted, options.cid)
    } else {
      if (options !== undefined || cid !== undefined) {
        console.warn('Update Buckets.create to use CreateOptions input.')
      }
      const encrypted = !!options
      return bucketsCreate(this, name, encrypted, cid)
    }
  }

  /**
   * Returns the bucket root CID
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async root(key: string): Promise<Root | undefined> {
    logger.debug('root request')
    return bucketsRoot(this, key)
  }

  /**
   * Returns a list of bucket links.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path path within the bucket for links (default '/').
   * @example
   * Generate the HTTP, IPNS, and IPFS links for a Bucket
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const getIpnsLink = async (buckets: Buckets, bucketKey: string) => {
   *    const links = await buckets.links(bucketKey)
   *    return links.ipns
   * }
   *
   * const getWwwLink = async (buckets: Buckets, bucketKey: string) => {
   *    const links = await buckets.links(bucketKey)
   *    return links.www
   * }
   * ```
   */
  async links(key: string, path = '/'): Promise<Links> {
    logger.debug('link request')
    return bucketsLinks(this, key, path)
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
  async list(): Promise<Root[]> {
    logger.debug('list request')
    return bucketsList(this)
  }

  /**
   * Returns information about a bucket path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param depth (optional) will walk the entire bucket to target depth (default = 1)
   */
  async listPath(key: string, path: string, depth = 1): Promise<Path> {
    logger.debug('list path request')
    return await listPathRecursive(this, key, path, depth)
  }

  /**
   * listPathRecursive returns a nested object of all paths (and info) in a bucket
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param dirs (optional) if false will include only file paths
   * @param depth (optional) will walk the entire bucket to target depth (default = 1)
   *
   * @example
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * async function printPaths(buckets: Buckets, bucketKey: string) {
   *   const list = await buckets.listPathFlat(bucketKey, '')
   *   console.log(list)
   * }
   * // [
   * //   '.textileseed',
   * //   'dir1',
   * //   'dir1/file1.jpg',
   * //   'path',
   * //   'path/to',
   * //   'path/to/file2.jpg'
   * // ]
   * ```
   */
  async listPathFlat(
    key: string,
    path: string,
    dirs = true,
    depth = 5,
  ): Promise<Array<string>> {
    logger.debug('list path recursive request')
    return await listPathFlat(this, key, path, dirs, depth)
  }

  /**
   * listIpfsPath returns items at a particular path in a UnixFS path living in the IPFS network.
   * @param path UnixFS path
   */
  async listIpfsPath(path: string): Promise<PathItem | undefined> {
    logger.debug('list path request')
    return bucketsListIpfsPath(this, path)
  }

  /**
   * Move a file or subpath to a new path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param fromPath A file/object or subpath within a bucket.
   * @param toPath The path within a bucket to move fromPath to.
   *
   * @example
   * Push a file to the root of a bucket
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const moveToRoot = async (buckets: Buckets, key: string, fromPath: string) => {
   *    return await buckets.movePath(key, fromPath, "")
   * }
   * ```
   */
  async movePath(key: string, fromPath: string, toPath: string): Promise<void> {
    return bucketsMovePath(this, key, fromPath, toPath)
  }

  /**
   * Pushes a file to a bucket path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param input The input file/stream/object.
   * @param opts Options to control response stream.
   * @remarks
   * - This will return the resolved path and the bucket's new root path.
   * - If pushing NodeJS streams, ensure you set your highwatermark to an appropriate size
   * (i.e., ~1024 bytes) for optimal behavior on slow or intermittent connections. See example
   * below or use `utils.createReadStream`.
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
   *
   * @example
   * Push an folder in node.js
   * ```typescript
   * import fs from 'fs'
   * import util from 'util'
   * import glob from 'glob'
   * import { Buckets } from '@textile/hub'
   *
   * const globDir = util.promisify(glob)
   *
   * // expects an already setup buckets session using getOrCreate or withThread
   * const exists = async (buckets: Buckets, bucketKey: string, dir: string) => {
   *   const files = await globDir('<dir glob options>')
   *   return await Promise.all(files.map(async (file) => {
   *     const filePath = dir + '/' + file
   *     var content = fs.createReadStream(filePath, { highWaterMark: 1024 });
   *     const upload = {
   *       path: file,
   *       content
   *     }
   *     return await buckets.pushPath(bucketKey, file, upload)
   *   }))
   * }
   * ```
   */
  async pushPath(
    key: string,
    path: string,
    input: any,
    options?: PushOptions,
  ): Promise<PushPathResult> {
    return bucketsPushPath(this, key, path, input, options)
  }

  /**
   * Pushes an iterable of files to a bucket.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param input The input array of file/stream/objects.
   * @param options PushOptions to control response stream.
   * @example
   * Push a file to the root of a bucket
   * ```typescript
   * import fs from 'fs'
   * import path from 'path'
   * import util from 'util'
   * import glob from 'glob'
   * import { Buckets } from '@textile/hub'
   *
   * const globDir = util.promisify(glob)
   * 
   * const pushMultipleFile = async (buckets: Buckets, bucketKey: string, directory: string) => {
   *   const options = {
   *     directory,
   *     nodir: true,
   *   }
   *   const files = await globDir('**\/*', options)
   *   if (files.length === 0) {
   *     throw Error(`No files found: ${directory}`)
   *   }
   * 
   *   let streams = []
   *   for (const file of files) {
   *       const stream = fs.createReadStream(
   *         path.join(cwd, file), {
   *           highWaterMark: 1024,
   *         }
   *       )
   *       streams.push({
   *         path: file,
   *         content: stream,
   *       })
   *   }
   *   return await buckets.pushPaths(bucketKey, streams)
   * }
   * ```
   */
  pushPaths(
    key: string,
    input: any,
    options?: PushOptions,
  ): AsyncIterableIterator<PushPathsResult> {
    return bucketsPushPaths(this, key, input, options)
  }

  /**
   * Pulls the bucket path, returning the bytes of the given file.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param opts Options to control response stream. Currently only supports a progress function.
   *
   * @example
   * Pull a file by its relative path and console.log the progress.
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const pullFile = async (buckets: Buckets, key: string, path: string) => {
   *    const display = (num?: number) => {
   *      console.log('Progress:', num)
   *    }
   *    buckets.pullPath(key, path, {progress: display})
   * }
   * ```
   */
  pullPath(
    key: string,
    path: string,
    options?: { progress?: (num?: number) => void },
  ): AsyncIterableIterator<Uint8Array> {
    return bucketsPullPath(this, key, path, options)
  }

  /**
   * Pushes a file to a bucket path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param cid The IPFS cid of the dag to set at the path.
   *
   * @example
   * Push a file to the root of a bucket
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const pushRoot = async (buckets: Buckets, key: string, cid: string) => {
   *    return await buckets.setPath(key, '/', cid)
   * }
   * ```
   */
  async setPath(key: string, path: string, cid: string): Promise<void> {
    return bucketsSetPath(this, key, path, cid)
  }

  /**
   * pullIpfsPath pulls the path from a remote UnixFS dag, writing it to writer if it's a file.
   * @param path A file/object (sub)-path within a bucket.
   * @param opts Options to control response stream. Currently only supports a progress function.
   *
   * @example
   * Pull a file by its IPFS path and console.log the progress.
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const pullFile = async (buckets: Buckets, path: string) => {
   *    const display = (num?: number) => {
   *      console.log('Progress:', num)
   *    }
   *    buckets.pullIpfsPath(path, {progress: display})
   * }
   * ```
   */
  pullIpfsPath(
    path: string,
    options?: { progress?: (num?: number) => void },
  ): AsyncIterableIterator<Uint8Array> {
    return bucketsPullIpfsPath(this, path, options)
  }

  /**
   * Removes an entire bucket. Files and directories will be unpinned (cannot be undone).
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   *
   * @example
   * Remove a Bucket
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const remove = async (buckets: Buckets, key: string) => {
   *    buckets.remove(key)
   * }
   * ```
   */
  async remove(key: string): Promise<void> {
    logger.debug('remove request')
    return bucketsRemove(this, key)
  }

  /**
   * Returns information about a bucket path (cannot be undone).
   *
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A relative path within a bucket.
   * @param root optional to specify a root.
   *
   * @example
   * Remove a file by its relative path
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const remove = async (buckets: Buckets, key: string) => {
   *    buckets.remove(key)
   * }
   * ```
   */
  async removePath(
    key: string,
    path: string,
    options?: RemovePathOptions,
  ): Promise<RemovePathResponse> {
    logger.debug('remove path request')
    return bucketsRemovePath(this, key, path, options)
  }

  /**
   * Push new access roles per path in a Bucket
   *
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A relative path within a bucket.
   * @param roles Each user public key and the roles they will receive.
   *
   * @example
   * ```typescript
   * import { Buckets, PublicKey } from '@textile/hub'
   *
   * const grant = async (buckets: Buckets, key: string, peer: PublicKey) => {
   *    const roles = new Map()
   *    // NA = 0, Reader = 1, Writer = 2, Admin = 3
   *    roles.set(peer.toString(), 2)
   *    buckets.pushPathAccessRoles(key, '/', roles)
   * }
   * ```
   * @example
   * Grant read access to everyone at a path (in an encrypted bucket)
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const grant = async (buckets: Buckets, key: string) => {
   *    const roles = new Map()
   *    // NA = 0, Reader = 1, Writer = 2, Admin = 3
   *    roles.set('*', 1)
   *    buckets.pushPathAccessRoles(key, '/folder/containing/shared/things', roles)
   * }
   * ```
   */
  async pushPathAccessRoles(
    key: string,
    path: string,
    roles: Map<string, PathAccessRole>,
  ): Promise<void> {
    logger.debug('push path access roles request')
    return bucketsPushPathAccessRoles(this, key, path, roles)
  }

  /**
   * List the access roles per path in a Bucket
   *
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A relative path within a bucket.
   *
   * @example
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * const viewRoot = async (buckets: Buckets, key: string) => {
   *    const list = buckets.pullPathAccessRoles(key, '/')
   *    console.log(list)
   * }
   * ```
   */
  async pullPathAccessRoles(
    key: string,
    path?: string,
  ): Promise<Map<string, 0 | 1 | 2 | 3>> {
    logger.debug('pull path access roles request')
    return bucketsPullPathAccessRoles(this, key, path)
  }

  /**
   * (Experimental) Get the current default ArchiveConfig for the specified Bucket.
   *
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @returns The default ArchiveConfig for the specified Bucket.
   *
   * @example
   * Get the default ArchiveConfig
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * async function getDefaultConfig (buckets: Buckets, key: string) {
   *    const defaultConfig = await buckets.defaultArchiveConfig(key)
   * }
   * ```
   */
  async defaultArchiveConfig(key: string): Promise<ArchiveConfig> {
    logger.debug('default archive config request')
    return bucketsDefaultArchiveConfig(this, key)
  }

  /**
   * (Experimental) Set the default ArchiveConfig for the specified Bucket.
   *
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param config The ArchiveConfig to set as the new default.
   *
   * @example
   * Set the default ArchiveConfig
   * ```typescript
   * import { Buckets, ArchiveConfig } from '@textile/hub'
   *
   * async function setDefaultConfig (buckets: Buckets, key: string, config: ArchiveConfig) {
   *    await buckets.setDefaultArchiveConfig(key, config)
   * }
   * ```
   */
  async setDefaultArchiveConfig(
    key: string,
    config: ArchiveConfig,
  ): Promise<void> {
    logger.debug('set default archive config request')
    return bucketsSetDefaultArchiveConfig(this, key, config)
  }

  /**
   * (Experimental) Store a snapshot of the bucket on Filecoin.
   * @remarks
   * Filecoin support is experimental. By using Textile, you
   * are acknowledging that you understand there may be risks to
   * storing your content on or using decentralized storage
   * services.
   *
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param options An object to set options that control the behavor of archive.
   * @param skipAutomaticVerifiedDeal skips logic that automatically uses available datacap to make a verified deal for the archive.
   *
   * @example
   * Archive a Bucket.
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * async function archive (buckets: Buckets, key: string) {
   *    await buckets.archive(key)
   * }
   * ```
   */
  async archive(key: string, options?: ArchiveOptions, skipAutomaticVerifiedDeal?: boolean): Promise<void> {
    logger.debug('archive request')
    return bucketsArchive(this, key, options, skipAutomaticVerifiedDeal)
  }

  /**
   * archives returns the curent and historical archives for a Bucket.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   *
   * @example
   * Get current and historical archives
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * async function status (buckets: Buckets, key: string) {
   *    const { current, history } = await buckets.archives(key)
   * }
   * ```
   */
  async archives(key: string): Promise<Archives> {
    logger.debug('archives request')
    return bucketsArchives(this, key)
  }

  /**
   * archiveWatch watches status events from a Filecoin bucket archive.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   *
   * @example
   * Watch deal state changes for a active bucket archive request.
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * async function logChanges (buckets: Buckets, key: string) {
   *    const log = (reply?: {id?: string, msg: string}, err?: Error | undefined) => {
   *        if (err || !reply) return console.log(err)
   *        console.log(reply.id, reply.msg)
   *    }
   *    buckets.archiveWatch(key, log)
   * }
   * ```
   */
  async archiveWatch(
    key: string,
    callback: (
      reply?: { id: string | undefined; msg: string },
      err?: Error,
    ) => void,
  ): Promise<() => void> {
    logger.debug('archive watch request')
    return bucketsArchiveWatch(this, key, callback)
  }
}
