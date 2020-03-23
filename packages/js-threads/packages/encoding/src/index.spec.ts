import { expect } from 'chai'
import { randomBytes, keys } from 'libp2p-crypto'
import { Block, EventHeader, RecordNode } from '@textile/threads-core'
import { defaultOptions, decodeBlock } from './coding'
import { createEvent } from './event'
import { createRecord } from './record'

const readKey = randomBytes(32)
const replicatorKey = randomBytes(32)
const raw = { txt: 'hello world' }

describe('Encoding...', () => {
  describe('Event...', () => {
    it('should encode and encrypt log events', async () => {
      const key = randomBytes(32)
      const body = Block.encoder(raw, defaultOptions.codec)
      const obj = await createEvent(body, readKey, key)
      expect(obj).to.have.haveOwnProperty('value')
      expect(obj).to.have.haveOwnProperty('body')
      expect(obj).to.have.haveOwnProperty('header')
      const decodedBody = decodeBlock(obj.body, key)
      expect(decodedBody.decodeUnsafe()).to.deep.equal(raw)
      const decodedHeader = decodeBlock<EventHeader>(obj.header, readKey)
      const header = decodedHeader.decodeUnsafe()
      expect(header).to.haveOwnProperty('key')
      expect(header).to.haveOwnProperty('time')
      expect(header.key).to.deep.equal(key)
      expect(Math.round(Date.now() / 1000) - header.time)
        .to.be.lessThan(100)
        .and.greaterThan(-0.0001) // small delta for floating point errors
    })
  })

  describe('Record...', () => {
    it('should encode and encrypt a log record', async () => {
      const privKey = await keys.generateKeyPair('Ed25519', 256)
      const body = Block.encoder(raw, defaultOptions.codec)
      const event = await createEvent(body, readKey)
      const { value } = await createRecord(event, privKey, replicatorKey, undefined)
      const decoded = decodeBlock<RecordNode>(value, replicatorKey).decode()
      expect(decoded.prev).to.be.undefined
      expect(decoded).to.haveOwnProperty('block')
      expect(decoded).to.haveOwnProperty('sig')
    })
  })
})
