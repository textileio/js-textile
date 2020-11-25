// Copyright improbable-eng Apache License 2.0
// https://github.com/improbable-eng/grpc-web/blob/master/client/grpc-web/src/transports/websocket/websocket.ts
import { grpc } from "@improbable-eng/grpc-web"
import WebSocket from "isomorphic-ws"
import log from "loglevel"

const { debug } = log.getLogger("grpc-transport")

const isAllowedControlChars = (char: number) =>
  char === 0x9 || char === 0xa || char === 0xd

function isValidHeaderAscii(val: number): boolean {
  return isAllowedControlChars(val) || (val >= 0x20 && val <= 0x7e)
}

function encodeASCII(input: string): Uint8Array {
  const encoded = new Uint8Array(input.length)
  for (let i = 0; i !== input.length; ++i) {
    const charCode = input.charCodeAt(i)
    if (!isValidHeaderAscii(charCode)) {
      throw new Error("Metadata contains invalid ASCII")
    }
    encoded[i] = charCode
  }
  return encoded
}

enum WebsocketSignal {
  FINISH_SEND = 1,
}

const finishSendFrame = new Uint8Array([1])

function constructWebSocketAddress(url: string) {
  if (url.substr(0, 8) === "https://") {
    return `wss://${url.substr(8)}`
  } else if (url.substr(0, 7) === "http://") {
    return `ws://${url.substr(7)}`
  }
  throw new Error(
    "Websocket transport constructed with non-https:// or http:// host."
  )
}

function headersToBytes(headers: grpc.Metadata): Uint8Array {
  let asString = ""
  headers.forEach((key, values) => {
    asString += `${key}: ${values.join(", ")}\r\n`
  })
  return encodeASCII(asString)
}

function websocketRequest(options: grpc.TransportOptions): grpc.Transport {
  options.debug && debug("websocketRequest", options)

  const webSocketAddress = constructWebSocketAddress(options.url)

  const sendQueue: Array<Uint8Array | WebsocketSignal> = []
  let ws: WebSocket

  function sendToWebsocket(toSend: Uint8Array | WebsocketSignal) {
    if (toSend === WebsocketSignal.FINISH_SEND) {
      ws.send(finishSendFrame)
    } else {
      const byteArray = toSend as Uint8Array
      const c = new Int8Array(byteArray.byteLength + 1)
      c.set(new Uint8Array([0]))

      c.set((byteArray as any) as ArrayLike<number>, 1)

      ws.send(c)
    }
  }

  return {
    sendMessage: (msgBytes: Uint8Array) => {
      if (!ws || ws.readyState === ws.CONNECTING) {
        sendQueue.push(msgBytes)
      } else {
        sendToWebsocket(msgBytes)
      }
    },
    finishSend: () => {
      if (!ws || ws.readyState === ws.CONNECTING) {
        sendQueue.push(WebsocketSignal.FINISH_SEND)
      } else {
        sendToWebsocket(WebsocketSignal.FINISH_SEND)
      }
    },
    start: (metadata: grpc.Metadata) => {
      ws = new WebSocket(webSocketAddress, ["grpc-websockets"])
      ws.binaryType = "arraybuffer"
      ws.onopen = function () {
        options.debug && debug("websocketRequest.onopen")
        ws.send(headersToBytes(metadata))

        // send any messages that were passed to sendMessage before the connection was ready
        sendQueue.forEach((toSend) => {
          sendToWebsocket(toSend)
        })
      }

      ws.onclose = function (closeEvent) {
        options.debug && debug("websocketRequest.onclose", closeEvent)
        options.onEnd()
      }

      ws.onerror = function (error) {
        options.debug && debug("websocketRequest.onerror", error)
      }

      ws.onmessage = function (e) {
        options.onChunk(new Uint8Array(e.data as Iterable<number>))
      }
    },
    cancel: () => {
      options.debug && debug("websocket.abort")
      ws.close()
    },
  }
}

export function WebsocketTransport(): grpc.TransportFactory {
  return (opts: grpc.TransportOptions) => {
    return websocketRequest(opts)
  }
}
