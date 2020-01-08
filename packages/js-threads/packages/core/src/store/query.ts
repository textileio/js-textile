// Type definitions for MongoDB 3.3
// Project: https://github.com/mongodb/node-mongodb-native
//          https://github.com/mongodb/node-mongodb-native/tree/3.1
// Definitions by: Federico Caselli <https://github.com/CaselIT>
//                 Alan Marcell <https://github.com/alanmarcell>
//                 Jason Dreyzehner <https://github.com/bitjson>
//                 Gaurav Lahoti <https://github.com/dante-101>
//                 Mariano Cortesi <https://github.com/mcortesi>
//                 Enrico Picci <https://github.com/EnricoPicci>
//                 Alexander Christie <https://github.com/AJCStriker>
//                 Julien Chaumond <https://github.com/julien-c>
//                 Dan Aprahamian <https://github.com/daprahamian>
//                 Denys Bushulyak <https://github.com/denys-bushulyak>
//                 Bastien Arata <https://github.com/BastienAr>
//                 Wan Bachtiar <https://github.com/sindbach>
//                 Geraldine Lemeur <https://github.com/geraldinelemeur>
//                 Jimmy Shimizu <https://github.com/jishi>
//                 Dominik Heigl <https://github.com/various89>
//                 Angela-1 <https://github.com/angela-1>
//                 Mikael Lirbank <https://github.com/lirbank>
//                 Hector Ribes <https://github.com/hector7>
//                 Florian Richter <https://github.com/floric>
//                 Erik Christensen <https://github.com/erikc5000>
//                 Nick Zahn <https://github.com/Manc>
//                 Jarom Loveridge <https://github.com/jloveridge>
//                 Luis Pais <https://github.com/ranguna>
//                 Hossein Saniei <https://github.com/HosseinAgha>
//                 Alberto Silva <https://github.com/albertossilva>
//                 Rauno Viskus <https://github.com/Rauno56>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 3.0

// Documentation: https://mongodb.github.io/node-mongodb-native/3.1/api/
/// <reference types="node" />

/** https://docs.mongodb.com/manual/reference/operator/query/type/#available-types */
export enum BSONType {
  Double = 1,
  String,
  Object,
  Array,
  BinData,
  /** @deprecated */
  Undefined,
  ObjectId,
  Boolean,
  Date,
  Null,
  Regex,
  /** @deprecated */
  DBPointer,
  JavaScript,
  /** @deprecated */
  Symbol,
  JavaScriptWithScope,
  Int,
  Timestamp,
  Long,
  Decimal,
  MinKey = -1,
  MaxKey = 127,
}

export type BSONTypeAlias =
  | 'number'
  | 'double'
  | 'string'
  | 'object'
  | 'array'
  | 'binData'
  | 'undefined'
  | 'objectId'
  | 'bool'
  | 'date'
  | 'null'
  | 'regex'
  | 'dbPointer'
  | 'javascript'
  | 'symbol'
  | 'javascriptWithScope'
  | 'int'
  | 'timestamp'
  | 'long'
  | 'decimal'
  | 'minKey'
  | 'maxKey'

// we can search using alternative types in mongodb e.g.
// string types can be searched using a regex in mongo
// array types can be searched using their element type
export type RegExpForString<T> = T extends string ? RegExp | T : T
export type MongoAltQuery<T> = T extends Array<infer U> ? T | RegExpForString<U> : RegExpForString<T>

/** https://docs.mongodb.com/manual/reference/operator/query/#query-selectors */
export type QuerySelector<T> = {
  // Comparison
  $eq?: T
  $gt?: T
  $gte?: T
  $in?: T[]
  $lt?: T
  $lte?: T
  $ne?: T
  $nin?: T[]
  // Logical
  $not?: T extends string ? QuerySelector<T> | RegExp : QuerySelector<T>
  // Element
  /**
   * When `true`, `$exists` matches the documents that contain the field,
   * including documents where the field value is null.
   */
  $exists?: boolean
  $type?: BSONType | BSONTypeAlias
  // Evaluation
  $expr?: any
  $jsonSchema?: any
  $mod?: T extends number ? [number, number] : never
  $regex?: T extends string ? RegExp | string : never
  $options?: T extends string ? string : never
  // Array
  // TODO: define better types for $all and $elemMatch
  $all?: T extends Array<infer U> ? any[] : never
  $elemMatch?: T extends Array<infer U> ? object : never
  $size?: T extends Array<infer U> ? number : never
}

export type RootQuerySelector<T> = {
  /** https://docs.mongodb.com/manual/reference/operator/query/and/#op._S_and */
  $and?: Array<FilterQuery<T>>
  /** https://docs.mongodb.com/manual/reference/operator/query/nor/#op._S_nor */
  $nor?: Array<FilterQuery<T>>
  /** https://docs.mongodb.com/manual/reference/operator/query/or/#op._S_or */
  $or?: Array<FilterQuery<T>>
  /** https://docs.mongodb.com/manual/reference/operator/query/text */
  $text?: {
    $search: string
    $language?: string
    $caseSensitive?: boolean
    $diacraticSensitive?: boolean
  }
  /** https://docs.mongodb.com/manual/reference/operator/query/where/#op._S_where */
  $where?: string | Function
  /** https://docs.mongodb.com/manual/reference/operator/query/comment/#op._S_comment */
  $comment?: string
  // we could not find a proper TypeScript generic to support nested queries e.g. 'user.friends.name'
  // this will mark all unrecognized properties as any (including nested queries)
  [key: string]: any
}

export type ObjectQuerySelector<T = any> = T extends object
  ? { [key in keyof T]?: QuerySelector<T[key]> }
  : QuerySelector<T>

export type Condition<T = any> = MongoAltQuery<T> | QuerySelector<MongoAltQuery<T>>

export type FilterQuery<T = any> = { [P in keyof T]?: Condition<T[P]> } & RootQuerySelector<T>
