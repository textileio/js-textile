import nacl from 'tweetnacl'
import { convertPublicKey, convertSecretKey } from 'ed2curve'
import multibase from 'multibase'
import type { Public } from './identity'
import { decodePrivateKey, decodePublicKey } from './proto.keys'

const nonceBytes = 24 // Length of nacl nonce
const privateKeyBytes = 32
const publicKeyBytes = 32 // Length of nacl ephemeral public key

/**
 * Decrypts the given `data` using a Curve25519 'variant' of the private key.
 *
 * Assumes ciphertext includes ephemeral public key and nonce used in original encryption
 * (e.g., via `encrypt`).
 *
 * @note See https://github.com/dchest/ed2curve-js for conversion details.
 * @param ciphertext Data to decrypt
 */
export async function decrypt(ciphertext: Uint8Array, privKey: Uint8Array, type = 'ed25519'): Promise<Uint8Array> {
  if (type !== 'ed25519') {
    throw Error(`'${type}' type keys are not currently supported`)
  }
  const pk = convertSecretKey(privKey)
  if (!pk) {
    throw Error('could not convert key type')
  }
  const nonce = ciphertext.slice(0, nonceBytes)
  const ephemeral = ciphertext.slice(nonceBytes, nonceBytes + publicKeyBytes)
  const ct = ciphertext.slice(nonceBytes + publicKeyBytes)
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
export async function encrypt(data: Uint8Array, pubKey: Uint8Array, type = 'ed25519'): Promise<Uint8Array> {
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
  const merged = new Uint8Array(nonceBytes + publicKeyBytes + ciphertext.byteLength)
  // prepend nonce
  merged.set(new Uint8Array(nonce), 0)
  // then ephemeral public key
  merged.set(new Uint8Array(ephemeral.publicKey), nonceBytes)
  // then cipher text
  merged.set(new Uint8Array(ciphertext), nonceBytes + publicKeyBytes)
  return Uint8Array.from(merged)
}

export function publicKeyToString(key: Public): string {
  const encoded = multibase.encode('base32', key.bytes as Buffer)
  return new TextDecoder().decode(encoded)
}

export function publicKeyBytesFromString(str: string) {
  const decoded = multibase.decode(str)
  const obj = decodePublicKey(decoded)
  const bytes = obj.Data
  return bytes.slice(0, publicKeyBytes)
}

export function privateKeyFromString(str: string) {
  const decoded = multibase.decode(str)
  const obj = decodePrivateKey(decoded)
  const bytes = obj.Data
  // We might have the public key bytes appended twice, but we can ignore the extra public
  // bytes on the end (no need to check it either)
  return bytes.slice(0, privateKeyBytes)
}
