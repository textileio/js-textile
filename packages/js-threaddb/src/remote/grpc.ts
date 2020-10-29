import { grpc } from "@improbable-eng/grpc-web";
import type { ThreadID } from "@textile/threads-id";
import { WebsocketTransport } from "@textile/grpc-transport";
import * as pb from "@textile/threads-client-grpc/threads_pb";
import * as api from "@textile/threads-client-grpc/threads_pb_service";
import { Client, CollectionConfig } from "@textile/threads-client";
import { Context, defaultHost } from "@textile/context";
import { Identity } from "@textile/crypto";

export interface GrpcConfig {
  serviceHost: string;
  transport: grpc.TransportFactory;
  debug: boolean;
  metadata: grpc.Metadata;
}

export { CollectionConfig };

export const defaults: GrpcConfig = {
  serviceHost: defaultHost,
  transport: WebsocketTransport(),
  debug: false,
  metadata: new grpc.Metadata(),
};

export function createClient(opts: Partial<GrpcConfig> = {}): api.APIClient {
  const config = { ...defaults, ...opts };
  return new api.APIClient(config.serviceHost, {
    transport: config.transport,
    debug: config.debug,
  });
}

export function createDbClient(config: Partial<GrpcConfig> = {}): Client {
  // Create a new remote client instance
  // TODO: This is not be the best way to do this...
  // Pull in any existing headers that may have already been set
  const json: Record<string, string[]> = {};
  config.metadata?.forEach((key, values) => (json[key] = values));
  const context =
    Object.keys(json).length > 0
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Context.fromJSON(json, config.serviceHost)
      : new Context(config.serviceHost);
  const client = new Client(context);
  return client;
}

/**
 * Obtain a token per user (identity) for interacting with the remote API.
 * @param identity Complete identity object. Useful in tests or where the
 * developer has complete control over the key generation process.
 * @param opts Options for controlling communication with the remote gRPC
 * endpoint.
 * @example
 * ```@typescript
 * import { grpc } from '@textile/threads'
 *
 * async function example (identity: PrivateKey) {
 *   const token = await grpc.getToken(identity)
 *   return token
 * }
 * ```
 */
export async function getToken(
  identity: Identity,
  config?: Partial<GrpcConfig>
): Promise<string> {
  const opts = { ...defaults, ...config };
  return getTokenChallenge(
    identity.public.toString(),
    async (challenge: Uint8Array) => {
      return identity.sign(challenge);
    },
    opts
  );
}

/**
 * Obtain a token per user (identity) for interacting with the remote API.
 * @param publicKey The public key of a user identity to use for creating
 * records in the database. Must be the corresponding public key of the
 * private key used in `callback`.
 * @param callback A callback function that takes a `challenge` argument and
 * returns a signed message using the input challenge and the private key
 * associated with `publicKey`.
 * @param config Options for controlling communication with the remote gRPC
 * endpoint.
 * @example
 * ```typescript
 * import { grpc } from '@textile/threads'
 *
 * async function example (identity: PrivateKey) {
 *   const token = await grpc.getTokenChallenge(
 *     identity.public.toString(),
 *     (challenge: Uint8Array) => {
 *       return new Promise((resolve, reject) => {
 *         // This is where you should program PrivateKey to respond to challenge
 *         // Read more here: https://docs.textile.io/tutorials/hub/production-auth/
 *       })
 *     }
 *   )
 *   return token
 * }
 * ```
 */
export async function getTokenChallenge(
  publicKey: string,
  callback: (challenge: Uint8Array) => Uint8Array | Promise<Uint8Array>,
  config?: Partial<GrpcConfig>
): Promise<string> {
  const opts = { ...defaults, ...config };
  const client = createClient(opts);
  const bidi = client.getToken(opts.metadata);
  return new Promise<string>((resolve, reject) => {
    let token = "";
    bidi.on("data", async (message: pb.GetTokenReply) => {
      if (message.hasChallenge()) {
        const challenge = message.getChallenge_asU8();
        const signature = await callback(challenge);
        const req = new pb.GetTokenRequest();
        req.setSignature(signature);
        bidi.write(req);
      } else if (message.hasToken()) {
        token = message.getToken();
        bidi.end();
      }
    });
    bidi.on("end", (status) => {
      if (status?.code === grpc.Code.OK) {
        resolve(token);
      } else {
        reject(new Error(status?.details));
      }
    });
    const req = new pb.GetTokenRequest();
    req.setKey(publicKey);
    bidi.write(req);
  });
}

export async function newDB(
  name: string,
  threadID: ThreadID,
  collections: CollectionConfig[],
  config?: Partial<GrpcConfig>
): Promise<string> {
  const opts = { ...defaults, ...config };
  const client = createClient(opts);
  const requestMessage = new pb.NewDBRequest();
  requestMessage.setDbid(threadID.toBytes());
  requestMessage.setName(name);
  const collectionsList: pb.CollectionConfig[] = [];
  for (const collection of collections) {
    const config = new pb.CollectionConfig();
    config.setName(collection.name);
    config.setSchema(collection.schema);
    const indexesList: pb.Index[] = [];
    for (const index of collection.indexes ?? []) {
      const idx = new pb.Index();
      idx.setPath(index.path);
      idx.setUnique(index.unique);
      indexesList.push(idx);
    }
    config.setIndexesList(indexesList);
    collectionsList.push(config);
  }
  requestMessage.setCollectionsList(collectionsList);
  return new Promise<string>((resolve, reject) => {
    client.newDB(
      requestMessage,
      opts.metadata ?? new grpc.Metadata(),
      (
        error: api.ServiceError | null,
        responseMessage: pb.NewDBReply | null
      ) => {
        if (error) reject(new Error(error.message));
        // Should just be an empty object, which we return as a boolean
        const success = Boolean(responseMessage?.toObject());
        const id = threadID.toString();
        if (success) resolve(id);
        else reject(new Error(`Unable to create thread with id = ${id}`));
      }
    );
  });
}
