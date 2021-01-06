import axios from 'axios'
import type { Admin } from './admin'
import type { SigninOrSignupResponse } from './api'

const delay = (time: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, time))

export const createFakeUsername = (size = 12): string => {
  return Array(size)
    .fill(0)
    .map(() => Math.random().toString(36).charAt(2))
    .join('')
}

export const createFakeEmail = (): string => {
  return `${createFakeUsername()}@doe.com`
}

export const acceptInvite = async (
  gurl: string,
  token: string,
): Promise<boolean> => {
  await delay(500)
  const resp = await axios.get(`${gurl}/consent/${token}`)
  if (resp.status !== 200) {
    throw new Error(resp.statusText)
  }
  return true
}

export const confirmEmail = async (
  gurl: string,
  secret: string,
): Promise<boolean> => {
  await delay(500)
  const resp = await axios.get(`${gurl}/confirm/${secret}`)
  if (resp.status !== 200) {
    throw new Error(resp.statusText)
  }
  return true
}

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
