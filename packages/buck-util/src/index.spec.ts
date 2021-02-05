import * as path from 'path'
import { Context } from '@textile/context'
import { Buckets } from '@textile/buckets'
import { execute } from './index'
import { expect } from 'chai'
import { addrApiurl, addrGatewayUrl, createKey, sessionSecret, signUp } from '@textile/testing'

describe('Buckets node util...', function () {
  let key = ''
  let secret = ''
  let testThread = ''
  before(async function () {
    this.timeout(10000)
    const ctx = new Context(addrApiurl)
    const user = await signUp(ctx, addrGatewayUrl, sessionSecret)
    ctx.withSession(user.user?.session)
    if (!user.user) throw new Error('user signup error')
    const dev = user.user
    const tmp = new Context(addrApiurl).withSession(dev.session)
    const { keyInfo } = await createKey(tmp, 'KEY_TYPE_ACCOUNT')
    if (!keyInfo) throw new Error('no keys generated')
    key = keyInfo.key
    secret = keyInfo.secret
    const buckets = await Buckets.withKeyInfo({ key, secret }, { host: addrApiurl })
    const { root, threadID } = await buckets.getOrCreate('test')
    if (!threadID) throw new Error('no thread generated')
    testThread = threadID.toString()
  })

  it('push bucket updates', async function () {
    this.timeout(15000)
    const cwd = path.join(__dirname, '../test')
    const result = await execute(addrApiurl, key, secret, testThread, 'test', 'false', '**/*', 'website', cwd)
    expect(result.get('ipfs')).to.not.be.undefined
  })
})

