/**
 * @packageDocumentation
 * @module @textile/threads-client
 */
import { grpc } from '@improbable-eng/grpc-web'
import { ThreadID } from '@textile/threads-id'

/**
 * Transaction represents a bulk transaction on a store.
 * @hidden
 */
export class Transaction<
  TRequest extends grpc.ProtobufMessage,
  TResponse extends grpc.ProtobufMessage
> {
  /**
   * Transaction creates a new transaction for the given store using the given model.
   * @param client The gRPC client to use for the transaction.
   * @param dbID the ID of the database
   * @param modelName The human-readable name for the model.
   */
  constructor(
    protected readonly client: grpc.Client<TRequest, TResponse>,
    protected readonly dbID: ThreadID,
    protected readonly modelName: string,
  ) {}

  /**
   * end completes (flushes) the transaction. All operations between start and end will be applied as a single transaction upon a call to end.
   */
  public async end() {
    this.client.close()
  }

  /**
   * setReject rejects the current transaction, rather than flushing the results to the remote store via end.
   * @param reject The optional reason for rejecting the transaction.
   */
  protected setReject(reject: (reason?: any) => void) {
    this.client.onEnd((status: grpc.Code, message: string) => {
      if (status !== grpc.Code.OK) {
        reject(new Error(message))
      }
    })
  }
}
