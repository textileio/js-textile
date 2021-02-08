import { expect } from 'chai'
import { hashString } from '.'

describe('ThreadDB', function () {
  context('utils', function () {
    it('should produce a decent hash that achieves avalanche (non-strict) ', async function () {
      const hash1 = hashString('++_id,name,age')
      const hash2 = hashString('++_id,name,age,sex')
      const hash3 = hashString(JSON.stringify('++_id,name,age').slice(1, -1))
      expect(hash1).to.not.equal(hash2)
      expect(hash1).to.equal(hash3)
    })
  })
})
