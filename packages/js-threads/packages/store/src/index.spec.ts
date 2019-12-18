import { expect } from 'chai'
import { ID, Variants } from '@textile/threads-core'

describe('Hello Component', () => {
  it("should say 'Hello world!'", async () => {
    const _i = ID.newRandom(Variants.Raw, 32)
    expect(true).to.be.true
  })
})
