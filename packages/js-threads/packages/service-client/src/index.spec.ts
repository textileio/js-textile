/* eslint-disable import/first */
// Some hackery to get WebSocket in the global namespace on nodejs
;(global as any).WebSocket = require('isomorphic-ws')

// Run two threads daemons:
// go run threadsd/main.go -repo ".threads1"
// go run threadsd/main.go -hostAddr "/ip4/0.0.0.0/tcp/4007" -serviceApiProxyAddr "/ip4/127.0.0.1/tcp/5008" -repo ".threads2" -apiProxyAddr "/ip4/127.0.0.1/tcp/6008" -apiAddr "/ip4/127.0.0.1/tcp/6009" -serviceApiAddr "/ip4/127.0.0.1/tcp/5009"

import { randomBytes } from 'libp2p-crypto'
import { expect } from 'chai'
import PeerId from 'peer-id'
import { keys } from 'libp2p-crypto'
import delay from 'delay'
import { ThreadID, Variant, ThreadInfo, ThreadProtocol, Block, ThreadRecord } from '@textile/threads-core'
import { createEvent, createRecord } from '@textile/threads-encoding'
import Multiaddr from 'multiaddr'
import { Client } from '.'

const hostAddrPort = 4006
const proxyAddr = 'http://127.0.0.1:5107'
const ed25519 = keys.supportedKeys.ed25519

// const protocol = {
//   code: ThreadProtocol.code,
//   name: ThreadProtocol.name,
//   resolvable: false,
//   size: -1,
//   path: false,
// }

// Multiaddr.protocols.names[ThreadProtocol.name] = protocol
// Multiaddr.protocols.codes[ThreadProtocol.code] = protocol

async function createThread(client: Client) {
  const id = ThreadID.fromRandom(Variant.Raw, 32)
  const replicatorKey = randomBytes(44)
  const readKey = randomBytes(44)
  const info = await client.createThread(id, { replicatorKey, readKey })
  return info
}

function threadAddr(hostAddr: Multiaddr, hostID: PeerId, info: ThreadInfo) {
  const pa = new Multiaddr(`/p2p/${hostID.toB58String()}`)
  // todo: Figure out how to represent a custom multiaddr
  const ta = new Multiaddr(`/unix/${ThreadProtocol.name}/${info.id.string()}`)
  const full = hostAddr.encapsulate(pa.encapsulate(ta)) as any
  return full
}

describe('Service Client...', () => {
  let client: Client
  before(() => {
    client = new Client(proxyAddr)
  })
  describe('Basic...', () => {
    it('should return a remote host peer id', async () => {
      const id = await client.getHostID()
      expect(id).to.be.instanceOf(PeerId)
      expect(PeerId.isPeerId(id)).to.be.true
    })

    it('should create a remote thread', async () => {
      const id = ThreadID.fromRandom(Variant.Raw, 32)
      const replicatorKey = randomBytes(44)
      const readKey = randomBytes(44)
      const info = await client.createThread(id, { replicatorKey, readKey })
      expect(info.id.string()).to.equal(id.string())
      expect(info.readKey).to.not.be.undefined
      expect(info.replicatorKey).to.not.be.undefined
    })

    it.skip('should add a remote thread', async () => {
      const hostID = await client.getHostID()
      const info1 = await createThread(client)
      const hostAddr = new Multiaddr(`/ip4/127.0.0.1/tcp/${hostAddrPort}`)
      const addr = threadAddr(hostAddr, hostID, info1)
      const client2 = new Client('http://127.0.0.1:5008')
      const info2 = await client2.addThread(addr, { ...info1 })
      expect(info2.id.string()).to.equal(info1.id.string())
    })

    it('should add and then get a remote thread', async () => {
      const info1 = await createThread(client)
      const info2 = await client.getThread(info1.id)
      expect(info2.id.string()).to.equal(info1.id.string())
    })

    it('should pull a thread for records', async () => {
      const info = await createThread(client)
      try {
        await client.pullThread(info.id)
      } catch (err) {
        throw new Error(`unexpected error: ${err}`)
      }
    })

    it.skip('should delete an existing thread', async () => {
      const info = await createThread(client)
      try {
        await client.deleteThread(info.id)
      } catch (err) {
        throw new Error(`unexpected error: ${err}`)
      }
    })

    it('should add a replicator to a thread', async () => {
      const client2 = new Client('http://127.0.0.1:5207')
      const hostID2 = await client2.getHostID()
      const hostAddr2 = new Multiaddr(`/dns4/threads2/tcp/4006`)

      const info1 = await createThread(client)

      const peerAddr = hostAddr2.encapsulate(new Multiaddr(`/p2p/${hostID2}`))

      const pid = await client.addReplicator(info1.id, peerAddr)
      expect(pid.toB58String()).to.equal(hostID2.toB58String())
    })

    it('should create a new record', async () => {
      const info = await createThread(client)
      const body = { foo: 'bar', baz: Buffer.from('howdy') }
      const rec = await client.createRecord(info.id, body)
      expect(rec?.threadID.string()).to.equal(info.id.string())
      expect(rec?.logID).to.not.be.undefined
      if (rec?.record) {
        const block = rec.record.block
        expect(block).to.have.ownProperty('body')
      } else {
        throw new Error('expected record to be defined')
      }
    })

    it('should be able to add a pre-formed record', async () => {
      // Create a thread, keeping read key and log private key on the client
      const id = ThreadID.fromRandom(Variant.Raw, 32)
      const replicatorKey = randomBytes(44)
      const privKey = await ed25519.generateKeyPair()
      const logKey = privKey.public
      const info = await client.createThread(id, { replicatorKey, logKey })

      const body = { foo: 'bar', baz: Buffer.from('howdy') }
      const readKey = randomBytes(44)
      const block = Block.encoder(body, 'dag-cbor')
      const event = await createEvent(block, readKey)
      const record = await createRecord(event, privKey, undefined, replicatorKey)
      const cid1 = await record.value.cid()
      const logID = await PeerId.createFromPubKey(privKey.public.bytes)
      await client.addRecord(info.id, logID, record)
      const record2 = await client.getRecord(info.id, cid1)
      if (!record2) {
        throw new Error('expected record to be defined')
      }
      const cid2 = await record2.value.cid()
      expect(cid1.toString()).to.equal(cid2.toString())
      const b1 = await record.block.value.cid()
      const b2 = await record2.block.value.cid()
      expect(b1.toString()).to.equal(b2.toString())
    })

    it('should be able to retrieve a remote record', async () => {
      const info = await createThread(client)
      const body = { foo: 'bar', baz: Buffer.from('howdy') }
      const rec1 = await client.createRecord(info.id, body)
      const cid1 = await rec1?.record?.value.cid()
      if (!cid1) throw new Error('expected valid record')
      const rec2 = await client.getRecord(info.id, cid1)
      const cid2 = await rec2.value.cid()
      expect(cid1.toString()).to.equal(cid2.toString())
    })

    it('should support thread subscriptions', async () => {
      const client2 = new Client('http://127.0.0.1:5207')
      const hostID2 = await client2.getHostID()
      const hostAddr2 = new Multiaddr(`/dns4/threads2/tcp/4006`)

      const info = await createThread(client)
      const peerAddr = hostAddr2.encapsulate(new Multiaddr(`/p2p/${hostID2}`))
      await client.addReplicator(info.id, peerAddr)
      let rcount = 0
      const res = client2.subscribe((rec?: ThreadRecord, err?: Error) => {
        if (rec) rcount += 1
        else if (err) rcount -= 1
      }, info.id)
      await client.createRecord(info.id, { foo: 'bar1' })
      await client.createRecord(info.id, { foo: 'bar2' })
      await delay(1000)
      expect(rcount).to.equal(2)
      res.close()
      await client.createRecord(info.id, { foo: 'bar3' })
      // Shouldn't pick it up
      await delay(1000)
      expect(rcount).to.equal(2)
    }).timeout(5000)
  })
})
