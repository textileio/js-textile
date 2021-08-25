/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// From https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/mongodb/index.d.ts

/** Update Query */
type KeysOfAType<TSchema, Type> = {
  [key in keyof TSchema]: NonNullable<TSchema[key]> extends Type ? key : never
}[keyof TSchema]
type KeysOfOtherType<TSchema, Type> = {
  [key in keyof TSchema]: NonNullable<TSchema[key]> extends Type ? never : key
}[keyof TSchema]

type AcceptedFields<TSchema, FieldType, AssignableType> = {
  readonly [key in KeysOfAType<TSchema, FieldType>]?: AssignableType
}

/** It avoid uses fields of non Type */
type NotAcceptedFields<TSchema, FieldType> = {
  readonly [key in KeysOfOtherType<TSchema, FieldType>]?: never
}

type DotAndArrayNotation<AssignableType> = {
  readonly [key: string]: AssignableType
}

type ReadonlyPartial<TSchema> = {
  readonly [key in keyof TSchema]?: TSchema[key]
}

export type OnlyFieldsOfType<
  TSchema,
  FieldType = any,
  AssignableType = FieldType
> = AcceptedFields<TSchema, FieldType, AssignableType> &
  NotAcceptedFields<TSchema, FieldType> &
  DotAndArrayNotation<AssignableType>

export type MatchKeysAndValues<TSchema> = ReadonlyPartial<TSchema> &
  DotAndArrayNotation<any>

type Unpacked<Type> = Type extends Array<infer Element> ? Element : Type

// type UpdateOptionalId<T> = T extends { _id?: any } ? OptionalId<T> : T;
type UpdateOptionalId<T> = T extends { _id?: any } ? T : T

export type SortValues = -1 | 1

export type AddToSetOperators<Type> = {
  $each: Type
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ArrayOperator<Type> = {
  // $each: Type;
  $slice?: number
  // $position?: number;
  $sort?: SortValues | Record<string, SortValues>
}

export type SetFields<TSchema> = ({
  readonly [key in KeysOfAType<TSchema, any[] | undefined>]?:
    | UpdateOptionalId<Unpacked<TSchema[key]>>
    | AddToSetOperators<Array<UpdateOptionalId<Unpacked<TSchema[key]>>>>
} &
  NotAcceptedFields<TSchema, any[] | undefined>) & {
  readonly [key: string]: AddToSetOperators<any> | any
}

export type PushOperator<TSchema> = ({
  readonly [key in KeysOfAType<TSchema, any[]>]?:
    | UpdateOptionalId<Unpacked<TSchema[key]>>
    | ArrayOperator<Array<UpdateOptionalId<Unpacked<TSchema[key]>>>>
} &
  NotAcceptedFields<TSchema, any[]>) & {
  readonly [key: string]: ArrayOperator<any> | any
}

export type PullOperator<TSchema> = ({
  readonly [key in KeysOfAType<TSchema, any[]>]?:
    | Partial<Unpacked<TSchema[key]>>
    | ObjectQuerySelector<Unpacked<TSchema[key]>>
} &
  NotAcceptedFields<TSchema, any[]>) & {
  readonly [key: string]: QuerySelector<any> | any
}

export type PullAllOperator<TSchema> = ({
  readonly [key in KeysOfAType<TSchema, any[]>]?: TSchema[key]
} &
  NotAcceptedFields<TSchema, any[]>) & {
  readonly [key: string]: any[]
}

/** https://docs.mongodb.com/manual/reference/operator/update */
export type UpdateQuery<TSchema> = {
  /** https://docs.mongodb.com/manual/reference/operator/update-field/ */
  // $currentDate?: OnlyFieldsOfType<
  //   TSchema,
  //   Date,
  //   true | { $type: "date" | "timestamp" }
  // >;
  $inc?: OnlyFieldsOfType<TSchema, number | undefined>
  $mul?: OnlyFieldsOfType<TSchema, number | undefined>
  $rename?: { [key: string]: string }
  $set?: MatchKeysAndValues<TSchema>
  $unset?: OnlyFieldsOfType<TSchema, any, '' | 1 | true>
  $min?: MatchKeysAndValues<TSchema>
  $max?: MatchKeysAndValues<TSchema>
  /** https://docs.mongodb.com/manual/reference/operator/update-array/ */
  $addToSet?: SetFields<TSchema>
  $pop?: OnlyFieldsOfType<TSchema, any[], 1 | -1>
  $push?: PushOperator<TSchema>
  $pull?: PullOperator<TSchema>
  $pullAll?: PullAllOperator<TSchema>
}

// we can search using alternative types in mongodb e.g.
// string types can be searched using a regex in mongo
// array types can be searched using their element type
type RegExpForString<T> = T extends string ? RegExp | T : T
type MongoAltQuery<T> = T extends Array<infer U>
  ? T | RegExpForString<U>
  : RegExpForString<T>

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
  // $type?: BSONType | BSONTypeAlias;
  // Evaluation
  // $expr?: any;
  // $jsonSchema?: any;
  // $mod?: T extends number ? [number, number] : never;
  // $regex?: T extends string ? RegExp | string : never;
  // $options?: T extends string ? string : never;
  // // Array
  // // TODO: define better types for $all and $elemMatch
  $all?: T extends Array<infer U> ? any[] : never
  $elemMatch?: T extends Array<infer U> ? Record<string, unknown> : never
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
  // $text?: {
  //   $search: string;
  //   $language?: string;
  //   $caseSensitive?: boolean;
  //   $diacraticSensitive?: boolean;
  // };
  // /** https://docs.mongodb.com/manual/reference/operator/query/where/#op._S_where */
  // $where?: string | Function;
  // /** https://docs.mongodb.com/manual/reference/operator/query/comment/#op._S_comment */
  // $comment?: string;
  // we could not find a proper TypeScript generic to support nested queries e.g. 'user.friends.name'
  // this will mark all unrecognized properties as any (including nested queries)
  // [key: string]: any;
}

export type ObjectQuerySelector<T> = T extends Record<string, unknown>
  ? { [key in keyof T]?: QuerySelector<T[key]> }
  : QuerySelector<T>

export type Condition<T> = MongoAltQuery<T> | QuerySelector<MongoAltQuery<T>>

export type FilterQuery<T> = {
  [P in keyof T]?: Condition<T[P]>
} &
  RootQuerySelector<T>
