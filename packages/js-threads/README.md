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

Want something specific? Take a look at our [contributor guide](#contributing) for details on how to ask for features, or better yet, submit a PR yourself :wink:!

### Overview

Underlying the Threads Database are a number of ideas and technologies, which are outlined in detail in the [Threads whitepaper](https://github.com/textileio/papers). These components are all housed within this [mono-repo](https://en.wikipedia.org/wiki/Monorepo), and include a set of [core modules](./packages/core) for creating Thread identities and keys (`@textile/threads-core`), as well as tooling for data [encryption and encoding](./packages/encoding) (`@textile/threads-encoding`), networking (with support for [local](./packages/network) (`@textile/threads-network`) and [remote](./packages/network-client) (`@textile/threads-network-client`) key management), and a local-first, event-sourced [storage layer](./packages/store) (`@textile/threads-store`). There are also two entry points for running Threads DB, including a [local-first Javascript _module_](./packages/database) (`@textile/threads-database`), and a [remote-only, Javascript _client_](./packages/client) (`@textile/threads-client`).

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

If you are running `js-threads` in an environment that does not support [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) by default (such as Node), be sure to include it explicitly using something like the following at the top of your script or module:

```javascript
// Add WebSocket to the global namespace on Node
global.WebSocket = require('isomorphic-ws')
```

## Usage

The tests within the underlying [sub-packages](https://github.com/textileio/js-threads/tree/master/packages) of this repo provide tests that use the various components of `js-threads`, and provide useful examples to explore. Additionally, there are a growing list of [examples](https://github.com/textileio/js-examples) available. Complete usage examples (with authentication etc) will be added soon.

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
