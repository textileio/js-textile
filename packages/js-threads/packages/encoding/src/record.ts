import {
  Block,
  Event,
  EventNode,
  Identity,
  LogRecord,
  Public,
  RecordNode,
} from "@textile/threads-core"
import CID from "cids"
import log from "loglevel"
import { decodeBlock, encodeBlock } from "./coding"

const logger = log.getLogger("encoding:record")

/**
 * EncodedRecord is a serialized version of a record that contains link data.
 */
export interface EncodedRecord {
  recordnode: Uint8Array | string
  eventnode: Uint8Array | string
  headernode: Uint8Array | string
  bodynode: Uint8Array | string
}

export interface CreateRecordConfig {
  /**
   * The private key to use for signing.
   */
  privKey: Identity

  /**
   * The public key of the Record author.
   */
  pubKey: Public

  /**
   * The symmetric key to use for encrypting the record body.
   */
  servKey: Uint8Array

  /**
   * An optional previous Record CID.
   */
  prev?: CID
}

/**
 * CreateRecord returns a new record from the given block and log private key.
 * @param data Input Event data.
 * @param config A set of key/CID options for creating the new record.
 * @param opts Additional encoding/encryption options.
 */
export async function createRecord(
  data: Event,
  config: CreateRecordConfig
): Promise<LogRecord> {
  logger.debug("creating record")
  const block = await data.value.cid()
  let payload = block.buffer
  const pubKey = Buffer.from(config.pubKey.bytes)
  if (config.prev && CID.isCID(config.prev)) {
    payload = Buffer.concat([payload, config.prev.buffer])
  } else {
    payload = pubKey
  }
  const sig = await config.privKey.sign(payload)
  const obj: RecordNode = { block, sig, pubKey }
  // Don't include prev unless it is defined
  if (config.prev) obj.prev = config.prev
  const node = Block.encoder(obj, "dag-cbor")
  const value = await encodeBlock(node, config.servKey)
  // @todo: We don't support a dag here yet, but this is where we'd add this data to IPFS!
  const record: LogRecord = { value, obj, block: data }
  return record
}

/**
 * RecordToProto returns a proto version of a record for transport. Nodes are sent encrypted.
 * @param rec The input record to encode as a protobuf-like object.
 */
export function recordToProto(rec: LogRecord): EncodedRecord {
  logger.debug("converting log record to proto object")
  const event = rec.block
  const eventnode = event.value.encodeUnsafe() //.toString("base64")
  const headernode = event.header.encodeUnsafe() //.toString("base64")
  const bodynode = event.body.encodeUnsafe() //.toString("base64")
  const recordnode = rec.value.encodeUnsafe() //.toString("base64")
  const record: EncodedRecord = {
    eventnode,
    headernode,
    bodynode,
    recordnode,
  }
  return record
}

/**
 * RecordFromProto returns a node from a serialized version that contains link data.
 * @param proto The input protobuf-like object.
 * @param key The symmetric key.
 * @param opts Additional encoding/encryption options.
 */
export async function recordFromProto(
  proto: EncodedRecord,
  key: Uint8Array
): Promise<LogRecord> {
  logger.debug("converting proto object to log record")
  const rawRecord = Buffer.from(proto.recordnode as string, "base64")
  const rnode = Block.decoder<Buffer>(rawRecord, "dag-cbor")
  const rawEvent = Buffer.from(proto.eventnode as string, "base64")
  const enode = Block.decoder<EventNode>(rawEvent, "dag-cbor")
  const rawHeader = Buffer.from(proto.headernode as string, "base64")
  const hnode = Block.decoder<Uint8Array>(rawHeader, "dag-cbor")
  const rawBody = Buffer.from(proto.bodynode as string, "base64")
  const body = Block.decoder<Uint8Array>(rawBody, "dag-cbor")
  const decoded = await decodeBlock(rnode, key)
  const robj = decoded.decode()
  const eobj = enode.decode()
  enode.encode() // Created encoded value
  body.encode()
  hnode.encode()
  const evt: Event = {
    value: enode,
    header: hnode,
    body: body,
    obj: eobj,
  }
  const rec: LogRecord = {
    value: rnode,
    obj: robj,
    block: evt,
  }
  return rec
}
