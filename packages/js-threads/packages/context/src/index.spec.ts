import { expect } from 'chai'
import { Provider, Context, expirationError } from './index'

describe('Context', () => {
  it('should throw an exception when working with an expired msg', async () => {
    const context: Context = new Provider()
    try {
      context.withAPISig({
        sig: 'fake',
        // Create msg date in the past
        msg: new Date(Date.now() - 1000 * 60).toUTCString(),
      })
      context.toJSON()
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).to.equal(expirationError)
    }
    const msg = new Date(Date.now() + 1000 * 60).toUTCString()
    context.withAPISig({
      sig: 'fake',
      msg,
    })
    const json = context.toJSON()
    expect(json).to.haveOwnProperty('x-textile-api-sig-msg', msg)
  })
})
