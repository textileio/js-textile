import { GrpcConnection } from '@textile/grpc-connection'
import { ContextInterface } from '@textile/context'
import {
  BuildInfoRequest,
  BuildInfoResponse,
  CreateKeyRequest,
  CreateKeyResponse,
  CreateOrgRequest,
  CreateOrgResponse,
  DestroyAccountRequest,
  DestroyAccountResponse,
  GetIdentityRequest,
  GetIdentityResponse,
  GetOrgRequest,
  GetOrgResponse,
  GetSessionInfoRequest,
  GetSessionInfoResponse,
  InvalidateKeyRequest,
  InvalidateKeyResponse,
  InviteToOrgRequest,
  InviteToOrgResponse,
  IsOrgNameAvailableRequest,
  IsOrgNameAvailableResponse,
  IsUsernameAvailableRequest,
  IsUsernameAvailableResponse,
  ListKeysRequest,
  ListKeysResponse,
  ListOrgsRequest,
  ListOrgsResponse,
  LeaveOrgRequest,
  LeaveOrgResponse,
  SignupRequest,
  SignupResponse,
  SigninRequest,
  SigninResponse,
  SignoutRequest,
} from '@textile/hub-grpc/hub_pb'
import { APIService } from '@textile/hub-grpc/hub_pb_service'

/**
 * @internal
 */
export async function buildInfo(api: GrpcConnection, ctx?: ContextInterface): Promise<BuildInfoResponse> {
  const req = new BuildInfoRequest()
  const res: BuildInfoResponse = await api.unary(APIService.BuildInfo, req, ctx)
  return res
}

/**
 * @internal
 */
export async function createKey(api: GrpcConnection, secure: boolean, keyType: 0 | 1 | 2, ctx?: ContextInterface): Promise<CreateKeyResponse> {
  const req = new CreateKeyRequest()
  req.setSecure(secure)
  req.setType(keyType)
  const res: CreateKeyResponse = await api.unary(APIService.CreateKey, req, ctx)
  return res
}

/**
 * @internal
 */
export async function createOrg(api: GrpcConnection, name: string, ctx?: ContextInterface): Promise<CreateOrgResponse> {
  const req = new CreateOrgRequest()
  req.setName(name)
  const res: CreateOrgResponse = await api.unary(APIService.CreateOrg, req, ctx)
  return res
}

/**
 * @internal
 */
export async function destroyAccount(api: GrpcConnection, ctx?: ContextInterface): Promise<DestroyAccountResponse> {
  const req = new DestroyAccountRequest()
  const res: DestroyAccountResponse = await api.unary(APIService.DestroyAccount, req, ctx)
  return res
}

/**
 * @internal
 */
export async function getIdentity(api: GrpcConnection, ctx?: ContextInterface): Promise<GetIdentityResponse> {
  const req = new GetIdentityRequest()
  const res: GetIdentityResponse = await api.unary(APIService.GetIdentity, req, ctx)
  return res
}

/**
 * @internal
 */
export async function getOrg(api: GrpcConnection, ctx?: ContextInterface): Promise<GetOrgResponse> {
  const req = new GetOrgRequest()
  const res: GetOrgResponse = await api.unary(APIService.GetSessionInfo, req, ctx)
  return res
}

/**
 * @internal
 */
export async function getSessionInfo(api: GrpcConnection, ctx?: ContextInterface): Promise<GetSessionInfoResponse> {
  const req = new GetSessionInfoRequest()
  const res: GetSessionInfoResponse = await api.unary(APIService.GetSessionInfo, req, ctx)
  return res
}

/**
 * @internal
 */
export async function invalidateKey(api: GrpcConnection, key: string, ctx?: ContextInterface): Promise<InvalidateKeyResponse> {
  const req = new InvalidateKeyRequest()
  req.setKey(key)
  const res: InvalidateKeyResponse = await api.unary(APIService.InvalidateKey, req, ctx)
  return res
}

/**
 * @internal
 */
export async function invitetoOrg(api: GrpcConnection, email: string, ctx?: ContextInterface): Promise<InviteToOrgResponse> {
  const req = new InviteToOrgRequest()
  req.setEmail(email)
  const res: InviteToOrgResponse = await api.unary(APIService.InviteToOrg, req, ctx)
  return res
}

/**
 * @internal
 */
export async function isOrgNameAvailable(api: GrpcConnection, name: string, ctx?: ContextInterface): Promise<IsOrgNameAvailableResponse> {
  const req = new IsOrgNameAvailableRequest()
  req.setName(name)
  const res: IsOrgNameAvailableResponse = await api.unary(APIService.IsOrgNameAvailable, req, ctx)
  return res
}

/**
 * @internal
 */
export async function isUsernameAvailable(api: GrpcConnection, username: string, ctx?: ContextInterface): Promise<IsUsernameAvailableResponse> {
  const req = new IsUsernameAvailableRequest()
  req.setUsername(username)
  const res: IsUsernameAvailableResponse = await api.unary(APIService.IsUsernameAvailable, req, ctx)
  return res
}

/**
 * @internal
 */
export async function listKeys(api: GrpcConnection, ctx?: ContextInterface): Promise<ListKeysResponse> {
  const req = new ListKeysRequest()
  const res: ListKeysResponse = await api.unary(APIService.ListKeys, req, ctx)
  return res
}

/**
 * @internal
 */
export async function listOrgs(api: GrpcConnection, ctx?: ContextInterface): Promise<ListOrgsResponse> {
  const req = new ListOrgsRequest()
  const res: ListOrgsResponse = await api.unary(APIService.ListOrgs, req, ctx)
  return res
}

/**
 * @internal
 */
export async function leaveOrg(api: GrpcConnection, ctx?: ContextInterface): Promise<LeaveOrgResponse> {
  const req = new LeaveOrgRequest()
  const res: LeaveOrgResponse = await api.unary(APIService.LeaveOrg, req, ctx)
  return res
}

/**
 * @internal
 */
export async function signUp(api: GrpcConnection, username: string, email: string, ctx?: ContextInterface): Promise<SignupResponse> {
  const req = new SignupRequest()
  req.setEmail(email)
  req.setUsername(username)
  const res: SignupResponse = await api.unary(APIService.Signup, req, ctx)
  return res
}

/**
 * @internal
 */
export async function signIn(api: GrpcConnection, usernameOrEmail: string, ctx?: ContextInterface): Promise<SigninResponse> {
  const req = new SigninRequest()
  req.setUsernameOrEmail(usernameOrEmail)
  const res: SigninResponse = await api.unary(APIService.Signin, req, ctx)
  return res
}

/**
 * @internal
 */
export async function signOut(api: GrpcConnection, name: string, ctx?: ContextInterface) {
  const req = new SignoutRequest()
  await api.unary(APIService.CreateOrg, req, ctx)
  return
}