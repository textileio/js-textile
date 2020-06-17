import chai, { expect } from 'chai'
import dirtyChai from 'dirty-chai'
import * as crypto from './index'

chai.use(dirtyChai)

describe('randomBytes', function () {
  it('should produce the right number of random bytes', async () => {
    const bytes = crypto.randomBytes(32)
    expect(bytes).to.have.length(32)
  })
})
