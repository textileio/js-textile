// package: api.usersd.pb
// file: api/usersd/pb/usersd.proto

import * as jspb from "google-protobuf";

export class ListThreadsRequest extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ListThreadsRequest.AsObject;
  static toObject(includeInstance: boolean, msg: ListThreadsRequest): ListThreadsRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ListThreadsRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ListThreadsRequest;
  static deserializeBinaryFromReader(message: ListThreadsRequest, reader: jspb.BinaryReader): ListThreadsRequest;
}

export namespace ListThreadsRequest {
  export type AsObject = {
  }
}

export class ListThreadsResponse extends jspb.Message {
  clearListList(): void;
  getListList(): Array<GetThreadResponse>;
  setListList(value: Array<GetThreadResponse>): void;
  addList(value?: GetThreadResponse, index?: number): GetThreadResponse;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ListThreadsResponse.AsObject;
  static toObject(includeInstance: boolean, msg: ListThreadsResponse): ListThreadsResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ListThreadsResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ListThreadsResponse;
  static deserializeBinaryFromReader(message: ListThreadsResponse, reader: jspb.BinaryReader): ListThreadsResponse;
}

export namespace ListThreadsResponse {
  export type AsObject = {
    listList: Array<GetThreadResponse.AsObject>,
  }
}

export class GetThreadRequest extends jspb.Message {
  getName(): string;
  setName(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetThreadRequest.AsObject;
  static toObject(includeInstance: boolean, msg: GetThreadRequest): GetThreadRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: GetThreadRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetThreadRequest;
  static deserializeBinaryFromReader(message: GetThreadRequest, reader: jspb.BinaryReader): GetThreadRequest;
}

export namespace GetThreadRequest {
  export type AsObject = {
    name: string,
  }
}

export class GetThreadResponse extends jspb.Message {
  getId(): Uint8Array | string;
  getId_asU8(): Uint8Array;
  getId_asB64(): string;
  setId(value: Uint8Array | string): void;

  getName(): string;
  setName(value: string): void;

  getIsDb(): boolean;
  setIsDb(value: boolean): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetThreadResponse.AsObject;
  static toObject(includeInstance: boolean, msg: GetThreadResponse): GetThreadResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: GetThreadResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetThreadResponse;
  static deserializeBinaryFromReader(message: GetThreadResponse, reader: jspb.BinaryReader): GetThreadResponse;
}

export namespace GetThreadResponse {
  export type AsObject = {
    id: Uint8Array | string,
    name: string,
    isDb: boolean,
  }
}

export class SetupMailboxRequest extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SetupMailboxRequest.AsObject;
  static toObject(includeInstance: boolean, msg: SetupMailboxRequest): SetupMailboxRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SetupMailboxRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SetupMailboxRequest;
  static deserializeBinaryFromReader(message: SetupMailboxRequest, reader: jspb.BinaryReader): SetupMailboxRequest;
}

export namespace SetupMailboxRequest {
  export type AsObject = {
  }
}

export class SetupMailboxResponse extends jspb.Message {
  getMailboxId(): Uint8Array | string;
  getMailboxId_asU8(): Uint8Array;
  getMailboxId_asB64(): string;
  setMailboxId(value: Uint8Array | string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SetupMailboxResponse.AsObject;
  static toObject(includeInstance: boolean, msg: SetupMailboxResponse): SetupMailboxResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SetupMailboxResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SetupMailboxResponse;
  static deserializeBinaryFromReader(message: SetupMailboxResponse, reader: jspb.BinaryReader): SetupMailboxResponse;
}

export namespace SetupMailboxResponse {
  export type AsObject = {
    mailboxId: Uint8Array | string,
  }
}

export class Message extends jspb.Message {
  getId(): string;
  setId(value: string): void;

  getFrom(): string;
  setFrom(value: string): void;

  getTo(): string;
  setTo(value: string): void;

  getBody(): Uint8Array | string;
  getBody_asU8(): Uint8Array;
  getBody_asB64(): string;
  setBody(value: Uint8Array | string): void;

  getSignature(): Uint8Array | string;
  getSignature_asU8(): Uint8Array;
  getSignature_asB64(): string;
  setSignature(value: Uint8Array | string): void;

  getCreatedAt(): number;
  setCreatedAt(value: number): void;

  getReadAt(): number;
  setReadAt(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Message.AsObject;
  static toObject(includeInstance: boolean, msg: Message): Message.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Message, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Message;
  static deserializeBinaryFromReader(message: Message, reader: jspb.BinaryReader): Message;
}

export namespace Message {
  export type AsObject = {
    id: string,
    from: string,
    to: string,
    body: Uint8Array | string,
    signature: Uint8Array | string,
    createdAt: number,
    readAt: number,
  }
}

export class SendMessageRequest extends jspb.Message {
  getTo(): string;
  setTo(value: string): void;

  getToBody(): Uint8Array | string;
  getToBody_asU8(): Uint8Array;
  getToBody_asB64(): string;
  setToBody(value: Uint8Array | string): void;

  getToSignature(): Uint8Array | string;
  getToSignature_asU8(): Uint8Array;
  getToSignature_asB64(): string;
  setToSignature(value: Uint8Array | string): void;

  getFromBody(): Uint8Array | string;
  getFromBody_asU8(): Uint8Array;
  getFromBody_asB64(): string;
  setFromBody(value: Uint8Array | string): void;

  getFromSignature(): Uint8Array | string;
  getFromSignature_asU8(): Uint8Array;
  getFromSignature_asB64(): string;
  setFromSignature(value: Uint8Array | string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SendMessageRequest.AsObject;
  static toObject(includeInstance: boolean, msg: SendMessageRequest): SendMessageRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SendMessageRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SendMessageRequest;
  static deserializeBinaryFromReader(message: SendMessageRequest, reader: jspb.BinaryReader): SendMessageRequest;
}

export namespace SendMessageRequest {
  export type AsObject = {
    to: string,
    toBody: Uint8Array | string,
    toSignature: Uint8Array | string,
    fromBody: Uint8Array | string,
    fromSignature: Uint8Array | string,
  }
}

export class SendMessageResponse extends jspb.Message {
  getId(): string;
  setId(value: string): void;

  getCreatedAt(): number;
  setCreatedAt(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SendMessageResponse.AsObject;
  static toObject(includeInstance: boolean, msg: SendMessageResponse): SendMessageResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SendMessageResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SendMessageResponse;
  static deserializeBinaryFromReader(message: SendMessageResponse, reader: jspb.BinaryReader): SendMessageResponse;
}

export namespace SendMessageResponse {
  export type AsObject = {
    id: string,
    createdAt: number,
  }
}

export class ListInboxMessagesRequest extends jspb.Message {
  getSeek(): string;
  setSeek(value: string): void;

  getLimit(): number;
  setLimit(value: number): void;

  getAscending(): boolean;
  setAscending(value: boolean): void;

  getStatus(): ListInboxMessagesRequest.StatusMap[keyof ListInboxMessagesRequest.StatusMap];
  setStatus(value: ListInboxMessagesRequest.StatusMap[keyof ListInboxMessagesRequest.StatusMap]): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ListInboxMessagesRequest.AsObject;
  static toObject(includeInstance: boolean, msg: ListInboxMessagesRequest): ListInboxMessagesRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ListInboxMessagesRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ListInboxMessagesRequest;
  static deserializeBinaryFromReader(message: ListInboxMessagesRequest, reader: jspb.BinaryReader): ListInboxMessagesRequest;
}

export namespace ListInboxMessagesRequest {
  export type AsObject = {
    seek: string,
    limit: number,
    ascending: boolean,
    status: ListInboxMessagesRequest.StatusMap[keyof ListInboxMessagesRequest.StatusMap],
  }

  export interface StatusMap {
    STATUS_UNSPECIFIED: 0;
    STATUS_ALL: 1;
    STATUS_READ: 2;
    STATUS_UNREAD: 3;
  }

  export const Status: StatusMap;
}

export class ListInboxMessagesResponse extends jspb.Message {
  clearMessagesList(): void;
  getMessagesList(): Array<Message>;
  setMessagesList(value: Array<Message>): void;
  addMessages(value?: Message, index?: number): Message;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ListInboxMessagesResponse.AsObject;
  static toObject(includeInstance: boolean, msg: ListInboxMessagesResponse): ListInboxMessagesResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ListInboxMessagesResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ListInboxMessagesResponse;
  static deserializeBinaryFromReader(message: ListInboxMessagesResponse, reader: jspb.BinaryReader): ListInboxMessagesResponse;
}

export namespace ListInboxMessagesResponse {
  export type AsObject = {
    messagesList: Array<Message.AsObject>,
  }
}

export class ListSentboxMessagesRequest extends jspb.Message {
  getSeek(): string;
  setSeek(value: string): void;

  getLimit(): number;
  setLimit(value: number): void;

  getAscending(): boolean;
  setAscending(value: boolean): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ListSentboxMessagesRequest.AsObject;
  static toObject(includeInstance: boolean, msg: ListSentboxMessagesRequest): ListSentboxMessagesRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ListSentboxMessagesRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ListSentboxMessagesRequest;
  static deserializeBinaryFromReader(message: ListSentboxMessagesRequest, reader: jspb.BinaryReader): ListSentboxMessagesRequest;
}

export namespace ListSentboxMessagesRequest {
  export type AsObject = {
    seek: string,
    limit: number,
    ascending: boolean,
  }
}

export class ListSentboxMessagesResponse extends jspb.Message {
  clearMessagesList(): void;
  getMessagesList(): Array<Message>;
  setMessagesList(value: Array<Message>): void;
  addMessages(value?: Message, index?: number): Message;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ListSentboxMessagesResponse.AsObject;
  static toObject(includeInstance: boolean, msg: ListSentboxMessagesResponse): ListSentboxMessagesResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ListSentboxMessagesResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ListSentboxMessagesResponse;
  static deserializeBinaryFromReader(message: ListSentboxMessagesResponse, reader: jspb.BinaryReader): ListSentboxMessagesResponse;
}

export namespace ListSentboxMessagesResponse {
  export type AsObject = {
    messagesList: Array<Message.AsObject>,
  }
}

export class ReadInboxMessageRequest extends jspb.Message {
  getId(): string;
  setId(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ReadInboxMessageRequest.AsObject;
  static toObject(includeInstance: boolean, msg: ReadInboxMessageRequest): ReadInboxMessageRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ReadInboxMessageRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ReadInboxMessageRequest;
  static deserializeBinaryFromReader(message: ReadInboxMessageRequest, reader: jspb.BinaryReader): ReadInboxMessageRequest;
}

export namespace ReadInboxMessageRequest {
  export type AsObject = {
    id: string,
  }
}

export class ReadInboxMessageResponse extends jspb.Message {
  getReadAt(): number;
  setReadAt(value: number): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ReadInboxMessageResponse.AsObject;
  static toObject(includeInstance: boolean, msg: ReadInboxMessageResponse): ReadInboxMessageResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ReadInboxMessageResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ReadInboxMessageResponse;
  static deserializeBinaryFromReader(message: ReadInboxMessageResponse, reader: jspb.BinaryReader): ReadInboxMessageResponse;
}

export namespace ReadInboxMessageResponse {
  export type AsObject = {
    readAt: number,
  }
}

export class DeleteInboxMessageRequest extends jspb.Message {
  getId(): string;
  setId(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): DeleteInboxMessageRequest.AsObject;
  static toObject(includeInstance: boolean, msg: DeleteInboxMessageRequest): DeleteInboxMessageRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: DeleteInboxMessageRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): DeleteInboxMessageRequest;
  static deserializeBinaryFromReader(message: DeleteInboxMessageRequest, reader: jspb.BinaryReader): DeleteInboxMessageRequest;
}

export namespace DeleteInboxMessageRequest {
  export type AsObject = {
    id: string,
  }
}

export class DeleteInboxMessageResponse extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): DeleteInboxMessageResponse.AsObject;
  static toObject(includeInstance: boolean, msg: DeleteInboxMessageResponse): DeleteInboxMessageResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: DeleteInboxMessageResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): DeleteInboxMessageResponse;
  static deserializeBinaryFromReader(message: DeleteInboxMessageResponse, reader: jspb.BinaryReader): DeleteInboxMessageResponse;
}

export namespace DeleteInboxMessageResponse {
  export type AsObject = {
  }
}

export class DeleteSentboxMessageRequest extends jspb.Message {
  getId(): string;
  setId(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): DeleteSentboxMessageRequest.AsObject;
  static toObject(includeInstance: boolean, msg: DeleteSentboxMessageRequest): DeleteSentboxMessageRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: DeleteSentboxMessageRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): DeleteSentboxMessageRequest;
  static deserializeBinaryFromReader(message: DeleteSentboxMessageRequest, reader: jspb.BinaryReader): DeleteSentboxMessageRequest;
}

export namespace DeleteSentboxMessageRequest {
  export type AsObject = {
    id: string,
  }
}

export class DeleteSentboxMessageResponse extends jspb.Message {
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): DeleteSentboxMessageResponse.AsObject;
  static toObject(includeInstance: boolean, msg: DeleteSentboxMessageResponse): DeleteSentboxMessageResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: DeleteSentboxMessageResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): DeleteSentboxMessageResponse;
  static deserializeBinaryFromReader(message: DeleteSentboxMessageResponse, reader: jspb.BinaryReader): DeleteSentboxMessageResponse;
}

export namespace DeleteSentboxMessageResponse {
  export type AsObject = {
  }
}

export class GetUsageRequest extends jspb.Message {
  getKey(): string;
  setKey(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetUsageRequest.AsObject;
  static toObject(includeInstance: boolean, msg: GetUsageRequest): GetUsageRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: GetUsageRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetUsageRequest;
  static deserializeBinaryFromReader(message: GetUsageRequest, reader: jspb.BinaryReader): GetUsageRequest;
}

export namespace GetUsageRequest {
  export type AsObject = {
    key: string,
  }
}

export class GetUsageResponse extends jspb.Message {
  hasCustomer(): boolean;
  clearCustomer(): void;

  hasUsage(): boolean;
  clearUsage(): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): GetUsageResponse.AsObject;
  static toObject(includeInstance: boolean, msg: GetUsageResponse): GetUsageResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: GetUsageResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): GetUsageResponse;
  static deserializeBinaryFromReader(message: GetUsageResponse, reader: jspb.BinaryReader): GetUsageResponse;
}
