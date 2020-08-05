import { randomBytes } from "@textile/threads-crypto"
import log from "loglevel"
import { encodeBlock } from "./coding"
import { Event, EventHeader, EventNode } from "./interfaces"
import { Block } from "./ipld"

const logger = log.getLogger("encoding:event")

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
  key?: Uint8Array
): Promise<Event> {
  logger.debug("creating event")
  const keyiv = Buffer.from(key || randomBytes(32))
  const codedBody = await encodeBlock(body, keyiv)
  const header: EventHeader = { key: keyiv }
  const eventHeader = Block.encoder(header, "dag-cbor")
  const codedHeader = await encodeBlock(eventHeader, readKey)
  // Encode to create the caches
  codedBody.encode()
  codedHeader.encode()
  const obj: EventNode = {
    body: await codedBody.cid(),
    header: await codedHeader.cid(),
  }
  const codedEvent = Block.encoder(obj, "dag-cbor")
  codedEvent.encode()
  // @todo: We don't support a dag here yet, but this is where we'd add this data to IPFS!
  const event: Event = {
    value: codedEvent,
    header: codedHeader,
    body: codedBody,
  }
  return event
}
