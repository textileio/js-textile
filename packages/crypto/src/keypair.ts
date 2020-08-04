import nacl from 'tweetnacl'
import multibase from 'multibase'
import { Private, Public } from './identity'
import { encodePublicKey, encodePrivateKey, KeyType } from './proto.keys'
// eslint-disable-next-line import/no-cycle
import { publicKeyToString, privateKeyFromString, publicKeyBytesFromString, encrypt, decrypt } from './utils'

/**
 * Encode the given PrivateKey to its base-32 encoded multibase representation.
 * @param key The input PrivateKey.
 */
export function privateKeyToString(key: PrivateKey) {
  const encoded = multibase.encode('base32', key.bytes as Buffer)
  return new TextDecoder().decode(encoded)
}

/**
 * Default implementation of the {@link Public} interface, with encryption
 * support.
 * In theory, RSA, ed25519, and secp256k1 key types (and more) should be
 * supported, although currently only ed25519 has full verify and encrypt
 * capabilities.
 * @todo Support additional key types by default. For now, sticking to ed25519
 * keeps our bundle smaller, but if needed, additional types can be added via
 * libp2p-crypto or tweetnacl.
 * @todo Separate out the generic PublicKey interface to include signing and
 * encryption methods, and then have this class implement that interface.
 */
export class PublicKey implements Public {
  constructor(public pubKey: Uint8Array, public type: string = 'ed25519') {
    if (type !== 'ed25519') {
      throw new Error('Invalid keys type')
    }
    this.type = type || 'ed25519'
  }

  /**
   * Verifies the signature for the data and returns true if verification
   * succeeded or false if it failed.
   * @param data The data to use for verification.
   * @param sig The signature to verify.
   */
  async verify(data: Uint8Array, signature: Uint8Array) {
    return nacl.sign.detached.verify(data, signature, this.pubKey)
  }

  /**
   * Return the base32-encoded multibase string of the `bytes` of this public
   * key. Useful for encoding the key for sharing etc.
   */
  toString(): string {
    return publicKeyToString(this)
  }

  /**
   * Create a PublicKey from the result of calling `toString()`.
   */
  static fromString(str: string) {
    const bytes = publicKeyBytesFromString(str)
    return new PublicKey(bytes, 'ed25519')
  }

  /**
   * Return the protobuf-encoded bytes of this public key.
   */
  get bytes(): Uint8Array {
    return encodePublicKey({
      Type: KeyType.Ed25519,
      Data: this.pubKey,
    })
  }

  /**
   * Encrypt the given data using this public key.
   * @param data The input plaintext.
   */
  encrypt(data: Uint8Array): Promise<Uint8Array> {
    return encrypt(data, this.pubKey, this.type)
  }
}

/**
 * Default implementation of the {@link Private} interface, with decryption
 * support.
 * In theory, RSA, ed25519, and secp256k1 key types (and more) should be
 * supported, although currently only ed25519 has full sign and decrypt
 * capabilities.
 * @todo Support additional key types by default. For now, sticking to ed25519
 * keeps our bundle smaller, but if needed, additional types can be added via
 * libp2p-crypto or tweetnacl.
 * @todo Separate out the generic PrivateKey interface to include signing and
 * encryption methods, and then have this class implement that interface.
 */
export class PrivateKey implements Private {
  /**
   * The raw public key bytes.
   */
  pubKey: Uint8Array
  /**
   * The raw 32-byte secret seed
   */
  seed: Uint8Array
  /**
   * The raw private key bytes.
   */
  privKey: Uint8Array

  /**
   * Constructor
   * @param secretKey Raw secret key (32-byte secret seed in ed25519)
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
   * Returns `true` if this key contains a secret key and can sign.
   */
  canSign(): boolean {
    return !!this.privKey
  }

  /**
   * Sign the message using this private key and return the signature.
   * @param data The data (raw bytes) to sign.
   */
  async sign(data: Uint8Array): Promise<Uint8Array> {
    if (!this.canSign()) {
      throw new Error('cannot sign: no secret key available')
    }
    return nacl.sign.detached(data, this.privKey)
  }

  /**
   * Get the public key associated with this identity.
   */
  get public(): PublicKey {
    return new PublicKey(this.pubKey)
  }

  /**
   * Return the protobuf-encoded bytes of this private key.
   */
  get bytes(): Uint8Array {
    return encodePrivateKey({
      Type: KeyType.Ed25519,
      Data: this.privKey,
    })
  }

  /**
   * Creates a new PrivateKey from ed25519 secret key seed raw bytes.
   *
   * @param rawSeed Raw 32-byte ed25519 secret key seed.
   */
  static fromRawEd25519Seed(rawSeed: Uint8Array): PrivateKey {
    return new this(rawSeed, 'ed25519')
  }

  /**
   * Create a random PrivateKey.
   */
  static fromRandom(): PrivateKey {
    const secret = nacl.randomBytes(32)
    return this.fromRawEd25519Seed(secret)
  }

  /**
   * Return the base32-encoded multibase string of the `bytes` of this private
   * key. Useful for encoding the key for sharing etc.
   */
  toString(): string {
    return privateKeyToString(this)
  }

  /**
   * Create a PrivateKey from the result of calling `toString()`.
   */
  static fromString(str: string): PrivateKey {
    return new PrivateKey(privateKeyFromString(str), 'ed25519')
  }

  /**
   * Decrypt the given ciphertext using this private key.
   * @param ciphertext The input ciphertext (encrypted data)
   */
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array> {
    return decrypt(ciphertext, this.privKey, this.type)
  }
}
