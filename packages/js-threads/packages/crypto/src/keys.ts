import * as ed25519 from './ed25519'
import { decodePublicKey, KeyType, decodePrivateKey } from './proto.keys'
import { PrivateKey, PublicKey } from './interfaces'

/**
 * Exposes an interface to various cryptographic key generation routines.
 * Currently the 'ed25519' types are supported, although ed25519 keys
 * support only signing and verification of messages.
 */

export const keyTypeError = new Error('Unsupported key type.')

export const supportedKeys = {
  ed25519,
}

// Generates a keypair of the given type and bitsize
export const generateKeyPair = async (type: 'Ed25519', bytesLength?: number) => {
  if (type !== 'Ed25519') throw keyTypeError
  return ed25519.generateKeyPair(bytesLength)
}

/**
 * Converts a protobuf serialized public key into its representative object
 * @param buf The input key bytes.
 */
export const unmarshalPublicKey = (buf: Uint8Array) => {
  const decoded = decodePublicKey(buf)
  const data = decoded.Data

  switch (decoded.Type) {
    case KeyType.Ed25519:
      return supportedKeys.ed25519.unmarshalEd25519PublicKey(data)
    case KeyType.RSA:
    case KeyType.Secp256k1:
    default:
      throw keyTypeError
  }
}

/**
 * Converts a public key object into a protobuf serialized public key
 * @param key public key.
 * @param type key type. Currently only ED25519 is supported.
 */
export const marshalPublicKey = (key: PublicKey, type = 'ED25519') => {
  if (type !== 'ED25519') throw keyTypeError
  return key.bytes
}

/**
 * Converts a protobuf serialized private key into its representative object
 * @param buf The input key bytes.
 */
export const unmarshalPrivateKey = (buf: Uint8Array) => {
  const decoded = decodePrivateKey(buf)
  const data = decoded.Data

  switch (decoded.Type) {
    case KeyType.Ed25519:
      return supportedKeys.ed25519.unmarshalEd25519PrivateKey(data)
    case KeyType.RSA:
    case KeyType.Secp256k1:
    default:
      throw keyTypeError
  }
}

// Converts a private key object into a protobuf serialized private key
export const marshalPrivateKey = (key: PrivateKey, type = 'ED25519') => {
  if (type !== 'ED25519') throw keyTypeError
  return key.bytes
}
