import { keys, PrivateKey, PublicKey } from 'libp2p-crypto'
import multibase from 'multibase'

export function publicKeyToString(key: PublicKey) {
  return multibase.encode('base32', keys.marshalPublicKey(key)).toString()
}

export interface Public {
  verify(data: Buffer, sig: Buffer): Promise<boolean>
  toString(): string
  bytes: Buffer
}

/**
 * Identity represents an entity capable of signing a message.
 * This is a simple 'private key' interface that must be capable of returning the associated public key for
 * verification. In many cases, this will just be a private key, but callers can use any setup that suits their needs.
 * The interface is currently modeled after libp2p-crypto PrivateKey.
 */
export interface Identity {
  sign(data: Buffer): Promise<Buffer>
  public: Public
}

export class Libp2pCryptoPublicKey implements Public {
  constructor(public key: PublicKey) {}

  /**
   * Verify the given signed data.
   * @param data The data to verify.
   * @param sig The signature to verify.
   */
  verify(data: Buffer, sig: Buffer) {
    return this.key.verify(data, sig)
  }

  /**
   * Returns base32 encoded Public key representation.
   */
  toString() {
    return publicKeyToString(this.key)
  }

  /**
   * The raw bytes of the Public key.
   */
  get bytes() {
    return this.key.bytes
  }
}

export class Libp2pCryptoIdentity implements Identity {
  constructor(public key: PrivateKey) {}

  /**
   * Signs the given data with the Private key,
   * @param data Data to be signed.
   */
  sign(data: Buffer) {
    return this.key.sign(data)
  }

  /**
   * Returns the Public key.
   */
  get public() {
    return new Libp2pCryptoPublicKey(this.key.public)
  }
  /**
   * Create a random Ed25519 Identity.
   */
  static async fromRandom() {
    return new Libp2pCryptoIdentity(await keys.supportedKeys.ed25519.generateKeyPair())
  }
}
