import type { ContextInterface } from '@textile/context'
import {
  privateKeyBytesToString,
  publicKeyBytesToString,
} from '@textile/crypto'
import { GrpcConnection } from '@textile/grpc-connection'
import * as pb from '@textile/hub-grpc/api/hubd/pb/hubd_pb'
import { APIService } from '@textile/hub-grpc/api/hubd/pb/hubd_pb_service'
import log from 'loglevel'

const logger = log.getLogger('admin-api')

export interface SigninOrSignupResponse {
  key: string
  session: string
}

/**
 * Creates a new user (if username is available) and returns a session.
 * @param username The desired username.
 * @param email The user's email address.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @note This method will block and wait for email-based verification.
 * @internal
 */
export async function signUp(
  api: GrpcConnection,
  username: string,
  email: string,
  ctx?: ContextInterface,
): Promise<SigninOrSignupResponse> {
  logger.debug('signup request')
  const req = new pb.SignupRequest()
  req.setEmail(email)
  req.setUsername(username)
  const res: pb.SignupResponse = await api.unary(APIService.Signup, req, ctx)
  return {
    key: publicKeyBytesToString(res.getKey_asU8()),
    session: res.getSession(),
  }
}

/**
 * Returns a session for an existing username or email.
 * @param usernameOrEmail An existing username or email address.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @note This method will block and wait for email-based verification.
 * @internal
 */
export async function signIn(
  api: GrpcConnection,
  usernameOrEmail: string,
  ctx?: ContextInterface,
): Promise<SigninOrSignupResponse> {
  logger.debug('signin request')
  const req = new pb.SigninRequest()
  req.setUsernameOrEmail(usernameOrEmail)
  const res: pb.SigninResponse = await api.unary(APIService.Signin, req, ctx)
  return {
    key: publicKeyBytesToString(res.getKey_asU8()),
    session: res.getSession(),
  }
}

/**
 * Deletes the current session.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function signOut(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<void> {
  logger.debug('signout request')
  const req = new pb.SignoutRequest()
  await api.unary(APIService.Signout, req, ctx)
  return
}

export interface SessionInfoResponse {
  key: string
  username: string
  email: string
}

/**
 * Returns the current session information.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function getSessionInfo(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<SessionInfoResponse> {
  logger.debug('get session info request')
  const req = new pb.GetSessionInfoRequest()
  const res: pb.GetSessionInfoResponse = await api.unary(
    APIService.GetSessionInfo,
    req,
    ctx,
  )
  return {
    key: publicKeyBytesToString(res.getKey_asU8()),
    username: res.getUsername(),
    email: res.getEmail(),
  }
}

/**
 * Returns the identity (public key string) of the current session.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function getIdentity(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<string> {
  logger.debug('get identity request')
  const req = new pb.GetIdentityRequest()
  const res: pb.GetIdentityResponse = await api.unary(
    APIService.GetIdentity,
    req,
    ctx,
  )
  return privateKeyBytesToString(res.getIdentity_asU8())
}

export enum KeyType {
  UNSPECIFIED = 0,
  ACCOUNT = 1,
  USER = 2,
}

export interface KeyInfo {
  key: string
  secret: string
  type: KeyType
  valid: boolean
  threads: number
  secure: boolean
}

/**
 * Creates a new key for the current session.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function createKey(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<KeyInfo> {
  logger.debug('create key request')
  const req = new pb.CreateKeyRequest()
  const res: pb.CreateKeyResponse = await api.unary(
    APIService.CreateKey,
    req,
    ctx,
  )
  const { keyInfo } = res.toObject()
  if (keyInfo === undefined) throw new Error('error creating key')
  return keyInfo
}

/**
 * Marks a key as invalid.
 * @param key The session key to invalidate.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @note New Threads cannot be created with an invalid key.
 * @internal
 */
export async function invalidateKey(
  api: GrpcConnection,
  key: string,
  ctx?: ContextInterface,
): Promise<void> {
  logger.debug('invalidate key request')
  const req = new pb.InvalidateKeyRequest()
  req.setKey(key)
  await api.unary(APIService.InvalidateKey, req, ctx)
  return
}

/**
 * Returns a list of keys for the current session.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function listKeys(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<Array<KeyInfo>> {
  logger.debug('list keys request')
  const req = new pb.ListKeysRequest()
  const res: pb.ListKeysResponse = await api.unary(
    APIService.ListKeys,
    req,
    ctx,
  )
  return res.getListList().map((key) => key.toObject())
}

export interface OrgMember {
  key: string
  username: string
  role: string
}

export interface OrgInfo {
  key: string
  name: string
  slug: string
  host: string
  members: Array<OrgMember>
  createdAt: number
}

const pbToOrgInfo = (orgInfo?: pb.OrgInfo): OrgInfo => {
  if (orgInfo === undefined) throw new Error('error getting org info')
  const members = orgInfo?.getMembersList().map((res) => {
    return {
      role: res.getRole(),
      key: publicKeyBytesToString(res.getKey_asU8()),
      username: res.getUsername(),
    }
  })
  return {
    key: publicKeyBytesToString(orgInfo.getKey_asU8()),
    name: orgInfo.getName(),
    slug: orgInfo.getSlug(),
    host: orgInfo.getHost(),
    members,
    createdAt: orgInfo.getCreatedAt(),
  }
}

/**
 * Creates a new org (if name is available) by name.
 * @param name The desired org name.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function createOrg(
  api: GrpcConnection,
  name: string,
  ctx?: ContextInterface,
): Promise<OrgInfo> {
  logger.debug('create org request')
  const req = new pb.CreateOrgRequest()
  req.setName(name)
  const res: pb.CreateOrgResponse = await api.unary(
    APIService.CreateOrg,
    req,
    ctx,
  )
  return pbToOrgInfo(res.getOrgInfo())
}

/**
 * Returns the current org.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function getOrg(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<OrgInfo> {
  logger.debug('get org request')
  const req = new pb.GetOrgRequest()
  const res: pb.GetOrgResponse = await api.unary(APIService.GetOrg, req, ctx)
  return pbToOrgInfo(res.getOrgInfo())
}

/**
 * Returns a list of orgs for the current session.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function listOrgs(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<Array<OrgInfo>> {
  logger.debug('list orgs request')
  const req = new pb.ListOrgsRequest()
  const res: pb.ListOrgsResponse = await api.unary(
    APIService.ListOrgs,
    req,
    ctx,
  )
  return res.getListList().map(pbToOrgInfo)
}

/**
 * Removes the current org.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function removeOrg(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<void> {
  logger.debug('remove org request')
  const req = new pb.RemoveOrgRequest()
  await api.unary(APIService.RemoveOrg, req, ctx)
  return
}

/**
 * Invites the given email to an org.
 * @param email The email to add to an org.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function inviteToOrg(
  api: GrpcConnection,
  email: string,
  ctx?: ContextInterface,
): Promise<string> {
  logger.debug('invite to org request')
  const req = new pb.InviteToOrgRequest()
  req.setEmail(email)
  const res: pb.InviteToOrgResponse = await api.unary(
    APIService.InviteToOrg,
    req,
    ctx,
  )
  return res.getToken()
}

/**
 * Removes the current session dev from an org.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function leaveOrg(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<void> {
  logger.debug('leave org request')
  const req = new pb.LeaveOrgRequest()
  await api.unary(APIService.LeaveOrg, req, ctx)
  return
}

/**
 * (Re-)enables billing for an account, enabling usage beyond the free quotas.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function setupBilling(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<void> {
  logger.debug('setup billing request')
  const req = new pb.SetupBillingRequest()
  await api.unary(APIService.SetupBilling, req, ctx)
  return
}

/**
 * Returns a billing portal session url.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function getBillingSession(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<string> {
  logger.debug('get billing session request')
  const req = new pb.GetBillingSessionRequest()
  const res: pb.GetBillingSessionResponse = await api.unary(
    APIService.GetBillingSession,
    req,
    ctx,
  )
  return res.getUrl()
}

export interface Usage {
  description: string
  units: number
  total: number
  free: number
  grace: number
  cost: number
  period?: Period
}

export interface Period {
  unixStart: number
  unixEnd: number
}

export interface Customer {
  // TODO: Have to properly unmarshall this object rather than use toObject
  key: string
  customerId: string
  parentKey: string
  email: string
  accountType: number
  accountStatus: string
  subscriptionStatus: string
  balance: number
  billable: boolean
  delinquent: boolean
  createdAt: number
  gracePeriodEnd: number
  invoicePeriod?: Period
  dailyUsageMap: Array<[string, Usage]>
  dependents: number
}

/**
 * Returns a list of users the account is responsible for.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function listBillingUsers(
  api: GrpcConnection,
  offset = 0,
  limit = 0,
  ctx?: ContextInterface,
): Promise<Array<Customer>> {
  logger.debug('list billing users request')
  const req = new pb.ListBillingUsersRequest()
  req.setOffset(offset)
  req.setLimit(limit)
  const res: pb.ListBillingUsersResponse = await api.unary(
    APIService.ListBillingUsers,
    req,
    ctx,
  )
  return res.getUsersList().map((user) => user.toObject())
}

/**
 * Returns whether the username is valid and available.
 * @param username The desired username.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function isUsernameAvailable(
  api: GrpcConnection,
  username: string,
  ctx?: ContextInterface,
): Promise<boolean> {
  logger.debug('is username available request')
  const req = new pb.IsUsernameAvailableRequest()
  req.setUsername(username)
  return api
    .unary(APIService.IsUsernameAvailable, req, ctx)
    .then(() => true)
    .catch(() => false)
}

export interface IsOrgNameAvailableResponse {
  slug: string
  host: string
}

/**
 * Returns whether the org name is valid and available.
 * @param name The desired org name.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @internal
 */
export async function isOrgNameAvailable(
  api: GrpcConnection,
  name: string,
  ctx?: ContextInterface,
): Promise<IsOrgNameAvailableResponse> {
  logger.debug('is org name available request')
  const req = new pb.IsOrgNameAvailableRequest()
  req.setName(name)
  const res: pb.IsOrgNameAvailableResponse = await api.unary(
    APIService.IsOrgNameAvailable,
    req,
    ctx,
  )
  return res.toObject()
}

/**
 * Completely deletes an account and all associated data.
 * @param ctx Context containing gRPC headers and settings.
 * These will be merged with any internal ctx.
 * @note Danger!!
 * @internal
 */
export async function destroyAccount(
  api: GrpcConnection,
  ctx?: ContextInterface,
): Promise<void> {
  logger.debug('destroy account request')
  const req = new pb.DestroyAccountRequest()
  await api.unary(APIService.DestroyAccount, req, ctx)
  return
}
