import CID from "cids"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const _Block = require("@ipld/block") as BlockConstructor

export type Codec = any

export interface Reader<T> {
  get(path: string): { value: T; remainderPath?: string }
  links(): IterableIterator<[string, CID]>
  tree(): IterableIterator<string>
}

export interface Options {
  source?: any
  data?: Buffer
  codec?: string
  cid?: CID | string
  algo?: string
}

export interface Block<T = any> {
  opts: Options
  readonly codec: string
  source(): T | null
  cid(): Promise<CID>
  validate(): boolean
  encode(): Buffer
  encodeUnsafe(): Buffer
  decode(): T
  decodeUnsafe(): T
  reader(): Reader<T>
}

export interface BlockConstructor {
  new <T>(opts: Options): Block<T>
  getCodec(codec: string): Codec
  encoder<T>(source: T, codec: string, algo?: string): Block<T>
  decoder<T = any>(data: Buffer, codec: string, algo: string): Block<T>
  create<T = any>(data: Buffer, cid: CID /*, validate: boolean */): Block<T>
}

export const Block: BlockConstructor = _Block
