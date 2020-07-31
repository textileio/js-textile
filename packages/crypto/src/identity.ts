export type Private = Identity

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

export interface Public {
  verify(data: Uint8Array, sig: Uint8Array): Promise<boolean>
  toString(): string
  bytes: Uint8Array
}
