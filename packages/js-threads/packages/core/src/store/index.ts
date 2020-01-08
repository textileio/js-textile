import { Block } from '../utils'

export { FilterQuery } from './query'

// EntityID is the type used in models identities
export type EntityID = string

export const EmptyEntityID: EntityID = ''

export interface Entity extends Object {
  ID?: EntityID
}

// Event is a local or remote event generated in a model and dispatched by Dispatcher.
export interface Event {
  time: Buffer
  entityID: EntityID
  collection: string // model
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Action {
  // ActionType is the type used by actions done in a txn
  export enum Type {
    // Create indicates the creation of an instance in a txn
    Create = 0,
    // Save indicates the mutation of an instance in a txn
    Save,
    // Delete indicates the deletion of an instance by ID in a txn
    Delete,
  }
}

// Action is a operation done in the model
interface Action<T extends Entity = object> {
  // Type of the action
  type: Action.Type
  // EntityID of the instance in action
  entityID: EntityID
  // ModelName of the instance in action
  collection: string // modelName
  // Previous is the instance before the action
  previous?: T
  // Current is the instance after the action was done
  current?: T
}

export { Action }

export interface ActionHandler<T extends Entity = object> {
  (actions: Array<Action<T>>): Promise<void>
}

export interface EncodedEvents<T extends Event> {
  events: T[]
  block: Block
}

// EventCodec transforms actions generated in models to events dispatched to thread logs, and viceversa.
export interface EventCodec<E extends Event> {
  // Reduce an event into the existing state
  reduce<T extends Entity = object>(state: T | undefined, event: Event): Promise<ReduceState<T>>
  // Encode Actions into Events to be dispatched
  encode<T extends Entity = object>(actions: Array<Action<T>>): Promise<EncodedEvents<E>>
  // Decode an IPLD Node payload into Events
  decode(block: Block): Promise<Array<E>>
}

export interface ReduceState<T extends Entity = object> {
  state: T | undefined
  action: ReduceAction
}

export interface ReduceAction {
  type: Action.Type
  collection: string
  entityID: EntityID
}
