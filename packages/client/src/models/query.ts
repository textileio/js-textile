/**
 * @packageDocumentation
 * @module @textile/threads-client/models
 */
// import { QueryJSON, SortJSON, CriterionJSON, ComparisonJSON, ValueJSON, Value } from './models'

/**
 * Filter parameters for db subscription
 */
export interface Filter {
  /** The collection name */
  collectionName?: string
  /** The instance ID */
  instanceID?: string
  /** The action type: ALL (default), CREATE, SAVE, DELETE */
  actionTypes?: string[]
}

/**
 * Value represents a valid JSON data type.
 */
export type Value = string | boolean | number

/**
 * JSONValue is used by the gRPC server to handle JSON data types.
 */
export interface ValueJSON {
  string?: string
  bool?: boolean
  float?: number
}

/**
 * JSONOperation defines the set of possible operations to be used in a Query.
 */
export enum ComparisonJSON {
  Eq = 0,
  Ne,
  Gt,
  Lt,
  Ge,
  Le,
}

/**
 * CriterionJSON represents a single Query criteria.
 */
export interface CriterionJSON {
  fieldPath?: string
  operation?: ComparisonJSON
  value?: ValueJSON
  query?: QueryJSON
}

/**
 * SortJSON describes how and what field on which to sort a query.
 */
export interface SortJSON {
  fieldPath: string
  desc: boolean
}

/**
 * QueryJSON represents a single store Query.
 */
export interface QueryJSON {
  ands?: CriterionJSON[]
  ors?: QueryJSON[]
  sort?: SortJSON
  seek?: string // instanceId
  limit?: number
  skip?: number
  index?: string
}

/**
 * @hidden
 */
const valueToJSONValue = (value: Value): ValueJSON => {
  switch (typeof value) {
    case "string":
      return { string: value }
    case "boolean":
      return { bool: value }
    case "number":
      return { float: value }
    default:
      throw new Error("unsupported JSON value type")
  }
}

/**
 * Criterion is a partial condition that can specify comparison operator for a field.
 */
export class Criterion implements CriterionJSON {
  constructor(
    public fieldPath: string,
    public operation?: ComparisonJSON,
    public value?: ValueJSON,
    public query?: Query
  ) {}

  /**
   * eq is an equality operator against a field
   * @param value The value to query against. Must be a valid JSON data type.
   */
  eq(value: Value): Query {
    return this.create(ComparisonJSON.Eq, value)
  }

  /**
   * ne is a not equal operator against a field
   * @param value The value to query against. Must be a valid JSON data type.
   */
  ne(value: Value): Query {
    return this.create(ComparisonJSON.Ne, value)
  }

  /**
   * gt is a greater operator against a field
   * @param value The value to query against. Must be a valid JSON data type.
   */
  gt(value: Value): Query {
    return this.create(ComparisonJSON.Ne, value)
  }

  /** lt is a less operation against a field
   * @param value The value to query against. Must be a valid JSON data type.
   */
  lt(value: Value): Query {
    return this.create(ComparisonJSON.Lt, value)
  }

  /** ge is a greater or equal operator against a field
   * @param value The value to query against. Must be a valid JSON data type.
   */
  ge(value: Value): Query {
    return this.create(ComparisonJSON.Ge, value)
  }

  /** le is a less or equal operator against a field
   * @param value The value to query against. Must be a valid JSON data type.
   */
  le(value: Value): Query {
    return this.create(ComparisonJSON.Le, value)
  }

  /**
   * create updates this Criterion with a new Operation and returns the corresponding query.
   * @param op
   * @param value
   */
  private create(op: ComparisonJSON, value: Value): Query {
    this.operation = op
    this.value = valueToJSONValue(value)
    if (this.query === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      this.query = new Query()
    }
    this.query.ands.push(this)
    return this.query
  }

  /**
   * toJSON converts the Criterion to JSONCriterion, dropping circular references to internal Queries.
   */
  toJSON(): CriterionJSON {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { query, ...rest } = this
    return rest
  }
}

/**
 * Alias Criterion to Where for a slightly nicer API (see example below)
 */
const Where = Criterion

// Export Where for external callers
export { Where }

/**
 * Query allows to build queries to be used to fetch data from a model.
 */
export class Query implements QueryJSON {
  // Additional query resrictions
  public limit?: number
  public skip?: number
  public index?: string
  public seek?: string
  /**
   * Query creates a new generic query object.
   * @param ands An array of top-level Criterions to be included in the query.
   * @param ors An array of internal queries.
   * @param sort An object describing how to sort the query.
   */
  constructor(
    public ands: CriterionJSON[] = [],
    public ors: QueryJSON[] = [],
    public sort?: SortJSON
  ) {}

  /**
   * where starts to create a query condition for a field
   * @param fieldPath The field name to query on. Can be a hierarchical path.
   */
  static where(fieldPath: string): Criterion {
    return new Criterion(fieldPath)
  }

  /**
   * and concatenates a new condition in an existing field.
   * @param fieldPath The field name to query on. Can be a hierarchical path.
   */
  and(fieldPath: string): Criterion {
    return new Criterion(fieldPath, undefined, undefined, this)
  }

  /**
   * useIndex specifies the index to use when running this query.
   * @param fieldPath The path to the indexed field.
   * @note fieldPath must be a valid field for which an index has been created.
   */
  useIndex(fieldPath: string): Query {
    this.index = fieldPath
    return this
  }

  /**
   * or concatenates a new condition that is sufficient for an instance to
   * satisfy, independant of the current Query. Has left-associativity as:
   * (a And b) Or c
   * @param query The 'sub-query' to concat to the existing query.
   */
  or(query: Query): Query {
    this.ors.push(query)
    return this
  }

  /**
   * orderBy specify ascending order for the query results.
   * On multiple calls, only the last one is considered.
   * @param fieldPath The field name to query on. Can be a hierarchical path.
   */
  orderBy(fieldPath: string): Query {
    this.sort = { fieldPath, desc: false }
    return this
  }

  /**
   * orderByID specifies ascending ID order for the query results.
   * On multiple calls, only the last one is considered.
   */
  orderByID(): Query {
    this.sort = { fieldPath: "_id", desc: false }
    return this
  }

  /**
   * orderByDesc specify descending order for the query results.
   * On multiple calls, only the last one is considered.
   * @param fieldPath The field name to query on. Can be a hierarchical path.
   */
  orderByDesc(fieldPath: string): Query {
    this.sort = { fieldPath, desc: true }
    return this
  }

  /**
   * orderByIDDesc specifies descending ID order for the query results.
   * On multiple calls, only the last one is considered.
   */
  orderByIDDesc(): Query {
    this.sort = { fieldPath: "_id", desc: true }
    return this
  }

  /**
   * seekID seeks to the given ID before returning query results.
   * @param id The instance id to seek.
   */
  seekID(id: string): Query {
    this.seek = id
    return this
  }

  /**
   * limitTo sets the maximum number of results.
   * @param limit The max number of instances to return.
   */
  limitTo(limit: number): Query {
    this.limit = limit
    return this
  }

  /**
   * skipNum skips the given number of results.
   * @param num The number of instances to skip.
   */
  skipNum(num: number): Query {
    this.skip = num
    return this
  }
}
