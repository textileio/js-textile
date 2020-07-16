import { keys, PrivateKey, PublicKey } from "@textile/threads-crypto"
import multibase from "multibase"

export function publicKeyToString(key: PublicKey): string {
  return multibase
    .encode("base32", keys.marshalPublicKey(key) as Buffer)
    .toString()
}

export function privateKeyToString(key: PrivateKey): string {
  return multibase
    .encode("base32", keys.marshalPrivateKey(key) as Buffer)
    .toString()
}

export function privateKeyFromString(str: string): Promise<PrivateKey> {
  return keys.unmarshalPrivateKey(multibase.decode(str))
}

export interface Public {
  verify(data: Uint8Array, sig: Uint8Array): Promise<boolean>
  toString(): string
  bytes: Uint8Array
}

/**
 * Identity represents an entity capable of signing a message.
 * This is a simple 'private key' interface that must be capable of returning the associated public key for
 * verification. In many cases, this will just be a private key, but callers can use any setup that suits their needs.
 * The interface is currently modeled after @textile/threads-crypto PrivateKeys.
 */
export interface Identity {
  sign(data: Uint8Array): Promise<Uint8Array>
  public: Public
}

export class Libp2pCryptoPublicKey implements Public {
  constructor(public key: PublicKey) {}

  /**
   * Verify the given signed data.
   * @param data The data to verify.
   * @param sig The signature to verify.
   */
  verify(data: Uint8Array, sig: Uint8Array): Promise<boolean> {
    return this.key.verify(data, sig)
  }

  /**
   * Returns base32 encoded Public key representation.
   */
  toString(): string {
    return publicKeyToString(this.key)
  }

  /**
   * The raw bytes of the Public key.
   */
  get bytes(): Uint8Array {
    return this.key.bytes
  }
}

export class Libp2pCryptoIdentity implements Identity {
  constructor(public key: PrivateKey) {}

  /**
   * Signs the given data with the Private key,
   * @param data Data to be signed.
   */
  sign(data: Uint8Array): Promise<Uint8Array> {
    return this.key.sign(data)
  }

  /**
   * Returns the Public key.
   */
  get public(): Libp2pCryptoPublicKey {
    return new Libp2pCryptoPublicKey(this.key.public)
  }
  /**
   * Create a random Ed25519 Identity.
   */
  static async fromRandom(): Promise<Libp2pCryptoIdentity> {
    return new Libp2pCryptoIdentity(
      await keys.supportedKeys.ed25519.generateKeyPair()
    )
  }

  /**
   * Returns base32 encoded private key representation.
   */
  toString(): string {
    return privateKeyToString(this.key)
  }

  /**
   * Creates key key from base32 encoded string representation
   * @param str
   */
  static async fromString(str: string): Promise<Libp2pCryptoIdentity> {
    return new Libp2pCryptoIdentity(await privateKeyFromString(str))
  }
}
