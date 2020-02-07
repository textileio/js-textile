const V = -1

export type TableRow = [number, number, string, boolean?, (boolean | string)?]

const _table: TableRow[] = [
  [4, 32, 'ip4'],
  [6, 16, 'tcp'],
  [33, 16, 'dccp'],
  [41, 128, 'ip6'],
  [42, V, 'ip6zone'],
  [53, V, 'dns', true],
  [54, V, 'dns4', true],
  [55, V, 'dns6', true],
  [56, V, 'dnsaddr', true],
  [132, 16, 'sctp'],
  [273, 16, 'udp'],
  [275, 0, 'p2p-webrtc-star'],
  [276, 0, 'p2p-webrtc-direct'],
  [277, 0, 'p2p-stardust'],
  [290, 0, 'p2p-circuit'],
  [301, 0, 'udt'],
  [302, 0, 'utp'],
  [400, V, 'unix', false, 'path'],
  [406, V, 'thread'],
  // `ipfs` is added before `p2p` for legacy support.
  // All text representations will default to `p2p`, but `ipfs` will
  // still be supported
  [421, V, 'ipfs'],
  // `p2p` is the preferred name for 421, and is now the default
  [421, V, 'p2p'],
  [443, 0, 'https'],
  [444, 96, 'onion'],
  [445, 296, 'onion3'],
  [446, V, 'garlic64'],
  [460, 0, 'quic'],
  [477, 0, 'ws'],
  [478, 0, 'wss'],
  [479, 0, 'p2p-websocket-star'],
  [480, 0, 'http'],
]

export interface Protocol {
  code: number
  size: number
  name: string
  resolvable: boolean
  path: boolean
}

function p([code, size, name, resolvable, path]: TableRow): Protocol {
  return {
    code: code,
    size: size,
    name: name,
    resolvable: Boolean(resolvable),
    path: Boolean(path),
  }
}

const _names: Record<string, Protocol> = {}
const _codes: Record<number, Protocol> = {}

// populate tables
_table.forEach(row => {
  const proto = p(row)
  _codes[proto.code] = proto
  _names[proto.name] = proto
})

function Protocols(proto: number | string) {
  if (typeof proto === 'number') {
    if (Protocols.codes[proto]) {
      return Protocols.codes[proto]
    }

    throw new Error('no protocol with code: ' + proto)
  } else if (typeof proto === 'string' || (proto as any) instanceof String) {
    if (Protocols.names[proto]) {
      return Protocols.names[proto]
    }

    throw new Error('no protocol with name: ' + proto)
  }

  throw new Error('invalid protocol id type: ' + proto)
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Protocols {
  export const V = -1
  export const lengthPrefixedVarSize = V
  export const table = _table
  export const codes = _codes
  export const names = _names
  export const object = p
}

export { Protocols as protocols }
