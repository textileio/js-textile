import { randomBytes } from 'libp2p-crypto'
import log from 'loglevel'
import { Block, Event, EventNode, EventHeader } from '@textile/threads-core'
import { Options, defaultOptions, encodeBlock } from './coding'

const logger = log.getLogger('encoding:event')

/**
 * CreateEvent creates a new Event object using the input raw Event body.
 * @param body Input block. Should be an IPLD Block wrapping the raw Event body.
 * @param readKey The input read key for encrypting the Event wrapper.
 * @param key The input symmetric key for raw data encryption.
 * @param opts Additional encoding/encryption options.
 */
export async function createEvent(
  body: Block,
  readKey: Uint8Array,
  key?: Uint8Array,
  opts: Options = defaultOptions,
) {
  logger.debug('creating event')
  const keyiv = key || randomBytes(32)
  const codedBody = encodeBlock(body, keyiv)
  const header: EventHeader = { key: keyiv }
  const eventHeader = Block.encoder(header, opts.codec, opts.algo)
  const codedHeader = encodeBlock(eventHeader, readKey, opts)
  // Encode to create the caches
  codedBody.encode()
  codedHeader.encode()
  const obj: EventNode = {
    body: await codedBody.cid(),
    header: await codedHeader.cid(),
  }
  const codedEvent = Block.encoder(obj, opts.codec, opts.algo)
  codedEvent.encode()
  // @todo: We don't support a dag here yet, but this is where we'd add this data to IPFS!
  const event: Event = {
    value: codedEvent,
    header: codedHeader,
    body: codedBody,
  }
  return event
}
