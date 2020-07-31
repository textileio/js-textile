import nacl from 'tweetnacl'
import multibase from 'multibase'
import { Private, Public } from './identity'
import { encodePublicKey, encodePrivateKey, KeyType } from './proto.keys'
import { publicKeyToString, privateKeyFromString, publicKeyBytesFromString, encrypt, decrypt } from './utils'

export function privateKeyToString(key: PrivateKey) {
  const encoded = multibase.encode('base32', key.bytes as Buffer)
  return new TextDecoder().decode(encoded)
}

export class PublicKey implements Public {
  constructor(public pubKey: Uint8Array, public type: string = 'ed25519') {
    if (type !== 'ed25519') {
      throw new Error('Invalid keys type')
    }
    this.type = type || 'ed25519'
  }
  /**
   * Verifies if `signature` for `data` is valid.
   * @param data Signed data
   * @param signature Signature
   */
  async verify(data: Uint8Array, signature: Uint8Array) {
    return nacl.sign.detached.verify(data, signature, this.pubKey)
  }

  toString(): string {
    return publicKeyToString(this)
  }

  static fromString(str: string) {
    const bytes = publicKeyBytesFromString(str)
    return new PublicKey(bytes, 'ed25519')
  }

  get bytes(): Uint8Array {
    return encodePublicKey({
      Type: KeyType.Ed25519,
      Data: this.pubKey,
    })
  }

  encrypt(data: Uint8Array): Promise<Uint8Array> {
    return encrypt(data, this.pubKey, this.type)
  }
}

export class PrivateKey implements Private {
  pubKey: Uint8Array
  seed: Uint8Array
  privKey: Uint8Array
  /**
   * Constructor
   * @param secretKey Raw secret key (32-byte secret seed in ed25519`)
   * @param type Public-key signature system name. (currently only `ed25519` keys are supported)
   */
  constructor(secretKey: Uint8Array, public type: string = 'ed25519') {
    if (type !== 'ed25519') {
      throw new Error('Invalid keys type')
    }
    this.type = type || 'ed25519'
    const secret = Uint8Array.from(secretKey)
    if (secret.length !== 32) {
      throw new Error('secretKey length is invalid')
    }
    const naclKeys = nacl.sign.keyPair.fromSeed(secret)
    this.seed = secret
    this.privKey = naclKeys.secretKey
    this.pubKey = naclKeys.publicKey
  }

  /**
   * Returns `true` if this `Keypair` object contains secret key and can sign.
   */
  canSign(): boolean {
    return !!this.privKey
  }

  /**
   * Signs data.
   * @param data Data to sign
   */
  async sign(data: Uint8Array): Promise<Uint8Array> {
    if (!this.canSign()) {
      throw new Error('cannot sign: no secret key available')
    }
    return nacl.sign.detached(data, this.privKey)
  }

  get public(): PublicKey {
    return new PublicKey(this.pubKey)
  }

  get bytes(): Uint8Array {
    return encodePrivateKey({
      Type: KeyType.Ed25519,
      Data: this.privKey,
    })
  }

  /**
   * Creates a new `Keypair` object from ed25519 secret key seed raw bytes.
   *
   * @param rawSeed Raw 32-byte ed25519 secret key seed
   */
  static fromRawEd25519Seed(rawSeed: Uint8Array): PrivateKey {
    return new this(rawSeed, 'ed25519')
  }
  /**
   * Create a random `PrivateKey` object.
   */
  static fromRandom(): PrivateKey {
    const secret = nacl.randomBytes(32)
    return this.fromRawEd25519Seed(secret)
  }

  toString(): string {
    return privateKeyToString(this)
  }

  static fromString(str: string): PrivateKey {
    return new PrivateKey(privateKeyFromString(str), 'ed25519')
  }

  decrypt(ciphertext: Uint8Array): Promise<Uint8Array> {
    return decrypt(ciphertext, this.privKey, this.type)
  }
}
