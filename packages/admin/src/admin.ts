import { Context } from '@textile/context'
import {
  CopyAuthOptions,
  GrpcAuthentication,
  WithUserAuthOptions,
} from '@textile/grpc-authentication'
import * as api from './api'

export class Admin extends GrpcAuthentication {
  /**
   * {@inheritDoc @textile/hub#GrpcAuthentication.copyAuth}
   *
   * @example
   * Copy an authenticated Users api instance to Admin.
   * ```typescript
   * import { Users } from '@textile/hub-admin'
   * import { Users } from '@textile/hub'
   *
   * const usersToAdmin = async (user: Users) => {
   *   const admin = Admim.copyAuth(user)
   *   return admin
   * }
   * ```
   */
  static copyAuth(auth: GrpcAuthentication, options?: CopyAuthOptions): Admin {
    return new Admin(auth.context, options?.debug)
  }

  /**
   * Initialize a new Admin instance from an existing session token.
   *
   * @example
   * ```@typescript
   * import { Admin } from '@textile/hub-admin'
   *
   * async function example (token: string) {
   *   const admin = await Admin.withSession(token)
   * }
   * ```
   */
  static withSession(session: string, options?: WithUserAuthOptions): Admin {
    const ctx = new Context(options?.host).withSession(session)
    return new Admin(ctx, options?.debug)
  }

  /**
   * Creates a new user (if username is available) and returns a session.
   * @param username The desired username.
   * @param email The user's email address.
   * @note This method will block and wait for email-based verification.
   */
  signUp(username: string, email: string): Promise<api.SigninOrSignupResponse> {
    return api.signUp(this, username, email)
  }

  /**
   * Starts and returns a session for an existing username or email.
   * @param usernameOrEmail An existing username or email address.
   * @note This method will block and wait for email-based verification.
   */
  signIn(usernameOrEmail: string): Promise<api.SigninOrSignupResponse> {
    return api.signIn(this, usernameOrEmail)
  }

  /**
   * Ends the current session.
   */
  signOut(): Promise<void> {
    return api.signOut(this)
  }

  /**
   * Returns the current session information.
   */
  getSessionInfo(): Promise<api.SessionInfoResponse> {
    return api.getSessionInfo(this)
  }

  /**
   * Returns the identity (public key string) of the current session.
   */
  getIdentity(): Promise<string> {
    return api.getIdentity(this)
  }

  /**
   * Creates a new key for the current session.
   */
  createKey(): Promise<api.KeyInfo> {
    return api.createKey(this)
  }

  /**
   * Marks a key as invalid.
   * @param key The session key to invalidate.
   * @note New threads cannot be created with an invalid key.
   */
  invalidateKey(key: string): Promise<void> {
    return api.invalidateKey(this, key)
  }

  /**
   * Returns a list of keys for the current session.
   */
  listKeys(): Promise<Array<api.KeyInfo>> {
    return api.listKeys(this)
  }

  /**
   * Creates a new org (if name is available) by name.
   * @param name The desired org name.
   */
  createOrg(name: string): Promise<api.OrgInfo> {
    return api.createOrg(this, name)
  }

  /**
   * Returns the current org.
   */
  getOrg(name: string): Promise<api.OrgInfo> {
    return api.getOrg(this, this.context.withOrg(name))
  }

  /**
   * Returns a list of orgs for the current session.
   */
  listOrgs(): Promise<Array<api.OrgInfo>> {
    return api.listOrgs(this)
  }

  /**
   * Removes the current org.
   */
  removeOrg(name: string): Promise<void> {
    return api.removeOrg(this, this.context.withOrg(name))
  }

  /**
   * Invites the given email to an org.
   * @param email The email to add to an org.
   */
  inviteToOrg(email: string, name: string): Promise<string> {
    return api.inviteToOrg(this, email, this.context.withOrg(name))
  }

  /**
   * Removes the current session dev from an org.
   */
  leaveOrg(name: string): Promise<void> {
    return api.leaveOrg(this, this.context.withOrg(name))
  }

  /**
   * (Re-)enables billing for an account, enabling usage beyond the free quotas.
   */
  setupBilling(): Promise<void> {
    return api.setupBilling(this)
  }

  /**
   * Returns a billing portal session url.
   */
  getBillingSession(): Promise<string> {
    return api.getBillingSession(this)
  }

  /**
   * Returns a list of users the account is responsible for.
   */
  listBillingUsers(offset = 0, limit = 0): Promise<Array<api.Customer>> {
    return api.listBillingUsers(this, offset, limit)
  }

  /**
   * Returns whether the username is valid and available.
   * @param username The desired username.
   */
  isUsernameAvailable(username: string): Promise<boolean> {
    return api.isUsernameAvailable(this, username)
  }

  /**
   * Returns whether the org name is valid and available.
   * @param name The desired org name.
   */
  isOrgNameAvailable(name: string): Promise<api.IsOrgNameAvailableResponse> {
    return api.isOrgNameAvailable(this, name)
  }

  /**
   * Completely deletes an account and all associated data.
   * @note Danger!!
   */
  destroyAccount(): Promise<void> {
    return api.destroyAccount(this)
  }
}
