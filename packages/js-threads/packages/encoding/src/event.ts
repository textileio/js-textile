import { randomBytes } from 'libp2p-crypto'
import log from 'loglevel'
import { Block, Event, EventNode, EventHeader } from '@textile/threads-core'
import { Options, defaultOptions, encodeBlock } from './coding'

const logger = log.getLogger('encoding:event')

export async function createEvent(body: Block, readKey: Uint8Array, key?: Uint8Array, opts: Options = defaultOptions) {
  logger.debug('creating event')
  const keyiv = key || randomBytes(32)
  const codedBody = encodeBlock(body, keyiv)
  const header: EventHeader = {
    key: keyiv,
    time: Math.round(new Date().getTime() / 1000),
  }
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
  // @todo: Do we need to encode the values here, rather than letting the encoder do it later?
  const event: Event = {
    value: codedEvent,
    header: codedHeader,
    body: codedBody,
  }
  return event
}
