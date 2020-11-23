import { grpc } from '@improbable-eng/grpc-web'
import { Context, ContextInterface } from '@textile/context'
import { WebsocketTransport } from '@textile/grpc-transport'

export interface ServiceError {
  message: string
  code: number
  metadata: grpc.Metadata
}

export class GrpcConnection {
  public serviceHost: string
  public rpcOptions: grpc.RpcOptions
  /**
   * Creates a new gRPC client instance for accessing the Textile Buckets API.
   * @param context The context to use for interacting with the APIs. Can be modified later.
   */
  constructor(public context: ContextInterface = new Context(), debug = false) {
    const transport = WebsocketTransport() // Default to websocket always
    this.serviceHost = context.host
    this.rpcOptions = {
      transport,
      debug,
    }
    // Set default transport to websocket "globally"
    grpc.setDefaultTransport(transport)
  }

  public unary<
    R extends grpc.ProtobufMessage,
    T extends grpc.ProtobufMessage,
    M extends grpc.UnaryMethodDefinition<R, T>
  >(methodDescriptor: M, req: R, ctx?: ContextInterface): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const metadata = ctx ? { ...ctx.toJSON() } : { ...this.context.toJSON() }
      grpc.unary(methodDescriptor, {
        request: req,
        host: this.serviceHost,
        transport: this.rpcOptions.transport,
        debug: this.rpcOptions.debug,
        metadata,
        onEnd: (res: grpc.UnaryOutput<T>) => {
          const { status, statusMessage, message } = res
          if (status === grpc.Code.OK) {
            if (message) {
              resolve(message)
            } else {
              resolve()
            }
          } else {
            const err: ServiceError = {
              message: statusMessage,
              code: status,
              metadata,
            }
            reject(err)
          }
        },
      })
    })
  }
}
