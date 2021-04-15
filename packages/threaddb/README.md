# @textile/threaddb

> An offline-first local db that syncs to the distributed web.

**This project is pre-release, do not use it in production, breaking changes will still occur without notice.**

## Getting help

The Textile/Threads developers/community are active on [Slack](https://slack.textile.io/) and [Twitter (@textileio)](https://twitter.com/textileio), join us there for news, discussions, questions, and status updates. Also, [check out our blog](https://blog.textile.io) for the latest posts and announcements.

If you think you've found a bug, please file a github issue. Take a look at our comprehensive [contributor guide](#contributing) for details on how to get started.

## Background

> See this 5-minute project overview video to get a feel for the underlying project structure, and how we’re conceptualizing the new ThreadDB in Javascript.

[Project overview video](https://www.loom.com/share/3d7ec496c3d744a39d85e3fc3e921b7d)

Let's start with some of the motivations around our new approach to ThreadDB, and our shift from "Threads the database" to "Threads the database syncing mechanism".

- **Local first**. The concept of offline-first or local-first software isn’t a new one. There are some great discussions ([and summaries](https://blog.acolyer.org/2019/11/20/local-first-software/)) of the ideas out there already, and we encourage you to take a look. User ownership of data, interoperability, collaboration, offline-capable, etc are all ideals we appreciate.
- **Usability**. This one doesn’t get discussed as much in the context of offline-first software, but it is actually way easier to test and develop apps that don’t actually require real-time access to any remote services. As you’ll see in some of our demo videos below, you can spend a good chunk of time testing, validating, and breaking things before you even touch a “live” remote API. This means less garbage data while developing, while at the same time leveraging and testing against the real APIs you’ll encounter once you move to production.
- **Flexibility**. Why should a developer looking to leverage Threads in their workflow have to migrate to a new database implementation, when there are already lots of great databases out there? Wouldn’t it be great if you could just use the right database for the job, and then simply have that database sync to web3 automatically? We think so, and this is part of what we are exploring with this release of ThreadDB.

When thinking about the above constraints (plus a whole lot of technical considerations), we landed on a simple, but powerful framework for our new vision of ThreadDB for Javascript. This early release addresses the local-first database component by leveraging [IndexedDB, via Dexie](https://github.com/dfahlander/Dexie.js). This provides a lightweight, easy to use database, where all the complexity of remote sync is separated from the complexity of the database itself. The database features a MongoDB-like experience, with change tracking, custom UUIDs, and more. For those already familiar with Dexie, you can peel back the layers to have direct access to the Dexie database object for even more control over your local database experience. Check out the [getting started section](#getting-started) to get a feel for the basic APIs provided by Textile. There, you’ll see what is required to go from basic interactions with a local ThreadDB Database to pushing those local changes to a Remote.

### Modular

ThreadDB for Javascript contains a fully-featured local-first database (Dexie) and a set of remote features that enable sync, archive, and recovery over the network. The `Remote` object itself simply defines several middlewares that intercept Dexie calls, store the list of updates in a local sandbox, and then provides tooling to push, pull, rebase, and stash these local changes with a remote Thread daemon.

The project design is purposefully modular, and is organized roughly into three components: the "local" store, the "middleware", and the communication with a "remote". Ideally, the "local" component is minimal, and provides only a light wrapper around a local database. In our case, that database is IndexedDB via Dexie, but in theory, almost any local database will eventually work. The middleware is similarly light-weight. Here, we provides a few sub-modules for hooking into the local database to extract the things we need to communicate with the remote module. It additionally provides a few middleware components that provide MongoDB style queries, track changes, custom UUIDs, schemas, and more. Those familiar with our existing [Threads Client](https://github.com/textileio/js-threads) library will notice several useful similarities.

That brings us to the "remote" module. This is where the magic of syncing to the decentralized web happens. In practice, we're leveraging existing Textile APIs to validate this proof-of-concept model. Eventually, as we optimize what is going on under the hood, we’ll roll out new APIs that are more efficient, and provide more useful functionality in an offline-first scenario. Essentially, we track changes on the local database, and provide low level APIs to push, pull, and resolve any conflicts that arise when syncing with a remote. In general, the remote is considered the "source of truth" in any real conflicts, and ThreadDB is designed to be used more as a federated system of peers, rather than pure peer-to-peer. As such, each local "remote" module connects to one remote daemon at a time, and relies on that daemon for network operations and syncing. By default, remotes are configured to work against Textile's Hub daemon, but as a developer, you have easy access to setting this to other remote hosts.

## Getting Started

> Check out this "getting started" video to get a feel for the basic APIs. In it, you'll see what is required to go from basic interactions with a local ThreadDB Database to pushing those local changes to a Remote Daemon.

[Getting started video](https://www.loom.com/share/ecebf43e0eda4376a389ceadb234fdb3)

Before digging into the specifics of ThreadDB, you’ll likely want to familiarize yourself with existing Textile [developer tooling](https://docs.textile.io/). In particular, if you are planning to use ThreadDB against Textile’s Hub, you’ll want to make sure you have a [developer account setup](https://docs.textile.io/hub/accounts/), and likely want to create some [new keys for testing](https://docs.textile.io/hub/apis/) etc. For the purposes of testing and building toy examples, we recommend, you stick with [development mode](https://docs.textile.io/tutorials/hub/development-mode/).

Additionally, for this early release, we’ve tried to keep the Database APIs relatively similar to our existing Thread Client library. That means ThreadDB supports Collections and Instances, very similarly to what we [already have going on over here](https://docs.textile.io/threads/). We _highly recommend_ you take a look at those existing docs before proceeding.

Assuming you have a developer account setup, and you’ve read the docs (seriously, [read the docs](https://docs.textile.io/threads/#collections)), let’s get started. The following examples are taken directly from the above getting started video. So feel free to follow along, copy/paste the code snippets, and start testing things. The demo videos and most of our examples are in Typescript, but we provide a vanilla [Javascript React demo](#advanced) below as well. Additionally, you can use any environment you are comfortable with, including browser apps via a bundler such as webpack or rollup, or directly in Node/Deno. For the brave, you can access the existing [Notebook](https://observablehq.com/@carsonfarmer/threaddb-usage-demo/2) directly.

### Install

Start by creating a new npm project. Just stick with the defaults here, we’re not going to need anything fancy:

```bash

mkdir demo-project
cd demo-project
npm init
# Defaults are fine
```

Now you can install the required Textile modules. For this first mini-demo, we’ll stick with the minimal setup (we’re including `threads-client` here for validation later):

```bash
npm i @textile/threaddb @textile/crypto @textile/threads-id @textile/threads-client
```

### Usage

With those in place, we’re ready to start interacting with the Database. If you’re running this code in NodeJS, it will automatically include an IndexedDB polyfill to store data in SQLite, otherwise (in a browser) it should leverage the embedded IndexedDB database.

```typescript
import { Database } from "@textile/threaddb";
import { schema, Person } from "./schema"; // Some json-schema.org schema
```

One of the design constraints we set for ourselves when building ThreadDB was to ensure that a developer or user could get up and going with ThreadDB without an internet connection, and without any prior orchestration with a remote. So to create a new Database is as easy as:

```typescript
// Create an empty db, with a defined schema, and open it
const db = new Database("demo", { name: "Person", schema });
await.open(1); // Versioned db on open
```

We make a few assumptions to make this easy. 1. That the developer knows the schema(s) that they want to use for their Collections ahead of time, and 2. That a change in schemas will result in a change in the database version (so we also have versioned databases, thanks to Dexie).

Now, we just start using it. Similarly to MongoDB you can get a given Collection, and you can insert data into it. In our case, it will do schema validation on the way in.

```typescript
const Person = db.collection("Person");
await Person.insert({ name: "Someone", age: 37 });
// [ '01ENVC6YJ94K0DVXXESQJYE8WD' ]
```

Because it is often useful to create an Instance before inserting it into the database, you can do that via the `create` method on a Collection:

```typescript
const entity = Person.create({ name: "Other", age: 2 });
await entity.exists(); // false
await Person.has(entity._id); // false
```

All instances have an `_id` property like in MongoDB, which in our case, is a [Ulid](https://github.com/ulid/spec). Once we have an instance, it has many useful properties that allow us to save, check if it exists in the database, delete, etc.

```typescript
await entity.save(); // Write to the local store
await entity.exists(); // true
```

As with any reasonable database, you can query it, grab all Instances, count things, etc. We provide some nice MongoDB style querying, but you also have access to the full suite of query tools provided by Dexie if you want them:

```typescript
await Person.find({}).count(); // Should be at least 2
```

Similarly, things like transactions are supported by ThreadDB. We have readTransaction and writeTransaction support, which matches our Go implementation to some degree. These are useful for batch inserts and for providing proper isolation and automaticity guarantees:

```typescript
const person = { name: "Someting", age: 4 };
await Person.writeTransaction(async function () {
  const [id] = await Person.insert(person);
});
```

By the way, `insert` and many other methods take a variadic list of inputs, which makes it easy to do bulk inserts even when not using a transaction explicitly.

And of course, more complex queries are possible thanks to the (subset of) MongoDB query language that ThreadDB supports:

```typescript
const people = Person.find({
  $or: [{ age: { $gt: 2 } }, { name: { $eq: "Something" } }],
}); // Should still find all of them!
await people.toArray();
```

### Remotes

So far, we’ve only be doing local operations. Now it’s time to interact with a remote daemon. If you aren’t familiar with Textile’s Thread daemons, we recommend you [read up on them here](https://github.com/textileio/go-threads). The protocols and design of ThreadDB can be explored in detail in the white-paper: [A protocol & event-sourced database for decentralized user-siloed data](https://docsend.com/view/gu3ywqi). For further technical details. the reference implementation of Threads is written in Go and the full implementation details can be found on [godocs](https://godoc.org/github.com/textileio/go-threads). But for now, let’s simply connect to the Hub’s remote Threads daemon, so we don’t have to worry about running our own.

For working against the Hub, you’ll need a developer key, see the links above for some examples on how to generate this. We recommend starting with an insecure key for developing locally, before upgrading to a production setup.

> Please remember to use your own keys, rather than the demos keys provided in the Notebook!

```typescript
// Set key info (assumes this is an insecure key)
const key = d""
// Specify the key here, remote defaults to Hub APIs so no need to set
const remote = await db.remote.setKeyInfo({ key })
```

Once we've "set" our remote, it is pretty easy to start working against it. But there are two things we need to do before we can start pushing data. The first, is to authenticate our local "user" or database instance, with the remote. This is required, regardless of the remote Threads daemon we are connecting with, be it the Hub, or our own daemon running on our laptop. Authentication is always against a public key (defaulting to an ED25519 signing pair). ThreadDB makes this super easy if you are working with our default key objects:

```typescript
import { PrivateKey } from "@textile/crypto";
// New random identity
const privateKey = PrivateKey.fromRandom();
// Grab the token, save it, or just use it
const token = await remote.authorize(privateKey);
console.log(token);
```

The response from `remote.authorize` is a token string. This is actually automatically added to the remote's metadata under the hood, but since this token doesn't expire, a developer might wish to store this in the user's `localStorage`, or otherwise cache this information. You could even store the token within the user's database if you wanted, though be advised, you should probably encrypt it if you are going to persist it anywhere insecure.

Now we’re ready to start working against the remote. The first thing you’ll likely want to do, is initialize a new database on the remote. This is essentially allocating a new Thread, and pushing the local schema information to the remote database. In practice, you’ll likely want to do this the first time a user connects with the remote daemon, and only then. But ThreadDB makes this operation pretty much idempotent, so if you accidentally try to initialize twice, you shouldn’t end up with more than one database on the remote. We’ll be working further to make this easier, so that it will detect version changes and things like that to handle schema changes “on the fly”.

```typescript
const id = await remote.initialize(); // Create random thread
console.log(id);
```

Of course, if you already have a Thread ID in mind, you can provide that string to the initialize method. This is a good idea if you want to invite another peer to your Thread that was created by a different peer, or if you have a “static” Thread that all users are going to interact with.

Now you just push…

```typescript
await remote.push("Person"); // That's it
```

Assuming no conflicts or issues with connecting to the remote, you’re off to the races. We can actually use our existing Threads Client library to validate that our changes were indeed pushed:

```typescript
import { Client } from "@textile/threads-client";
import { ThreadID } from "@textile/threads-id";

const client = await Client.withKeyInfo({ key });
// Grab context just for our demo, not really needed
const context = client.context.withToken(token);
const found = await client.find(ThreadID.fromString(id), "Person", {});
console.log(found);
```

If all went according to plan, you should have the same set of instances on the remote as you do locally. Now try pushing more updates, or creating updates directly on the remote and pulling them into your local state. The remote API also has tools to “stash”, and “rebase” local changes on top of remote changes, and all sorts of additional tooling.

### Tests

For now, you'll need to have a local `threadd` daemon running. The easiest way to do this is via `docker-compose`. You can use the following `docker-compose.yml` file:

```yml
version: "3"
services:
  threads:
    image: textile/go-threads:latest
    volumes:
      - "./repo/threads:/data/threads"
    environment:
      - THRDS_HOSTADDR=/ip4/0.0.0.0/tcp/4006
      - THRDS_APIADDR=/ip4/0.0.0.0/tcp/6006
      - THRDS_APIPROXYADDR=/ip4/0.0.0.0/tcp/6007
      - THRDS_DEBUG=true
    ports:
      - "4006:4006"
      - "127.0.0.1:6006:6006"
      - "127.0.0.1:6007:6007"
```

With the above `yml` file, run the following:

```bash
docker-compose pull
docker-compose up
```

And then start some tests:

```bash
npm run test
```

Test coverage is pretty comprehensive, and you should get a coverage report upon running the tests (coverage is generated from the node tests):

```bash
npm run test:node
```

Browser tests are run via `polendina`, and the tests are built on-the-fly using webpack (this is the only thing webpack is used for). The `webpack.test.js` config is used to enable `polendina` testing in typescript modules.

```bash
npm run test:browser
```

### Build

We use `tsc` to build our nodejs-based javascript outputs, and `rollup` for a single-file bundle. This makes it easier to derive different output types (e.g., commonjs vs es modules vs type defs). To create the relevant build outputs simply call:

```bash
npm run build
```

This should produce a dist folder with multiple output types. These are referenced in the `package.json`'s `exports` entry, so that the right module types are used in the right context (i.e., `import` vs `require`). Note that a single-file ES6 module is output for browsers.

### Releasing

We'll try to be pretty serious about semantic versioning. To help us with this, we use conventional commits (and some `commitlint` hooks/linters) as well as automatically-generated conventional changelogs (via `standard-version`). To create a new version/release simply call:

```bash
npm run version
```

And then follow the standard `npm` publishing workflow from there.

### Environment

If you are working in vscode or vscodium, the following local settings are useful for testing:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "mochaExplorer.files": "**/*.spec.ts",
  "mochaExplorer.esmLoader": true,
  "mochaExplorer.exit": true,
  "mochaExplorer.require": ["ts-node/register", "source-map-support/register"],
  "mochaExplorer.launcherScript": "node_modules/mocha-explorer-launcher-scripts/nyc",
  "mochaExplorer.env": {
    "TS_NODE_FILES": "true",
    "TS_NODE_COMPILER_OPTIONS": "{\"module\": \"commonjs\" }"
  }
}
```

These settings pair nicely with the `hbenl.vscode-mocha-test-adapter` and `ryanluker.vscode-coverage-gutters` plugins. I also highly recommend `dbaeumer.vscode-eslint` for in-editor linting. Note that we also use prettier for code formatting (called via eslint).
