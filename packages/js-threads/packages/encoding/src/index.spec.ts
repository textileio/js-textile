/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import CID from 'cids'
import Base58 from 'bs58'
import { expect } from 'chai'
import { RecordEncoder } from '.'

const input = {
  record_node:
    'WLQ/rImARp9uZ2dw0tU12DgQDRyT3J/Wwj0rt7I739loFIzYPE82pjZS9tMFVrDvgXsMXU/XAn2z41E6TIqzPbM6/VkKMcru0oEe5VnEmzLRDbYOmBr9Uho7x/KbeWpXfm8GUu+viBBwktuVFz0Gm4Z74UaVwuUVQTCKim7YH/zbPM7QkhbBRQy/DQdn2rQPFRmsJAgd7Fydo4KG+icYcHT1mzilfqOm4nyUvYmQXvPLNqU1xy4=',
  event_node:
    'omRib2R52CpYJQABcRIgwu4jIXV2zvNPD3OJpkkx9PYNn/RqwsEKAfBZwgsqkblmaGVhZGVy2CpYJQABcRIg7uOMHiwnnEeIECpLwtE12mkoc5RAqn+lxEYtXeiTpfM=',
  header_node:
    'WE2oKDx5XsA/9FVKesyrFTXBKmA5mLXf3Vemu58u5zTh8NjmViDIvYFGdPti1vwDr85QMmiCPMlfpscRLYyyoqAJor6mstTvYypnv3AZKg==',
  body_node: 'WCG7M6xYU4Z6APHvGVItlP40JsEhjNorfduruomEVDGYcHc=',
}

const readKey = 'ZH8u8CenXXHVCxRPzWGugV3DHsP3vRmD4F6UhHqocpYFbX2r81BRnd4tbDSq'
const followKey = 'gmpuqCBn8MBSNC5MYtpnAsTHWFRu2wyTGaDrjTHYjJBWCt9snfv4s3vsExTJ'
const sig = 'hldBgOws94qUGUTZXMumds3vUtlkYr33qlBgmJB22+NQ9F2c3TqvfQvzFzNlaGjg0MtUz2k8MUcvJNHFJ8qjCQ=='
const key = '29EApHMhnc1uRsxpppSijtWzTjWLBPD6MKErUKxDpD6gK7rjbMf6fHcus4VLf'

describe('Record...', () => {
  it('should decode and decrypt a log record', async () => {
    const record = await RecordEncoder.decode(input)
    const h = await record.header(readKey)
    expect(h!.key).to.deep.equal(Base58.decode(key))
    expect(h!.time).to.be.lessThan(new Date().valueOf())
    const b = await record.body(readKey)
    expect(b.txt).to.equal('hello world')
    const e = await record.event()
    // expect(e!.header).to.be.instanceOf(CID)
    // expect(e!.body).to.be.instanceOf(CID)
    const r = await record.record(followKey)
    expect(r!.sig.toString('base64')).to.equal(sig)
  })

  it('should encode and encrypt a log record', async () => {
    const record = await RecordEncoder.encode({ txt: 'hello world' }, readKey, key)
    const h = await record.header(readKey)
    expect(h!.key).to.deep.equal(Base58.decode(key))
    expect(h!.time).to.be.lessThan(new Date().valueOf())
    const b = await record.body(readKey)
    expect(b.txt).to.equal('hello world')
    const e = await record.event()
    // expect(e!.header).to.be.instanceOf(CID)
    // expect(e!.body).to.be.instanceOf(CID)
  })
})
