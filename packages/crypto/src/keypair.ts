import nacl from 'tweetnacl'
import { convertPublicKey, convertSecretKey } from 'ed2curve'
import multibase from 'multibase'
import { Private, Public } from './identity'
import { encodePublicKey, encodePrivateKey, KeyType, decodePrivateKey } from './proto.keys'

const nonceBytes = 24 // Length of nacl nonce
const privateKeyBytes = 32
const ephemeralPublicKeyBytes = 32 // Length of nacl ephemeral public key

export class PublicKey implements Public {
  constructor(public pubKey: Uint8Array) {}
  /**
   * Verifies if `signature` for `data` is valid.
   * @param data Signed data
   * @param signature Signature
   */
  async verify(data: Uint8Array, signature: Uint8Array) {
    return nacl.sign.detached.verify(data, signature, this.pubKey)
  }

  toString(): string {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return publicKeyToString(this)
  }

  get bytes(): Uint8Array {
    return encodePublicKey({
      Type: KeyType.Ed25519,
      Data: this.pubKey,
    })
  }
}

export class PrivateKey implements Private {
  pubKey: Uint8Array
  seed: Uint8Array
  privKey: Uint8Array
  type: 'ed25519'
  /**
   * Constructor
   * @param secretKey Raw secret key (32-byte secret seed in ed25519`)
   * @param type Public-key signature system name. (currently only `ed25519` keys are supported)
   */
  constructor(secretKey: Uint8Array, type?: 'ed25519') {
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
  canSign() {
    return !!this.privKey
  }

  /**
   * Signs data.
   * @param data Data to sign
   */
  async sign(data: Uint8Array) {
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
  static fromRawEd25519Seed(rawSeed: Uint8Array) {
    return new this(rawSeed, 'ed25519')
  }
  /**
   * Create a random `Keypair` object.
   */
  static fromRandom() {
    const secret = nacl.randomBytes(32)
    return this.fromRawEd25519Seed(secret)
  }

  toString() {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return privateKeyToString(this)
  }

  static fromString(str: string) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return privateKeyFromString(str)
  }
}

/**
 * Decrypts the given `data` using a Curve25519 'variant' of the private key.
 *
 * Assumes ciphertext includes ephemeral public key and nonce used in original encryption
 * (e.g., via `encrypt`).
 *
 * @note See https://github.com/dchest/ed2curve-js for conversion details.
 * @param ciphertext Data to decrypt
 */
export function decrypt(ciphertext: Uint8Array, privKey: Uint8Array, type?: 'ed25519') {
  if (type !== 'ed25519') {
    throw Error(`'${type}' type keys are not currently supported`)
  }
  const pk = convertSecretKey(privKey)
  if (!pk) {
    throw Error('could not convert key type')
  }
  const nonce = ciphertext.slice(0, nonceBytes)
  const ephemeral = ciphertext.slice(nonceBytes, nonceBytes + ephemeralPublicKeyBytes)
  const ct = ciphertext.slice(nonceBytes + ephemeralPublicKeyBytes)
  const plaintext = nacl.box.open(ct, nonce, ephemeral, pk)
  if (!plaintext) {
    throw Error('failed to decrypt curve25519')
  }
  return Uint8Array.from(plaintext)
}

/**
 * Encrypts the given `data` using a Curve25519 'variant' of the public key.
 *
 * The encryption uses an ephemeral private key, which is prepended to the ciphertext,
 * along with a nonce of random bytes.
 *
 * @note See https://github.com/dchest/ed2curve-js for conversion details.
 * @param data Data to encrypt
 */
export function encrypt(data: Uint8Array, pubKey: Uint8Array, type?: 'ed25519') {
  if (type !== 'ed25519') {
    throw Error(`'${type}' type keys are not currently supported`)
  }
  // generated ephemeral key pair
  const ephemeral = nacl.box.keyPair()
  // convert recipient's key into curve25519 (assumes ed25519 keys)
  const pk = convertPublicKey(pubKey)
  if (!pk) {
    throw Error('could not convert key type')
  }
  // encrypt with nacl
  const nonce = nacl.randomBytes(24)
  const ciphertext = nacl.box(data, nonce, pk, ephemeral.secretKey)
  const merged = new Uint8Array(nonceBytes + ephemeralPublicKeyBytes + ciphertext.byteLength)
  // prepend nonce
  merged.set(new Uint8Array(nonce), 0)
  // then ephemeral public key
  merged.set(new Uint8Array(ephemeral.publicKey), nonceBytes)
  // then cipher text
  merged.set(new Uint8Array(ciphertext), nonceBytes + ephemeralPublicKeyBytes)
  return Uint8Array.from(merged)
}

export function publicKeyToString(key: PublicKey): string {
  return multibase.encode('base32', key.bytes as Buffer).toString()
}

export function privateKeyToString(key: PrivateKey) {
  return multibase.encode('base32', key.bytes as Buffer).toString()
}

export function privateKeyFromString(str: string) {
  const decoded = multibase.decode(str)
  const obj = decodePrivateKey(decoded)
  const bytes = obj.Data
  // We might have the public key bytes appended twice, but we can ignore the extra public
  // bytes on the end (no need to check it either)
  const keyBytes = bytes.slice(0, privateKeyBytes)
  return new PrivateKey(keyBytes, 'ed25519')
}
