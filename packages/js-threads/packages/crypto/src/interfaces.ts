/**
 * Maps an IPFS hash name to its node-forge equivalent.
 * See https://github.com/multiformats/multihash/blob/master/hashtable.csv
 */
export type HashType = "SHA1" | "SHA256" | "SHA512"

/**
 * Supported curve types.
 */
export type CurveType = "P-256" | "P-384" | "P-521"

/**
 * Supported cipher types.
 */
export type CipherType = "AES-128" | "AES-256" | "Blowfish"

/**
 * Generic public key interface.
 */
export interface PublicKey {
  /**
   * A protobuf serialized representation of this key.
   */
  readonly bytes: Uint8Array
  /**
   * Verify the signature of the given message data.
   * @param data The data whose signature is to be verified.
   * @param sig The signature to verify.
   */
  verify(data: Uint8Array, sig: Uint8Array): Promise<boolean>
  /**
   * Return the raw bytes of this key. Not to be conused with `bytes`.
   */
  marshal(): Uint8Array
  /**
   * Test for equality with another key.
   * @param key Other key.
   */
  equals(key: PublicKey): boolean
  /**
   * Compute the sha256 hash of the key's `bytes`.
   */
  hash(): Promise<Uint8Array>
}

/**
 * Generic private key interface.
 */
export interface PrivateKey {
  /**
   * The public key associated with this private key.
   */
  readonly public: PublicKey
  /**
   * A protobuf serialized representation of this key.
   */
  readonly bytes: Uint8Array
  /**
   * Generates a digital signature on the given data.
   * @param data The data to sign.
   */
  sign(data: Uint8Array): Promise<Uint8Array>
  /**
   * Return the raw bytes of this key. Not to be conused with `bytes`.
   */
  marshal(): Uint8Array
  /**
   * Test for equality with another key.
   * @param key Other key.
   */
  equals(key: PrivateKey): boolean
  /**
   * Compute the sha256 hash of the key's `bytes`.
   */
  hash(): Promise<Uint8Array>
  /**
   * Gets the ID of the key.
   *
   * The key id is the base58 encoding of the SHA-256 multihash of its public key.
   * The public key is a protobuf encoding containing a type and the DER encoding
   * of the PKCS SubjectPublicKeyInfo.
   */
  id(): Promise<string>
}
