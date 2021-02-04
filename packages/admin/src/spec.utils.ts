import type { Admin } from './admin'
import type { SigninOrSignupResponse } from './api'
import { confirmEmail } from '@textile/testing'

// Function for reusable signup
export const signup = (
  admin: Admin,
  username: string,
  email: string,
  addrGatewayUrl: string,
  sessionSecret: string,
): Promise<SigninOrSignupResponse> =>
  new Promise<SigninOrSignupResponse>((resolve, reject) => {
    admin
      .signUp(username, email)
      .then((user) => {
        resolve(user)
      })
      .catch(reject)
    confirmEmail(addrGatewayUrl, sessionSecret)
  })

// Function for reusable signin
export const signin = (
  admin: Admin,
  username: string,
  addrGatewayUrl: string,
  sessionSecret: string,
): Promise<SigninOrSignupResponse> =>
  new Promise<SigninOrSignupResponse>((resolve, reject) => {
    admin
      .signIn(username)
      .then((user) => {
        resolve(user)
      })
      .catch(reject)
    confirmEmail(addrGatewayUrl, sessionSecret)
  })
