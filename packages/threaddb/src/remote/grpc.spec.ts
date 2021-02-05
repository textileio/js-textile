/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { grpc } from '@improbable-eng/grpc-web'
import { PrivateKey } from '@textile/crypto'
import ThreadID from '@textile/threads-id'
import { expect } from 'chai'
import { getToken, getTokenChallenge, newDB } from './grpc'

const opts = {
  serviceHost: 'http://127.0.0.1:6007',
}

describe('ThreadDB', function () {
  context('grpc', function () {
    describe('authenticate', async function () {
      it('should return a valid token from getToken', async function () {
        const privateKey = PrivateKey.fromRandom()
        const token = await getToken(privateKey, opts)
        expect(token).to.not.be.undefined
      })

      it('should return a valid token from getTokenChallenge', async function () {
        const privateKey = PrivateKey.fromRandom()
        const token = await getTokenChallenge(
          privateKey.public.toString(),
          async (challenge: Uint8Array) => {
            return privateKey.sign(challenge)
          },
          opts,
        )
        expect(token).to.not.be.undefined
      })

      it('should be able to create a remote db', async function () {
        // First, authenticate
        const privateKey = PrivateKey.fromRandom()
        const token = await getToken(privateKey, opts)
        // Next, create!
        const metadata = new grpc.Metadata({
          authentication: `bearer ${token}`,
        })
        const threadID = ThreadID.fromRandom()
        const id = await newDB('test', threadID, [], {
          ...opts,
          metadata,
        })
        expect(id).to.not.be.undefined
        expect(id).to.equal(threadID.toString())
      })
    })
  })
})
