import { expect } from 'chai'
import { PrivateKey, PublicKey } from './keypair'

describe('Keypair', () => {
  it('should be able to serialize and recover identities', async () => {
    const id = PrivateKey.fromRandom()
    const str = id.toString()
    const back = PrivateKey.fromString(str)
    expect(id).to.deep.equal(back)
  })

  it('signatures should verify', async () => {
    const id = PrivateKey.fromRandom()
    const msg = Buffer.from('teststring')
    const sig = await id.sign(msg)
    const verify = await id.public.verify(msg, sig)
    expect(verify).to.be.true
  })
})
