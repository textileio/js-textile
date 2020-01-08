// From libp2p-crypto

export type KeyTypes = 'ed25519' | 'rsa' | 'secp256k1'
// @todo: Export the specific key types as well
export interface PublicKey {
  verify(data: any, sig: any): Promise<any>
  marshal(): Buffer
  readonly bytes: Buffer
  equal(key: PublicKey): boolean
  hash(): Promise<Buffer>
}
export interface PrivateKey {
  sign(data: any): Promise<Buffer>
  readonly public: PublicKey
  marshal(): Buffer
  readonly bytes: Buffer
  equal(key: PublicKey): boolean
  hash(): Promise<Buffer>
  id(): Promise<string>
}

// Metadata holds info pertaining to event retention.
export interface Metadata {
  // The max age of an event after which it can be discarded.
  maxAge: number
  // The max count of events in a thread after which the oldest can be discarded.
  maxCount: number
}

// from peer-id

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace PeerID {
  export type KeyTypes = 'ed25519' | 'rsa' | 'secp256k1'
  export type CreateOptions = {
    bits: number
    keyType: KeyTypes
  }
  export type JSON = {
    id: string
    pubKey: string
    privKey: string
  }
}

interface PeerID {
  isEqual(other: PeerID | Buffer): boolean
  toB58String(): string
  toBytes(): Buffer
  toHexString(): string
  toJSON(): PeerID.JSON
}

export { PeerID }

export interface PeerIDConstructor {
  new (id: Buffer, privKey?: PrivateKey, pubKey?: PublicKey): PeerID
  create(optsOrCb: PeerID.CreateOptions): Promise<PeerID>
  createFromB58String(str: string): PeerID
  createFromBytes(buf: Buffer): PeerID
  createFromHexString(str: string): PeerID
  createFromJSON(json: JSON): Promise<PeerID>
  createFromPubKey(key: Buffer): Promise<PeerID>
  createFromPrivKey(key: Buffer): Promise<PeerID>
}
