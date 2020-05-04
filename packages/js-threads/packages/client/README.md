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

```js
import {Client} from '@textile/threads-client'

client = new Client()
```

**create a threads client using Textile APIs**

```js
import {API} from '@textile/textile'
import {Client} from '@textile/threads-client'

const api = new API({
    token: '<project token>',
    deviceId: '<user id>'
})
await api.start()

const client = new Client(api.threadsConfig)
```


**create a store**

```js
const store = await client.newDB()
await client.newCollection(store.id, 'Folder2P', schema)
```

**get all instances**

```js
const found = await client.find(this.finderID, 'Folder2P', {})
console.debug('found:', found.instancesList.length)
this.folders = found.instancesList.map((instance) => instance).map((obj) => {
  return new YourModel(obj)
})
```

**add an instance**

```js
// matches YourModel and schema
const created = await client.instanceCreate(this.finderID, 'Folder2', [{
  some: 'data',
  numbers: [1, 2, 3]
}])
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
