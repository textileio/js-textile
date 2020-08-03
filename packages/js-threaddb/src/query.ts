/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */

// From https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/mongodb/index.d.ts

/** http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#find */
export interface FindOptions {
  /**
   * Sets the limit of documents returned in the query.
   */
  limit?: number;
  /**
   * Set to sort the documents coming back from the query. Array of indexes, [['a', 1]] etc.
   */
  sort?: any[] | object;
  /**
   * The fields to return in the query. Object of fields to include or exclude (not both), {'a':1}
   */
  projection?: object;
  /**
   * Set to skip N documents ahead in your query (useful for pagination).
   */
  skip?: number;
  // timeout?: boolean;
  /**
   * Only return the index key.
   */
  returnKey?: boolean;
  /**
   * Set index bounds.
   */
  min?: number;
  /**
   * Set index bounds.
   */
  max?: number;
  /**
   * Return document results as raw Uint8Arrays.
   */
  raw?: boolean;
  /**
   * Number of miliseconds to wait before aborting the query.
   */
  maxTimeMS?: number;
}

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

type BSONTypeAlias =
  | "number"
  | "double"
  | "string"
  | "object"
  | "array"
  | "binData"
  | "undefined"
  | "objectId"
  | "bool"
  | "date"
  | "null"
  | "regex"
  | "dbPointer"
  | "javascript"
  | "symbol"
  | "javascriptWithScope"
  | "int"
  | "timestamp"
  | "long"
  | "decimal"
  | "minKey"
  | "maxKey";

// we can search using alternative types in mongodb e.g.
// string types can be searched using a regex in mongo
// array types can be searched using their element type
type RegExpForString<T> = T extends string ? RegExp | T : T;
type MongoAltQuery<T> = T extends Array<infer U>
  ? T | RegExpForString<U>
  : RegExpForString<T>;

/** https://docs.mongodb.com/manual/reference/operator/query/#query-selectors */
export type QuerySelector<T> = {
  // Comparison
  $eq?: T;
  $gt?: T;
  $gte?: T;
  $in?: T[];
  $lt?: T;
  $lte?: T;
  $ne?: T;
  $nin?: T[];
  // Logical
  $not?: T extends string ? QuerySelector<T> | RegExp : QuerySelector<T>;
  // Element
  /**
   * When `true`, `$exists` matches the documents that contain the field,
   * including documents where the field value is null.
   */
  $exists?: boolean;
  $type?: BSONType | BSONTypeAlias;
  // Evaluation
  $expr?: any;
  $jsonSchema?: any;
  $mod?: T extends number ? [number, number] : never;
  $regex?: T extends string ? RegExp | string : never;
  $options?: T extends string ? string : never;
  // // Array
  // // TODO: define better types for $all and $elemMatch
  $all?: T extends Array<infer U> ? any[] : never;
  $elemMatch?: T extends Array<infer U> ? object : never;
  $size?: T extends Array<infer U> ? number : never;
};

export type RootQuerySelector<T> = {
  /** https://docs.mongodb.com/manual/reference/operator/query/and/#op._S_and */
  $and?: Array<FilterQuery<T>>;
  /** https://docs.mongodb.com/manual/reference/operator/query/nor/#op._S_nor */
  $nor?: Array<FilterQuery<T>>;
  /** https://docs.mongodb.com/manual/reference/operator/query/or/#op._S_or */
  $or?: Array<FilterQuery<T>>;
  /** https://docs.mongodb.com/manual/reference/operator/query/text */
  $text?: {
    $search: string;
    $language?: string;
    $caseSensitive?: boolean;
    $diacraticSensitive?: boolean;
  };
  /** https://docs.mongodb.com/manual/reference/operator/query/where/#op._S_where */
  $where?: string | Function;
  /** https://docs.mongodb.com/manual/reference/operator/query/comment/#op._S_comment */
  $comment?: string;
  // we could not find a proper TypeScript generic to support nested queries e.g. 'user.friends.name'
  // this will mark all unrecognized properties as any (including nested queries)
  [key: string]: any;
};

export type ObjectQuerySelector<T> = T extends object
  ? { [key in keyof T]?: QuerySelector<T[key]> }
  : QuerySelector<T>;

export type Condition<T> = MongoAltQuery<T> | QuerySelector<MongoAltQuery<T>>;

export type FilterQuery<T> = {
  [P in keyof T]?: Condition<T[P]>;
} &
  RootQuerySelector<T>;
