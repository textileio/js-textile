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
  ArchiveInfo,
  ArchiveStatus,
  bucketsArchive,
  bucketsArchiveInfo,
  bucketsArchiveStatus,
  bucketsArchiveWatch,
  bucketsCreate,
  bucketsLinks,
  bucketsList,
  bucketsListIpfsPath,
  bucketsPullIpfsPath,
  bucketsPullPath,
  bucketsPullPathAccessRoles,
  bucketsPushPath,
  bucketsPushPathAccessRoles,
  bucketsRemove,
  bucketsRemovePath,
  bucketsRoot,
  bucketsSetPath,
  CreateObject,
  LinksObject,
  PathAccessRole,
  PathItemObject,
  PathObject,
  PushPathResult,
  RootObject,
} from './api'
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
  static copyAuth(auth: GrpcAuthentication, options?: CopyAuthOptions) {
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
  static withUserAuth(auth: UserAuth | (() => Promise<UserAuth>), options?: WithUserAuthOptions) {
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
  static async withKeyInfo(key: KeyInfo, options?: WithKeyInfoOptions) {
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
   *   const buckets = await Buckets.withThread(threadID)
   * }
   * ```
   */
  withThread(threadID?: string) {
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
  async getToken(identity: Identity) {
    return super.getToken(identity)
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
   * @param isPrivate encrypt the bucket contents (default `false`)
   * @param threadID id of thread where bucket is stored
   * @deprecated Open has been replaced with getOrCreate
   */
  async open(
    name: string,
    threadName = 'buckets',
    isPrivate = false,
    threadID?: string,
  ): Promise<{ root?: RootObject; threadID?: string }> {
    return this.getOrCreate(name, threadName, isPrivate, undefined, threadID)
  }

  /**
   * (Deprecated) Open a new / existing bucket by bucket name and ThreadID (create not required)
   * @param name name of bucket
   * @param threadName the name of the thread where the bucket is stored (default `buckets`)
   * @param isPrivate encrypt the bucket contents (default `false`)
   * @param threadID id of thread where bucket is stored
   * @deprecated getOrInit has been replaced with getOrCreate
   */
  async getOrInit(
    name: string,
    threadName = 'buckets',
    isPrivate = false,
    threadID?: string,
  ): Promise<{ root?: RootObject; threadID?: string }> {
    return this.getOrCreate(name, threadName, isPrivate, undefined, threadID)
  }

  /**
   * Open a new / existing bucket by bucket name and ThreadID (create not required)
   * Replaces `open` command in older versions.
   * @param name name of bucket
   * @param threadName (optional) the name of the thread where the bucket is stored (default `buckets`)
   * @param isPrivate (optional) encrypt the bucket contents (default `false`)
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
    threadName = 'buckets',
    isPrivate = false,
    cid?: string,
    threadID?: string,
  ): Promise<{ root?: RootObject; threadID?: string }> {
    const client = new Client(this.context)
    if (threadID) {
      const id = threadID
      const res = await client.listThreads()
      const exists = res.listList.find((thread: any) => thread.id === id)
      if (!exists) {
        const id = ThreadID.fromString(threadID)
        await client.newDB(id, threadName)
      }
      this.withThread(threadID)
    } else {
      try {
        const res = await client.getThread(threadName)
        threadID = typeof res.id === 'string' ? res.id : ThreadID.fromBytes(res.id).toString()
        this.withThread(threadID)
      } catch (error) {
        if (error.message !== 'Thread not found') {
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
    const created = await this.create(name, isPrivate, cid)
    return { root: created.root, threadID }
  }

  /**
   * (Deprecated) Creates a new bucket.
   * @param name Human-readable bucket name. It is only meant to help identify a bucket in a UI and is not unique.
   * @param isPrivate encrypt the bucket contents (default `false`)
   * @deprecated Init has been replaced by create
   */
  async init(name: string, isPrivate = false): Promise<CreateObject> {
    return this.create(name, isPrivate)
  }

  /**
   * Creates a new bucket.
   * @public
   * @param name Human-readable bucket name. It is only meant to help identify a bucket in a UI and is not unique.
   * @param isPrivate encrypt the bucket contents (default `false`)
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
  async create(name: string, isPrivate = false, cid?: string): Promise<CreateObject> {
    logger.debug('create request')
    return bucketsCreate(this, name, isPrivate, cid)
  }

  /**
   * Returns the bucket root CID
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   */
  async root(key: string) {
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
  async links(key: string, path = '/'): Promise<LinksObject> {
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
  async list() {
    logger.debug('list request')
    return bucketsList(this)
  }

  /**
   * Returns information about a bucket path.
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   * @param path A file/object (sub)-path within a bucket.
   * @param depth (optional) will walk the entire bucket to target depth (default = 1)
   */
  async listPath(key: string, path: string, depth = 1): Promise<PathObject> {
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
  async listPathFlat(key: string, path: string, dirs = true, depth = 5): Promise<Array<string>> {
    logger.debug('list path recursive request')
    return await listPathFlat(this, key, path, dirs, depth)
  }

  /**
   * listIpfsPath returns items at a particular path in a UnixFS path living in the IPFS network.
   * @param path UnixFS path
   */
  async listIpfsPath(path: string): Promise<PathItemObject | undefined> {
    logger.debug('list path request')
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
  async pushPath(
    key: string,
    path: string,
    input: any,
    opts?: { progress?: (num?: number) => void },
  ): Promise<PushPathResult> {
    return bucketsPushPath(this, key, path, input, opts)
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
  pullPath(key: string, path: string, opts?: { progress?: (num?: number) => void }): AsyncIterableIterator<Uint8Array> {
    return bucketsPullPath(this, key, path, opts)
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
  pullIpfsPath(path: string, opts?: { progress?: (num?: number) => void }): AsyncIterableIterator<Uint8Array> {
    return bucketsPullIpfsPath(this, path, opts)
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
  async remove(key: string) {
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
  async removePath(key: string, path: string, root?: string) {
    logger.debug('remove path request')
    return bucketsRemovePath(this, key, path, root)
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
   * 
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
  async pushPathAccessRoles(key: string, path: string, roles: Map<string, PathAccessRole>) {
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
  async pullPathAccessRoles(key: string, path?: string) {
    logger.debug('pull path access roles request')
    return bucketsPullPathAccessRoles(this, key, path)
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
   *
   * @example
   * Remove a file by its relative path
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * async function archive (buckets: Buckets, key: string) {
   *    buckets.archive(key)
   * }
   * ```
   */
  async archive(key: string) {
    logger.debug('archive request')
    return bucketsArchive(this, key)
  }

  /**
   * archiveStatus returns the status of a Filecoin bucket archive.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   *
   * @example
   * Remove a file by its relative path
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * async function status (buckets: Buckets, key: string) {
   *    buckets.archive(key)
   * }
   * ```
   */
  async archiveStatus(key: string): Promise<ArchiveStatus> {
    logger.debug('archive status request')
    return bucketsArchiveStatus(this, key)
  }

  /**
   * archiveInfo returns info about a Filecoin bucket archive.
   * @beta
   * @param key Unique (IPNS compatible) identifier key for a bucket.
   *
   * @example
   * Display the info for an existing archives of the bucket
   * ```typescript
   * import { Buckets } from '@textile/hub'
   *
   * async function log (buckets: Buckets, key: string) {
   *    const info = await buckets.archiveInfo(key)
   *    console.log(info.cid, info.deals.length)
   * }
   * ```
   */
  async archiveInfo(key: string): Promise<ArchiveInfo> {
    logger.debug('archive info request')
    return bucketsArchiveInfo(this, key)
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
  async archiveWatch(key: string, callback: (reply?: { id: string | undefined; msg: string }, err?: Error) => void) {
    logger.debug('archive watch request')
    return bucketsArchiveWatch(this, key, callback)
  }
}
