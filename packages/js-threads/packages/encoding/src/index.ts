/* eslint-disable @typescript-eslint/no-var-requires */
import Base58 from 'bs58'
import { BaseRecord, HeaderNode, EventNode, RecordNode } from '@textile/threads-core'
import { decodeBlock, CodecOptions, createEvent, defaultCodecOpts } from './crypto/node'

const Block = require('@ipld/block')

export { CodecOptions }
export { BaseRecord }

export class RecordEncoder {
  constructor(private logRecord: BaseRecord, private opts: CodecOptions = defaultCodecOpts) {}
  /**
   * Create new Record from existing LogRecord
   * @param record The input LogRecord
   * @param opts The encoding options to use when decoding the data from IPLD blocks.
   */
  static async decode(record: BaseRecord, opts: CodecOptions = defaultCodecOpts) {
    return new RecordEncoder(record, opts)
  }
  /**
   * Create new Record from a raw input body.
   * @param obj The input data to encode into a Record.
   * @param readKey The required symmetric read key.
   * @param key The optional symmetric key to use to encrypt the raw body data.
   * @param opts The encoding options to use when encoding the data as IPLD blocks.
   */
  static async encode(obj: any, readKey: string, key?: string, opts: CodecOptions = defaultCodecOpts) {
    const { body, header } = await createEvent(obj, readKey, key, opts)
    const event = {
      body: await body.cid(),
      header: await header.cid(),
    }
    const codedEvent = Block.encoder(event, opts.codec, opts.codec).encode()
    const record = {
      // eslint-disable-next-line @typescript-eslint/camelcase
      event_node: codedEvent.toString('base64'),
      // eslint-disable-next-line @typescript-eslint/camelcase
      body_node: body.encode().toString('base64'),
      // eslint-disable-next-line @typescript-eslint/camelcase
      header_node: header.encode().toString('base64'),
    }
    return new RecordEncoder(record, opts)
  }
  async header(readKey: string) {
    if (this.logRecord.header_node) {
      const headerNode = this.logRecord.header_node
      const headerRaw = Buffer.from(headerNode, 'base64')
      const header = await decodeBlock(headerRaw, readKey, this.opts)
      return header as HeaderNode
    }
    return undefined
  }
  async body(readKey: string) {
    const head = await this.header(readKey)
    if (this.logRecord.body_node && head) {
      const key = Base58.encode(head.key)
      const bodyNode = this.logRecord.body_node
      const bodyRaw = Buffer.from(bodyNode, 'base64')
      const body = await decodeBlock(bodyRaw, key, this.opts)
      return body
    }
    return undefined
  }
  async event() {
    if (this.logRecord.event_node) {
      const eventNode = this.logRecord.event_node
      const eventRaw = Buffer.from(eventNode, 'base64')
      // Event 'body' is not encrypted, so don't use decodeBlock
      const event = Block.decoder(eventRaw, this.opts.codec, this.opts.algo).decode()
      return event as EventNode
    }
    return undefined
  }
  async record(followKey: string) {
    if (this.logRecord.record_node) {
      const recordNode = this.logRecord.record_node
      const recordRaw = Buffer.from(recordNode, 'base64')
      const record = await decodeBlock(recordRaw, followKey, this.opts)
      return record as RecordNode
    }
    return undefined
  }
}
