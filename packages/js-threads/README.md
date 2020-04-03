# Textile's Threads protocol & database _(js-threads)_

[![Textile](https://img.shields.io/badge/made%20by-Textile-informational.svg)](https://textile.io)
[![Slack](https://img.shields.io/badge/slack-slack.textile.io-informational.svg)](https://slack.textile.io)
[![License](https://img.shields.io/github/license/textileio/js-threads.svg)](./LICENSE)
[![Release](https://img.shields.io/github/release/textileio/js-threads.svg)](https://github.com/textileio/js-threads/releases/latest)
[![Readme](https://img.shields.io/badge/readme-OK-green.svg)](https://github.com/RichardLitt/standard-readme)
[![Lerna](https://img.shields.io/badge/monorepo-lerna-cc00ff.svg)](https://lerna.js.org/)

![Tests](https://github.com/textileio/js-threads/workflows/Test/badge.svg)
[![Docs](https://github.com/textileio/js-threads/workflows/Docs/badge.svg)](https://textileio.github.io/js-threads)

> A protocol & event-sourced database for decentralized user-siloed data written in Typescript

## Using Threads

To get started using Threads, check out the [docs site](https://docs.textile.io/) and [API documentation](https://textileio.github.io/js-threads).

## Getting help

The Textile/Threads developers/community are active on [Slack](https://slack.textile.io/) and [Twitter (@textileio)](https://twitter.com/textileio), join us there for news, discussions, questions, and status updates. Also, [check out our blog](https://blog.textile.io) for the latest posts and announcements.

If you think you've found a bug in Threads, please file a Github issue. Take a look at our comprehensive [contributor guide](#contributing) for details on how to get started.

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Developing](#developing)
- [API](#api)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Background

Textile's Threads Protocol and Database provides an alternative architecture for data on the web. Threads aims to help power a new generation of web technologies by combining a novel use of event sourcing, Interplanetary Linked Data (IPLD), and access control to provide a distributed, scalable, and flexible database solution for decentralized applications. Threads is backed by a great deal of research and experience, and provides protocols for securely storing and sharing content-addressable data (on IPFS), with tooling to help standardize data creation and dissemination.

The primary public API to Threads is the [Threads Database](./packages/database). The Database aims to provide:

- [x] Document & [datastore compliant](https://github.com/ipfs/js-datastore-level) key-value store
- [x] Familiar APIs (think [mongodb/mongoose](https://mongoosejs.com)!)
- [x] [Offline](http://offlinefirst.org) and/or [local-first](https://www.inkandswitch.com/local-first.html) storage and remote/peer sync
- [x] User/developer authentication & cloud support
- [ ] Multiple transport options (pubsub, direct p2p, IPNS, etc)
- [ ] Cryptographically-driven access control
- [x] Encryption and IPLD encoding
- [x] Configurable codecs (i.e., handling conflicts via [CRDTs](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type) etc)
- [ ] Fast indexes and queries
- [x] Multiple API entry points and levels (low- and high-level APIs)
- [ ] Direct integration with common frameworks (e.g., React, Vue, Electron, etc)

Plus more features on the way!

Need something specific? Take a look at our [contributor guide](#contributing) for details on how to ask for features, or better yet, submit a PR :wink:

Underlying the Threads Database are a number of ideas and technologies, which are outlined in detail in the [Threads whitepaper](https://github.com/textileio/papers). These components are all housed within this [mono-repo](https://en.wikipedia.org/wiki/Monorepo), and include a set of [core modules](./packages/core) for creating Thread identities and keys (`@textile/threads-core`), as well as tooling for data [encryption and encoding](./packages/encoding) (`@textile/threads-encoding`), networking (with support for [local](./packages/network) (`@textile/threads-network`) and [remote](./packages/network-client) (`@textile/threads-network-client`) key management), and a local-first, event-sourced [storage layer](./packages/store) (`@textile/threads-store`).

### Details

A Thread-based Database is tied to a single Thread (with associated Thread ID). A Database is an Event Emitter (in the Nodejs sense), and Listeners can subscribe to Events using 'wildcard' syntax via the [EventEmitter2](https://github.com/EventEmitter2/EventEmitter2) library. For example, you can do something like (note the mongoose-like syntax):

```typescript
import { Database } from '@textile/threads-database'
const db = new Database(...)
const Collection1 = await db.newCollectionFromObject('Collection1', {
  ID: '',
  name: '',
  counter: 0,
})

// This will listen to any and all event types on Collection1
db.on('Collection1.**', update => {
  console.log(update)
})

const thing = new Collection1({ ID: 'id-i1', name: 'Textile1' })
await thing.save()  
```

To handle different data structures, a Database contains Collections, each of which are defined by a [json-schema.org](https://json-schema.org) schema. These schemas define the 'shape' of Collection Instances. Collections implement a Store with [JSON Patch](https://github.com/Starcounter-Jack/JSON-Patch) semantics by default, but will be made to support other types (CRDT-driven documents for instance) in the future (some of which are already under active development). Ultimately, a Collection is a Store with a set of APIs to make it feel like a *local database table*. For example, there are Collection- and Instance-level APIs to work with data:

```typescript
const i1 = new Collection1({ ID: 'id-i1', name: 'Textile1' }) // This is not yet persisted
await i1.save() // Save changes

// Modify the `i1` instance
i1.name = 'Textile0'
await i1.save() // Save changes

// Modify it again
i1.name = 'Blah'
i1.counter = 33

// Save it from the Collection
await Collection1.save(i1)

// Delete it from the Collection
await Collection1.delete(i1.ID)
```

Plus a bunch more APIs you'd expect, like `insert`, `findOne`, `has`, etc.. It also supports Mongodb/Mongoose style search (`find`), which returns an [AsyncIterator]() that consumers can use:

```typescript
const Thing = new Collection<Info>('things', {}) // Anything goes schema
await Thing.insert(
  { ID: '', other: -1, thing: 'five' },
  { ID: '', other: 2, thing: 'two' },
  { ID: '', other: 3, thing: 'three' },
  { ID: '', other: 4, thing: 'four' },
)

const all = Thing.find({ $or: [{ other: { $gt: 1 } }, { thing: 'one' }] }, { sort: { other: -1 } })
for await (const { key, value } of all) {
    console.log(value)
}
```

Collections also support (basic) read and write Transactions. These are lockable, key-based 'states' that you can put the Collection into, so that anything else that wants to write to the Collection must _await_ for the Transaction to complete. Transactions do not yet provide isolation, though they do provide atomic update semantics.

Any mutations on a Collections (which are essentially [aggregate roots] in the CQRS-sense), are dispatched via the Database's Dispatcher. There is one Dispatcher per Database in practice, and all Collections receive all updates, so their Reducer is responsible for taking appropriate action. The Dispatcher is then responsible for 1) persisting the event, and 2) calling the Collections' Reducer methods. At this point, the entire process can work entirely 'offline'. This design supports 'offline first' applications that may not have connections to a remote Peer for networking.

Networking is supported via the Event Bus. The Event Bus has two core components, a network Watcher (for observing updates from the Network layer) and a persistent Queue (for pushing updates to the Network layer). Essentially, the Event Bus subscribes to Events on the Database's Thread from the Network layer, and dispatches them via the Dispatcher to the Collections. From there, the behavior is identical to a 'local' Event.

Conversely, for Events generated locally on the Collections, these are pushed onto the Event Bus's Queue by the corresponding Collection (after a successful dispatch process), and they will attempt to send the update out via the Network layer. The queue is persistent in the case of the app being offline. It will attempt to send the updates, with exponential back-off in the case of failures. At the moment, it will make 5 attempts before giving up and moving on to the next Event (in the background). After it has processed its Queue, it will try any skipped events again (and again). The Event Queue will continue to process events and flush them to the Network layer as long as there are new events coming in. Upon app restart, the Queue will restart from the top, so that (say) a page refresh would potentially lead to re-connecting to the remote Peer and processing local events again.

All of the above is backed by a single (or multiple, depending on how a developer wants to use them) Datastore. By using the Datastore interface, we can support any backend that supports the abstract-leveldown interface (which includes leveldb, mongo, sqlite, memory, and many more). Other backends could be implemented by implementing the Datastore interface for them.

## Install

`js-threads` is implemented as a series of sub-packages, all managed within the js-threads repo. Each package is separately published to npm, so that developers can pick and choose which components of `js-threads` they want to consume. For example, to install the low-level network APIs along with the encoding/encryption tooling:

```shell script
npm install --save @textile/threads-network @textile/threads-encoding
```

Similarly, one can install the local storage layer or full-fledged Database separately:

```shell script
npm i --save @textile/threads-store @textile/threads-database
``` 

There are also a number of other recommended packages that will make working with Threads in Typescript/Javascript easier:

```shell script
npm i --save interface-datastore datastore-level buffer 
```

## Usage

The tests within the underlying [sub-packages](https://github.com/textileio/js-threads/tree/master/packages) of this repo provide several excellent examples of using the various components of `js-threads`. Additionally, there are a growing list of [examples](https://github.com/textileio/js-threads/tree/master/examples) available. Complete usage examples (with authentication etc) will be added soon. In the mean time, the following end-to-end example of exchanging data between two peers provides a good idea of the APIs that developers can expect to encounter when working with Threads:

```typescript
import { Multiaddr, ThreadID, Variant } from '@textile/threads-core'
import { Database } from '@textile/threads-database'
import { DomainDatastore } from '@textile/threads-store'
import { MemoryDatastore, Key } from 'interface-datastore'
import LevelDatastore from 'datastore-level'

interface DummyEntity {
  ID: string
  name: string
  counter: number
}

// Peer 1: Create db1, register a collection, create and update an instance.
const d1 = new Database(...)
await d1.open()
const id1 = d1.threadID
if (id1 === undefined) {
throw new Error('should not be invalid thread id')
}
// Create a new collection
const Dummy1 = await d1.newCollectionFromObject<DummyEntity>('dummy', {
  ID: '',
  name: '',
  counter: 0,
})

// Get peer1 database information (addr, id, keys, etc)
const dbInfo = await d1.dbInfo()

// Peer 2: Create a completely parallel db2, which will sync with the previous one and should
// have the same state of dummy. This one will be manually 'built' from sub-components,
// just to show how it can be done!
const info = await d1.service.getThread(id1)
const datastore = new MemoryDatastore()
const client = new Client({ host: 'http://127.0.0.1:6207' })
const service = new Network(new DomainDatastore(datastore, new Key('service')), client)
const test = await service.getHostID()
const d2 = await Database.fromAddress(dbInfo.addr, info.key, datastore, {
  service,
})
// Create parallel collection
const Dummy2 = await d2.newCollectionFromObject<DummyEntity>('dummy', {
    ID: '',
    name: '',
    counter: 0,
})

const dummy1 = new Dummy1({ name: 'Textile', counter: 0 })
dummy1.counter += 42
await dummy1.save()

// wait about 5 seconds?

const dummy2 = await Dummy2.findById(dummy1.ID)
console.log(dummy2.name === dummy1.name)
console.log(dummy2.counter === dummy1.counter)
await d1.close()
await d2.close()
```

That's it! Two completely separate MongoDB style database instances, syncing encrypted and signed data across the network!

## Authentication

Textile also provides remote Threads APIs you can use when developing your app. See [`@textile/textile`](https://github.com/textileio/js-textile) (or [docs.textile.io](https://docs.textile.io)) for details on authenticating with these APIs, and how to set up your own local development peer.

## Developing

This mono-repo is made up of several sub-packages, all managed by [lerna](https://github.com/lerna/lerna). You shouldn't have to do anything special to get started, however, here are a few steps that will make it easier to develop new functionality locally.

```shell script
git clone git@github.com:textileio/js-threads.git
cd js-threads
npm install
npm run bootstrap
```

Then you are pretty much ready to go. You can run tests for all sub-packages from the root directory:

```bash
npm test
# Or run the node- or browser-specific tests separately
npm run test:node
npm run test:browser
```

Similarly, you can compile the Typescript-based sub-packages to Javascript all at once:

```bash
npm run build
```

This project also uses incremental Typescript builds, so to take advantage of that (rather than building from scratch each time) use `compile`. You should notice significant speed-ups in your build process:

```shell script
npm run compile
```

See the [lerna docs](https://github.com/lerna/lerna#what-can-lerna-do) for other things you can do to make working across multiple packages easier. 

## API

See [https://textileio.github.io/js-threads](https://textileio.github.io/js-threads), which includes the technical API docs for all subpackages. 

## Maintainers

[Carson Farmer](https://github.com/carsonfarmer)

## Contributing

PRs gratefully accepted! Please see [the contributing guide](./CONTRIBUTING.md) for details on getting started.

Small note: If editing the README, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

[MIT](./LICENSE) (c) 2019-2020 Textile
