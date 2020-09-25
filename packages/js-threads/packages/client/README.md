# Threads Client _(threads-client)_

Server-side (remote) event sourced storage layer for Textile's Threads protocol & database

[![Textile](https://img.shields.io/badge/made%20by-Textile-informational.svg)](https://textile.io)
[![License](https://img.shields.io/github/license/textileio/js-threads.svg)](../../LICENSE)
[![npm (scoped)](https://img.shields.io/npm/v/@textile/threads-client.svg)](https://www.npmjs.com/package/@textile/threads-client)

This sub-package is part of [`js-threads`](https://github.com/textileio/js-threads). See the [top-level documentation](https://textileio.github.io/js-threads) for details.

## Install

```
npm install @textile/threads-client
```

## Usage

**create a threads client**

```typescript
import {Client} from '@textile/threads'

const client = new Client()
```

**create a threads client using Textile Hub APIs**

[Read the full Hub API documentation](https://textileio.github.io/js-hub/docs).

**create a store**

```typescript
import {Client, Identity, ThreadID, UserAuth, PrivateKey} from '@textile/threads'

async function newToken (client: Client, user: Identity) {
  const token = await client.getToken(user)
  return token
}

async function createDB (client: Client) {
  const thread: ThreadID = await client.newDB()
  return thread
}

async function collectionFromObject (client: Client, thread: ThreadID, name: string, obj: any) {
  await client.newCollectionFromObject(thread, obj, { name })
  return
}

async function setup (auth: UserAuth) {
  const user = PrivateKey.fromRandom()

  const client = await Client.withUserAuth(auth)

  const token = await newToken(client, user)

  const thread = await createDB(client)

  const astronaut = {name: 'Buzz', missions: 3}
  await collectionFromObject(client, thread, 'astronauts', astronaut)
}
```

**get all instances**

```typescript
import {Client, ThreadID} from '@textile/threads'
async function findEntity (client: Client, threadId: ThreadID, collection: string) {
  const found = await client.find(threadId, collection, {})
  console.debug('found:', found.length)
}
```

**add an instance**

```typescript
import {Client, ThreadID} from '@textile/threads'
// matches YourModel and schema
async function create (client: Client, threadId: ThreadID, collection: string) {
  const created = await client.create(threadId, collection, [{
    some: 'data',
    numbers: [1, 2, 3]
  }])
}
```

## React Native

The following has been tested on **Android Only**.

`js-thread-client` should be compatible with React Native. Here are some helpful pointers if you find issues testing it out.

### Connecting to the threads daemon

You can run the daemon released as part of the early preview. To do so,

```sh
git clone git@github.com:textileio/go-threads.git
cd go-threads
go run threadsd/main.go
```

**Make daemon available to RN**

You can make the daemon API port available to your app with,

```sh
adb reverse tcp:6007 tcp:6007
```

Altenatively, you can ensure this is run whenever you run your app by modifying your `package.json` as follows.

```json
{
  ...
  "scripts": {
    ...
    "bind": "adb reverse tcp:6007 tcp:6007",
    "android": "npm run bind && npx react-native run-android",
    ...
  },
  ...
}
```

Then, run your app with,

```sh
npm run android
```

### Buffer not found

`js-threads-client` relies on Buffer being available. To make `Buffer` available in your project, you may need to introduce a shim. Here are the steps.

**install rn-nodeify**

read more about [rn-nodeify](https://github.com/tradle/rn-nodeify#readme).

```js
npm install -G rn-nodeify
```

**run nodeify in the root of your project**

```js
rn-nodeify --install buffer --hack
```

This will create a `shim.js` in the root of your project. You need to import this at the top of your apps entry file (e.g. `indes.js`).

The top of `index.js` would look like,

```js
require('./shim')
...
```

**add nodeify to your postinstall**

Ensure that the shim is still configured after any module updates. Inside `package.json` add the following line to your `scripts` tag,

```json
{
  ...
  "scripts": {
    ...
    "postinstall": "rn-nodeify --install buffer --hack"
  }
}
```
