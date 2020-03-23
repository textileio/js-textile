/* eslint-disable import/first */
// Some hackery to get WebSocket in the global namespace on nodejs
;(global as any).WebSocket = require('ws')

import readline from 'readline'
import fs from 'fs'
import yargs from 'yargs/yargs'
import bs58 from 'bs58'
import moment from 'moment'
import chalk from 'chalk'
import { Service, Client } from '@textile/threads-service'
import { Key } from 'interface-datastore'
import LevelDatastore from 'datastore-level'
import { randomBytes } from 'libp2p-crypto'
import PeerId from 'peer-id'
import { ThreadID, ThreadRecord, Variant, EventHeader, Multiaddr, Key as ThreadKey } from '@textile/threads-core'
import { decodeBlock } from '@textile/threads-encoding'

// Colors
const pink = chalk.keyword('pink')
const grey = chalk.grey
const green = chalk.green
const red = chalk.redBright

export async function threadAddressCmd(service: Service, id: ThreadID) {
  const lg = await service.getOwnLog(id, false)
  if (!lg) throw new Error('thread not found')
  const ta = new Multiaddr(`/thread/${id.string()}`)
  const remote = await service.getHostID()
  const paddrs: Multiaddr[] = []
  for (const la of lg.addrs?.values() || []) {
    const pid = la.getPeerId()
    if (pid === remote.toB58String()) {
      paddrs.push(la.encapsulate(ta))
    }
  }
  if (paddrs.length < 1) {
    throw new Error('thread is empty')
  }
  return paddrs
}

// Create primary interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.green('> '),
})

// CLI program
const program = yargs(process.argv.slice(2))
  .default({ debug: true })
  .alias({ d: 'debug' })
  .describe({ debug: 'Output extra debugging info' })
  .default({ repo: '.threads/chat-js' })
  .alias({ r: 'repo' })
  .describe({ repo: 'Path to local key store' })
  .default({ apiAddr: 'http://127.0.0.1:5008' })
  .alias({ a: 'apiAddr' })
  .describe({ apiAddr: 'Threads service API gRPC proxy bind multiaddress' }).argv

// Setup
if (!fs.existsSync(program.repo)) {
  fs.mkdirSync(program.repo, { recursive: true })
}
const store = new LevelDatastore(program.repo)
const client = new Client({ host: program.apiAddr })
const service = new Service(store, client)

// Local peer/thread information
let peer: PeerId
const peerKey = new Key('chat-peer-id')
let thread: ThreadID = new ThreadID(Buffer.alloc(0))

// Chat program
let chat: any
const resetCmds = () => {
  chat = yargs()
    .reset()
    .help(':help')
    .scriptName('')
    .version('0.0.1')
    .command(':address', 'Show the host or active thread addresses.', {}, async function() {
      if (thread.defined()) {
        const ids = await threadAddressCmd(service, thread)
        console.log(green(ids.toString()))
      } else {
        const remote = await service.getHostID()
        const id = new Multiaddr(`/ip4/127.0.0.1/tcp/4007/p2p/${remote}`)
        console.log(green(id.toString()))
      }
    })
    .command(':threads', 'List available threads.', {}, async function() {
      const query = store.query({ prefix: '/names' })
      for await (const { key, value } of query) {
        console.log(pink(key.name()).padEnd(35) + green(ThreadID.fromBytes(value).string()))
      }
    })
    .command(
      ':create <name>',
      'Create a new thread with a given name.',
      { name: { type: 'string', required: true } },
      async function({ name }) {
        const key = new Key(`/names/${name}`)
        if (await store.has(key)) throw new Error('thread name exists')
        const threadKey = ThreadKey.fromRandom()
        const info = await service.createThread(ThreadID.fromRandom(Variant.Raw, 32), { threadKey })
        thread = info.id
        await store.put(key, thread.bytes())
        console.log(grey('Added thread ') + green(thread.string()) + grey(' as ') + pink(name))
        rl.setPrompt(green(`${name}> `))
      },
    )
    .command(
      ':add <name> <addr> <keyString>',
      'Add an existing thread with name at address using a base32-encoded thread key.',
      {
        addr: { type: 'string', required: true },
        keyString: { type: 'string', required: true },
        name: { type: 'string', required: true },
      },
      async function({ name, addr, keyString }) {
        const key = new Key(`/names/${name}`)
        if (await store.has(key)) throw new Error('thread name exists')
        if (!addr) throw new Error('missing thread address')
        const mAddr = new Multiaddr(addr)
        const threadKey = ThreadKey.fromString(keyString)
        const info = await service.addThread(mAddr, { threadKey })
        thread = info.id
        await store.put(key, thread.bytes())
        console.log(grey('Added thread: ') + green(thread.string()) + grey('as: ') + green(name))
        rl.setPrompt(green(`${name}> `))
      },
    )
    .command(':enter <name>', 'Enter thread with name.', { name: { type: 'string', required: true } }, async function({
      name,
    }) {
      const info = await store.get(new Key(`/names/${name}`))
      thread = ThreadID.fromBytes(info)
      rl.setPrompt(green(`${name}> `))
    })
    .command(':keys', `Encode the active thread's keys.`, {}, async function() {
      if (!thread.defined()) throw new Error('enter thread first')
      const info = await service.getThread(thread)
      if (info.key?.read) {
        console.log(pink('key').padEnd(35) + green(info.key.toString()))
      }
    })
    .command(':exit', 'Exit the active thread, or whole program if no thread active.', {}, function() {
      if (thread.defined()) {
        thread = new ThreadID(Buffer.alloc(0))
        rl.setPrompt(green('> '))
      } else rl.close()
    })
    .command(
      ':replicator <addr>',
      'Add a replicator at address to active thread.',
      { addr: { type: 'string', required: true } },
      async function({ addr }) {
        if (!thread.defined()) throw new Error('enter thread first')
        await service.addReplicator(thread, new Multiaddr(addr))
      },
    )
    .command([':message [txt]', '*'], 'Send a message to the active thread.', {}, async function(body) {
      if (!thread.defined()) throw new Error('enter thread first')
      await service.createRecord(thread, { txt: body.txt })
    })
    .version(false)
    .exitProcess(false)
    .showHelpOnFail(false)
    .fail(function(_msg, err) {
      if (err) console.log(red(err.toString()))
      rl.prompt()
      resetCmds()
    })
    .onFinishCommand(async () => {
      rl.prompt()
      resetCmds()
    })
}
resetCmds()

// Main program
async function main() {
  const has = await store.has(peerKey)
  if (has) {
    const value = await store.get(peerKey)
    peer = await PeerId.createFromPrivKey(value)
  } else {
    peer = await PeerId.create({ keyType: 'Ed25519' })
  }
  // Welcome
  console.log(grey('Welcome to Threads!'))
  console.log(grey('Your peer ID is: ') + green(peer.toB58String()))
  console.log(grey('Enter ') + green(':help') + grey(' for options.'))
  rl.prompt()

  service.subscribe(async (rec?: ThreadRecord, err?: Error) => {
    if (err) console.log(red(err.toString()))
    if (!rec) return // undefined error, ignore and move on
    const info = await service.getThread(rec.threadID)
    if (!info.key?.read || !rec.record || !info.key.service) return // we don't have the right keys
    const event = rec.record.block
    const decodedHeader = decodeBlock<EventHeader>(event.header, info.key.read)
    const header = decodedHeader.decodeUnsafe()
    if (!header.key) return
    const decodedBody = decodeBlock(event.body, header.key)
    const body = decodedBody.decode()
    const id = rec.logID.toB58String()
    console.log(
      grey(
        moment(header.time * 1000)
          .local()
          .format('hh:mm:ss A'),
      ).padEnd(20) +
        ' ' +
        pink(id.slice(-7)) +
        ' ' +
        green(body.txt),
    )
    rl.prompt()
  })

  // Setup
  rl.on('line', function(line) {
    const txt = line.startsWith(':') ? line.trim().split(' ') : line.trim()
    if (txt.length) chat.parse(Array.isArray(txt) ? txt : [txt])
    else rl.prompt()
  })
    .on('close', function() {
      console.log('Have a great day!')
      process.exit(0)
    })
    .on('SIGINT', function() {
      rl.close()
    })
}

main()
