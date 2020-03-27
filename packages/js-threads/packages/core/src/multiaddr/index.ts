import varint from 'varint'
import CID from 'cids'
import bs58 from 'bs58'
import { protocols } from './protocols'
import * as codec from './codec'

/**
 * Creates a [multiaddr](https://github.com/multiformats/multiaddr) from
 * a Buffer, String or another Multiaddr instance
 * public key.
 * @class Multiaddr
 * @param {(String|Buffer|Multiaddr)} addr - If String or Buffer, needs to adhere
 * to the address format of a [multiaddr](https://github.com/multiformats/multiaddr#string-format)
 * @example
 * Multiaddr('/ip4/127.0.0.1/tcp/4001')
 * // <Multiaddr 047f000001060fa1 - /ip4/127.0.0.1/tcp/4001>
 */
export class Multiaddr {
  public buffer: Buffer = Buffer.alloc(0)
  constructor(addr: string | Multiaddr | Buffer) {
    if (!(this instanceof Multiaddr)) {
      return new Multiaddr(addr)
    }

    // default
    if (addr == null) {
      addr = ''
    }

    if (addr instanceof Buffer) {
      /**
       * @type {Buffer} - The raw bytes representing this multiaddress
       */
      this.buffer = codec.fromBuffer(addr)
    } else if (typeof addr === 'string' || addr instanceof String) {
      if (addr.length > 0 && addr.charAt(0) !== '/') {
        throw new Error(`multiaddr "${addr}" must start with a "/"`)
      }
      this.buffer = codec.fromString(addr as string)
    } else if (addr.buffer && addr.protos && addr.protoCodes) {
      // Multiaddr
      this.buffer = codec.fromBuffer(addr.buffer) // validate + copy buffer
    } else {
      throw new Error('addr must be a string, Buffer, or another Multiaddr')
    }
  }

  /**
   * Returns Multiaddr as a String
   *
   * @example
   * Multiaddr('/ip4/127.0.0.1/tcp/4001').toString()
   * // '/ip4/127.0.0.1/tcp/4001'
   */
  toString() {
    return codec.bufferToString(this.buffer)
  }

  /**
   * Returns Multiaddr as a JSON encoded object
   *
   * @example
   * JSON.stringify(Multiaddr('/ip4/127.0.0.1/tcp/4001'))
   * // '/ip4/127.0.0.1/tcp/4001'
   */
  toJSON = this.toString

  /**
   * Returns Multiaddr as a convenient options object to be used with net.createConnection
   *
   * @example
   * Multiaddr('/ip4/127.0.0.1/tcp/4001').toOptions()
   * // { family: 'ipv4', host: '127.0.0.1', transport: 'tcp', port: 4001 }
   */
  toOptions() {
    const opts: any = {}
    const parsed = this.toString().split('/')
    opts.family = parsed[1] === 'ip4' ? 'ipv4' : 'ipv6'
    opts.host = parsed[2]
    opts.transport = parsed[3]
    opts.port = parseInt(parsed[4])
    return opts
  }

  /**
   * Returns Multiaddr as a human-readable string
   *
   * @example
   * Multiaddr('/ip4/127.0.0.1/tcp/4001').inspect()
   * // '<Multiaddr 047f000001060fa1 - /ip4/127.0.0.1/tcp/4001>'
   */
  inspect() {
    return (
      '<Multiaddr ' + this.buffer.toString('hex') + ' - ' + codec.bufferToString(this.buffer) + '>'
    )
  }

  /**
   * Returns the protocols the Multiaddr is defined with, as an array of objects, in
   * left-to-right order. Each object contains the protocol code, protocol name,
   * and the size of its address space in bits.
   * [See list of protocols](https://github.com/multiformats/multiaddr/blob/master/protocols.csv)
   *
   * @example
   * Multiaddr('/ip4/127.0.0.1/tcp/4001').protos()
   * // [ { code: 4, size: 32, name: 'ip4' },
   * //   { code: 6, size: 16, name: 'tcp' } ]
   */
  protos() {
    return this.protoCodes().map(code => Object.assign({}, protocols(code)))
  }

  /**
   * Returns the codes of the protocols in left-to-right order.
   * [See list of protocols](https://github.com/multiformats/multiaddr/blob/master/protocols.csv)
   *
   * @example
   * Multiaddr('/ip4/127.0.0.1/tcp/4001').protoCodes()
   * // [ 4, 6 ]
   */
  protoCodes() {
    const codes = []
    const buf = this.buffer
    let i = 0
    while (i < buf.length) {
      const code = varint.decode(buf, i)
      const n = varint.decode.bytes

      const p = protocols(code)
      const size = codec.sizeForAddr(p, buf.slice(i + n))

      i += size + n
      codes.push(code)
    }

    return codes
  }

  /**
   * Returns the names of the protocols in left-to-right order.
   * [See list of protocols](https://github.com/multiformats/multiaddr/blob/master/protocols.csv)
   *
   * @example
   * Multiaddr('/ip4/127.0.0.1/tcp/4001').protoNames()
   * // [ 'ip4', 'tcp' ]
   */
  protoNames() {
    return this.protos().map(proto => proto.name)
  }

  /**
   * Returns a tuple of parts
   *
   * @example
   * Multiaddr("/ip4/127.0.0.1/tcp/4001").tuples()
   * // [ [ 4, <Buffer 7f 00 00 01> ], [ 6, <Buffer 0f a1> ] ]
   */
  tuples() {
    return codec.bufferToTuples(this.buffer)
  }

  /**
   * Returns a tuple of string/number parts
   *
   * @example
   * Multiaddr("/ip4/127.0.0.1/tcp/4001").stringTuples()
   * // [ [ 4, '127.0.0.1' ], [ 6, 4001 ] ]
   */
  stringTuples() {
    const t = codec.bufferToTuples(this.buffer)
    return codec.tuplesToStringTuples(t)
  }

  /**
   * Encapsulates a Multiaddr in another Multiaddr
   *
   * @example
   * const mh1 = Multiaddr('/ip4/8.8.8.8/tcp/1080')
   * // <Multiaddr 0408080808060438 - /ip4/8.8.8.8/tcp/1080>
   *
   * const mh2 = Multiaddr('/ip4/127.0.0.1/tcp/4001')
   * // <Multiaddr 047f000001060fa1 - /ip4/127.0.0.1/tcp/4001>
   *
   * const mh3 = mh1.encapsulate(mh2)
   * // <Multiaddr 0408080808060438047f000001060fa1 - /ip4/8.8.8.8/tcp/1080/ip4/127.0.0.1/tcp/4001>
   *
   * mh3.toString()
   * // '/ip4/8.8.8.8/tcp/1080/ip4/127.0.0.1/tcp/4001'
   */
  encapsulate(addr: Multiaddr) {
    addr = new Multiaddr(addr)
    return new Multiaddr(this.toString() + addr.toString())
  }

  /**
   * Decapsulates a Multiaddr from another Multiaddr
   *
   * @example
   * const mh1 = Multiaddr('/ip4/8.8.8.8/tcp/1080')
   * // <Multiaddr 0408080808060438 - /ip4/8.8.8.8/tcp/1080>
   *
   * const mh2 = Multiaddr('/ip4/127.0.0.1/tcp/4001')
   * // <Multiaddr 047f000001060fa1 - /ip4/127.0.0.1/tcp/4001>
   *
   * const mh3 = mh1.encapsulate(mh2)
   * // <Multiaddr 0408080808060438047f000001060fa1 - /ip4/8.8.8.8/tcp/1080/ip4/127.0.0.1/tcp/4001>
   *
   * mh3.decapsulate(mh2).toString()
   * // '/ip4/8.8.8.8/tcp/1080'
   */
  decapsulate(addr: Multiaddr) {
    const str = addr.toString()
    const s = this.toString()
    const i = s.lastIndexOf(str)
    if (i < 0) {
      throw new Error('Address ' + this + ' does not contain subaddress: ' + addr)
    }
    return new Multiaddr(s.slice(0, i))
  }

  /**
   * A more reliable version of `decapsulate` if you are targeting a
   * specific code, such as 421 (the `p2p` protocol code). The last index of the code
   * will be removed from the `Multiaddr`, and a new instance will be returned.
   * If the code is not present, the original `Multiaddr` is returned.
   *
   * @example
   * const addr = Multiaddr('/ip4/0.0.0.0/tcp/8080/p2p/QmcgpsyWgH8Y8ajJz1Cu72KnS5uo2Aa2LpzU7kinSupNKC')
   * // <Multiaddr 0400... - /ip4/0.0.0.0/tcp/8080/p2p/QmcgpsyWgH8Y8ajJz1Cu72KnS5uo2Aa2LpzU7kinSupNKC>
   *
   * addr.decapsulateCode(421).toString()
   * // '/ip4/0.0.0.0/tcp/8080'
   *
   * Multiaddr('/ip4/127.0.0.1/tcp/8080').decapsulateCode(421).toString()
   * // '/ip4/127.0.0.1/tcp/8080'
   */
  decapsulateCode(code: number) {
    const tuples = this.tuples()
    for (let i = tuples.length - 1; i >= 0; i--) {
      if (tuples[i][0] === code) {
        return new Multiaddr(codec.tuplesToBuffer(tuples.slice(0, i)))
      }
    }
    return this
  }

  /**
   * Extract the peerId if the multiaddr contains one
   *
   * @example
   * const mh1 = Multiaddr('/ip4/8.8.8.8/tcp/1080/ipfs/QmValidBase58string')
   * // <Multiaddr 0408080808060438 - /ip4/8.8.8.8/tcp/1080/ipfs/QmValidBase58string>
   *
   * // should return QmValidBase58string or null if the id is missing or invalid
   * const peerId = mh1.getPeerId()
   */
  getPeerId() {
    let b58str: string | undefined
    try {
      const tuples = this.stringTuples().filter((tuple: any) => {
        if (tuple[0] === protocols.names.ipfs.code) {
          return true
        }
      })

      // Get the last id
      b58str = (tuples.pop() || [])[1]
      // Get multihash, unwrap from CID if needed
      b58str = bs58.encode(new CID(b58str || '').multihash)
    } catch (e) {
      b58str = undefined
    }

    return b58str
  }

  /**
   * Extract the path if the multiaddr contains one
   *
   * @example
   * const mh1 = Multiaddr('/ip4/8.8.8.8/tcp/1080/unix/tmp/p2p.sock')
   * // <Multiaddr 0408080808060438 - /ip4/8.8.8.8/tcp/1080/unix/tmp/p2p.sock>
   *
   * // should return utf8 string or null if the id is missing or invalid
   * const path = mh1.getPath()
   */
  getPath() {
    let path = null
    try {
      path = this.stringTuples().filter((tuple: any) => {
        const proto = protocols(tuple[0])
        if (proto.path) {
          return true
        }
      })[0][1]
    } catch (e) {
      path = null
    }

    return path
  }

  /**
   * Checks if two Multiaddrs are the same
   *
   * @example
   * const mh1 = Multiaddr('/ip4/8.8.8.8/tcp/1080')
   * // <Multiaddr 0408080808060438 - /ip4/8.8.8.8/tcp/1080>
   *
   * const mh2 = Multiaddr('/ip4/127.0.0.1/tcp/4001')
   * // <Multiaddr 047f000001060fa1 - /ip4/127.0.0.1/tcp/4001>
   *
   * mh1.equals(mh1)
   * // true
   *
   * mh1.equals(mh2)
   * // false
   */
  equals(addr: Multiaddr) {
    return this.buffer.equals(addr.buffer)
  }

  /**
   * Gets a Multiaddrs node-friendly address object. Note that protocol information
   * is left out: in Node (and most network systems) the protocol is unknowable
   * given only the address.
   *
   * Has to be a ThinWaist Address, otherwise throws error
   *
   * @example
   * Multiaddr('/ip4/127.0.0.1/tcp/4001').nodeAddress()
   * // {family: 'IPv4', address: '127.0.0.1', port: '4001'}
   */
  nodeAddress() {
    const codes = this.protoCodes()
    const names = this.protoNames()
    const parts = this.toString()
      .split('/')
      .slice(1)

    if (parts.length < 4) {
      throw new Error(
        'multiaddr must have a valid format: "/{ip4, ip6, dns4, dns6}/{address}/{tcp, udp}/{port}".',
      )
    } else if (codes[0] !== 4 && codes[0] !== 41 && codes[0] !== 54 && codes[0] !== 55) {
      throw new Error(
        `no protocol with name: "'${names[0]}'". Must have a valid family name: "{ip4, ip6, dns4, dns6}".`,
      )
    } else if (parts[2] !== 'tcp' && parts[2] !== 'udp') {
      throw new Error(
        `no protocol with name: "'${names[1]}'". Must have a valid transport protocol: "{tcp, udp}".`,
      )
    }

    return {
      family: codes[0] === 41 || codes[0] === 55 ? 6 : 4,
      address: parts[1], // ip addr
      port: parseInt(parts[3]), // tcp or udp port
    }
  }

  /**
   * Creates a Multiaddr from a node-friendly address object
   *
   * @example
   * Multiaddr.fromNodeAddress({address: '127.0.0.1', port: '4001'}, 'tcp')
   * // <Multiaddr 047f000001060fa1 - /ip4/127.0.0.1/tcp/4001>
   */
  static fromNodeAddress(addr: any, transport: string) {
    if (!addr) throw new Error('requires node address object')
    if (!transport) throw new Error('requires transport protocol')
    const ip = addr.family === 'IPv6' ? 'ip6' : 'ip4'
    return new Multiaddr('/' + [ip, addr.address, transport, addr.port].join('/'))
  }

  /**
   * Returns if a Multiaddr is a Thin Waist address or not.
   *
   * Thin Waist is if a Multiaddr adheres to the standard combination of:
   *
   * `{IPv4, IPv6}/{TCP, UDP}`
   *
   * @example
   * const mh1 = Multiaddr('/ip4/127.0.0.1/tcp/4001')
   * // <Multiaddr 047f000001060fa1 - /ip4/127.0.0.1/tcp/4001>
   * const mh2 = Multiaddr('/ip4/192.168.2.1/tcp/5001')
   * // <Multiaddr 04c0a80201061389 - /ip4/192.168.2.1/tcp/5001>
   * const mh3 = mh1.encapsulate(mh2)
   * // <Multiaddr 047f000001060fa104c0a80201061389 - /ip4/127.0.0.1/tcp/4001/ip4/192.168.2.1/tcp/5001>
   * mh1.isThinWaistAddress()
   * // true
   * mh2.isThinWaistAddress()
   * // true
   * mh3.isThinWaistAddress()
   * // false
   */
  static isThinWaistAddress(addr: Multiaddr) {
    const protos = (addr || this).protos()

    if (protos.length !== 2) {
      return false
    }

    if (protos[0].code !== 4 && protos[0].code !== 41) {
      return false
    }
    return !(protos[1].code !== 6 && protos[1].code !== 273)
  }

  /**
   * Object containing table, names and codes of all supported protocols.
   * To get the protocol values from a Multiaddr, you can use
   * [`.protos()`](#multiaddrprotos),
   * [`.protoCodes()`](#multiaddrprotocodes) or
   * [`.protoNames()`](#multiaddrprotonames)
   */
  static protocols = protocols

  /**
   * Returns if something is a Multiaddr that is a name
   */
  static isName(addr: Multiaddr) {
    if (!Multiaddr.isMultiaddr(addr)) {
      return false
    }

    // if a part of the multiaddr is resolvable, then return true
    return addr.protos().some(proto => proto.resolvable)
  }

  /**
   * Returns an array of multiaddrs, by resolving the multiaddr that is a name
   */
  static resolve(addr: Multiaddr) {
    if (!Multiaddr.isMultiaddr(addr) || !Multiaddr.isName(addr)) {
      return Promise.reject(Error('not a valid name'))
    }

    /*
     * Needs more consideration from spec design:
     *   - what to return
     *   - how to achieve it in the browser?
     */
    return Promise.reject(new Error('not implemented yet'))
  }

  static isMultiaddr(other: any) {
    return other
  }
}
