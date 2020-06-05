import { grpc } from '@improbable-eng/grpc-web'
import log from 'loglevel'
import * as pb from '@textile/hub-grpc/hub_pb'
import { APIClient } from '@textile/hub-grpc/hub_pb_service'
import { Context } from '@textile/context'
import { promise } from './utils'

const logger = log.getLogger('hub')

/**
 * Admin is a web-gRPC wrapper client for communicating with the Hub Admin APIs.
 */
export class Admin {
  public client: APIClient
  /**
   * Creates a new gRPC client instance for accessing the Textile Hub APIs
   */
  constructor(serviceHost: string, rpcOptions: grpc.RpcOptions) {
    this.client = new APIClient(serviceHost, rpcOptions)
  }

  /**
   * Creates a new user (if username is available) and returns a session.
   * @param username The desired username.
   * @param email The user's email address.
   * @param credentials Context containing gRPC headers and settings.
   * These will be merged with any internal credentials.
   * @note This method will block and wait for email-based verification.
   */
  async signup(username: string, email: string, credentials?: Context) {
    logger.debug('signup request')
    const req = new pb.SignupRequest()
    req.setEmail(email)
    req.setUsername(username)
    return promise(
      (cb) => {
        this.client.signup(req, cb)
      },
      (res: pb.SignupReply) => res.toObject(),
    )
  }

  // /**
  //  * Returns a session for an existing username or email.
  //  * @param usernameOrEmail An existing username or email address.
  //  * @param credentials Context containing gRPC headers and settings.
  //  * These will be merged with any internal credentials.
  //  * @note This method will block and wait for email-based verification.
  //  */
  // async signIn(usernameOrEmail: string, credentials?: Context) {
  //   logger.debug('signin request')
  //   const req = new pb.SigninRequest()
  //   req.setUsernameoremail(usernameOrEmail)
  //   const res: pb.SigninReply = await this.unary(API.Signin, req, credentials)
  //   return res.toObject()
  // }

  // /**
  //  * Deletes the current session.
  //  * @param credentials Context containing gRPC headers and settings.
  //  * These will be merged with any internal credentials.
  //  */
  // async signOut(credentials?: Context) {
  //   logger.debug('signout request')
  //   const req = new pb.SignoutRequest()
  //   await this.unary(API.Signout, req, credentials)
  //   return
  // }

  // /**
  //  * Returns the current session information.
  //  * @param credentials Context containing gRPC headers and settings.
  //  * These will be merged with any internal credentials.
  //  */
  // async getSessionInfo(credentials?: Context) {
  //   logger.debug('get session info request')
  //   const req = new pb.GetSessionInfoRequest()
  //   const res: pb.GetSessionInfoReply = await this.unary(API.GetSessionInfo, req, credentials)
  //   return res.toObject()
  // }

  // /**
  //  * Creates a new key for the current session.
  //  * @param credentials Context containing gRPC headers and settings.
  //  * These will be merged with any internal credentials.
  //  */
  // async createKey(credentials?: Context) {
  //   logger.debug('create key request')
  //   const req = new pb.CreateKeyRequest()
  //   const res: pb.GetKeyReply = await this.unary(API.CreateKey, req, credentials)
  //   return res.toObject()
  // }

  // /**
  //  * Marks a key as invalid.
  //  * @param key The session key to invalidate.
  //  * @param credentials Context containing gRPC headers and settings.
  //  * These will be merged with any internal credentials.
  //  * @note New Threads cannot be created with an invalid key.
  //  */
  // async invalidateKey(key: string, credentials?: Context) {
  //   logger.debug('invalidate key request')
  //   const req = new pb.InvalidateKeyRequest()
  //   req.setKey(key)
  //   await this.unary(API.InvalidateKey, req, credentials)
  //   return
  // }

  // /**
  //  * Returns a list of keys for the current session.
  //  * @param credentials Context containing gRPC headers and settings.
  //  * These will be merged with any internal credentials.
  //  */
  // async listKeys(credentials?: Context) {
  //   logger.debug('list keys request')
  //   const req = new pb.ListKeysRequest()
  //   const res: pb.ListKeysReply = await this.unary(API.ListKeys, req, credentials)
  //   return res.getListList().map((key) => key.toObject())
  // }

  // /**
  //  * Creates a new org (if name is available) by name.
  //  * @param name The desired org name.
  //  * @param credentials Context containing gRPC headers and settings.
  //  * These will be merged with any internal credentials.
  //  */
  // async createOrg(name: string, credentials?: Context) {
  //   logger.debug('create org request')
  //   const req = new pb.CreateOrgRequest()
  //   req.setName(name)
  //   const res: pb.GetOrgReply = await this.unary(API.CreateOrg, req, credentials)
  //   return res.toObject()
  // }

  // /**
  //  * Returns the current org.
  //  * @param credentials Context containing gRPC headers and settings.
  //  * These will be merged with any internal credentials.
  //  */
  // async getOrg(credentials?: Context) {
  //   logger.debug('get org request')
  //   const req = new pb.GetOrgRequest()
  //   const res: pb.GetOrgReply = await this.unary(API.GetOrg, req, credentials)
  //   return res.toObject()
  // }

  // /**
  //  * Returns a list of orgs for the current session.
  //  * @param credentials Context containing gRPC headers and settings.
  //  * These will be merged with any internal credentials.
  //  */
  // async listOrgs(credentials?: Context) {
  //   logger.debug('list orgs request')
  //   const req = new pb.ListOrgsRequest()
  //   const res: pb.ListOrgsReply = await this.unary(API.ListOrgs, req, credentials)
  //   return res.getListList().map((org) => org.toObject())
  // }

  // /**
  //  * Removes the current org.
  //  * @param credentials Context containing gRPC headers and settings.
  //  * These will be merged with any internal credentials.
  //  */
  // async removeOrg(credentials?: Context) {
  //   logger.debug('remove org request')
  //   const req = new pb.RemoveOrgRequest()
  //   await this.unary(API.RemoveOrg, req, credentials)
  //   return
  // }

  // /**
  //  * Invites the given email to an org.
  //  * @param email The email to add to an org.
  //  * @param credentials Context containing gRPC headers and settings.
  //  * These will be merged with any internal credentials.
  //  */
  // async inviteToOrg(email: string, credentials?: Context) {
  //   logger.debug('invite to org request')
  //   const req = new pb.InviteToOrgRequest()
  //   req.setEmail(email)
  //   const res: pb.InviteToOrgReply = await this.unary(API.InviteToOrg, req, credentials)
  //   return res.toObject()
  // }

  // /**
  //  * Removes the current session dev from an org.
  //  * @param credentials Context containing gRPC headers and settings.
  //  * These will be merged with any internal credentials.
  //  */
  // async leaveOrg(credentials?: Context) {
  //   logger.debug('leave org request')
  //   const req = new pb.LeaveOrgRequest()
  //   await this.unary(API.InviteToOrg, req, credentials)
  //   return
  // }

  // /**
  //  * Returns whether the username is valid and available.
  //  * @param username The desired username.
  //  * @param credentials Context containing gRPC headers and settings.
  //  * These will be merged with any internal credentials.
  //  */
  // async isUsernameAvailable(username: string, credentials?: Context) {
  //   logger.debug('is username available request')
  //   const req = new pb.IsUsernameAvailableRequest()
  //   req.setUsername(username)
  //   // Should throw if not available/valid
  //   // @todo: Should we just catch and return false here instead?
  //   await this.unary(API.IsUsernameAvailable, req, credentials)
  //   return true
  // }

  // /**
  //  * Returns whether the org name is valid and available.
  //  * @param name The desired org name.
  //  * @param credentials Context containing gRPC headers and settings.
  //  * These will be merged with any internal credentials.
  //  */
  // async isOrgNameAvailable(name: string, credentials?: Context) {
  //   logger.debug('is org name available request')
  //   const req = new pb.IsOrgNameAvailableRequest()
  //   req.setName(name)
  //   // Should throw if not available/valid
  //   // @todo: Should we just catch and return false here instead?
  //   const res: pb.IsOrgNameAvailableReply = await this.unary(API.IsOrgNameAvailable, req, credentials)
  //   return res.toObject()
  // }
}
