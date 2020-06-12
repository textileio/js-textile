Textile Hub
============

> JS lib for interacting with Hub APIs

## Introduction

`@textile/hub` provides access to Textile APIs in apps based on a Account Keys or User Group Keys. Go to [the docs](https://docs.textile.io/) for more about accounts and key generation.

Join us on our [public Slack channel](https://slack.textile.io/) for news, discussions, and status updates. [Check out our blog](https://blog.textile.io/) for the latest posts and announcements.

### Install

```bash
npm install @textile/hub
```

## Usage


### Authentication

If you use the Threads or Buckets APIs, you'll need to first authenticate with the API.

[Read more on authenticating users here](https://docs.textile.io/tutorials/hub/web-app/).

There are two commonly used object types for passing authentication parameters to the Hub library: `UserAuth` and `KeyInfo`.

#### UserAuth

`UserAuth` objects can be generated to provide Hub API access to your users inside of your application. Review the tutorial linked above on setting up a UserAuth providing endpoint.

```typescript
import { UserAuth } from '@textile/hub'

const auth: UserAuth = {
  msg: '<api msg>',
  sig: '<api sig>',
  token: '<user msg>',
  key: '<api key>',
}
```

#### KeyInfo

The `KeyInfo` object holds your API secret and so should never be used in an insecure environment (such as in an application). These methods can be used with user group keys (`type = 0`) or account keys (`type = 1`).

```typescript
import { KeyInfo } from '@textile/hub'

const auth: KeyInfo = {
  key: '<api key>',
  secret: '<api secret>',
  type: 0 // <api key type>
}
```

#### Examples

**Developer Account Auth**

Create a database client using the Textile Hub and account keys.

```typescript
import { Client, KeyInfo } from '@textile/hub'

async function start () {
  const keyInfo: KeyInfo = {
    key: '<api key>',
    secret: '<api secret>',
    type: 1,
  }
  const client = await Client.withKeyInfo(keyInfo)
}
```

**User Account Auth**

Create a database client using the Textile Hub and user group keys.

```typescript
import { Client, UserAuth } from '@textile/hub'

async function start (auth: UserAuth) {
  const client = Client.withUserAuth(auth)
}
```

### ThreadDB Client

Threads client to access remote threads, generate token and more.

[Read the full client docs here](https://textileio.github.io/js-hub/docs/hub.client).

**List Threads**

```typescript
import { Client } from '@textile/hub'

async function list (client: Client) {
  const threads = await client.listThreads()
}
```

**Create a thread**

```typescript
import { Client, ThreadID } from '@textile/hub'

async function start (client: Client, schema: any) {
  /**
   * Setup a new ThreadID and Database
   */
  const threadId = ThreadID.fromRandom();

  /**
   * Each new ThreadID requires a `newDB` call.
   */
  await client.newDB(threadId)

  /**
   * We add our first Collection to the DB for any schema.
   */
  await client.newCollection(threadId, 'Astronaut', schema);
}
```

**Insert data**

```typescript
import { Client, ThreadID } from '@textile/hub'

async function createEntity (client: Client, threadId: ThreadID, jsonData: any) {
  /**
   * Add a new Astronaut
   * 
   * Our Thread contains the Astronaut Collection, so you just need
   * to add a new astronaut that matches the expected schema.
   * 
   * If you run this app many times, you'll notice many Buzz Aldrin
   * entries in your ThreadDB, each with a unique ID.
   */
  const ids = await client.create(threadId, 'Astronaut', [
    jsonData,
  ]);
}
```

### Bucket Client

Create, manage, and publish user and account Buckets.

[Read the full client docs here](https://textileio.github.io/js-hub/docs/hub.buckets).

**Create a new Bucket client**

```typescript
import { Buckets, UserAuth } from '@textile/hub'

/**
 * Create a Bucket client instance with the same auth
 * methods used for threads
 */
async function start (auth: UserAuth) {
  const buckets = Buckets.withUserAuth(auth)
}
```

**Read existing Buckets**

```typescript
import { Buckets } from '@textile/hub'

async function run (buckets: Buckets) {
  /**
   * List existing Buckets
   */
  const roots = await buckets.list();
  const existing = roots.find((bucket) => bucket.name === 'files')

  /**
   * If a Bucket named 'files' already existed for this user, use it.
   * If not, create one now.
   */
  let bucketKey = ''
  if (existing) {
    bucketKey = existing.key;
  } else {
    const created = await buckets.init('files');
    bucketKey = created.root ? created.root.key : ''
  }
  return bucketKey
}
```

**Add files to Buckets**

```typescript
import { Buckets, UserAuth } from '@textile/hub'

async function add (buckets: Buckets, webpage: string, bucketKey: string) {
  /**
   * Add a simple file Buffer
   * 
   * Alternative formats are here: https://github.com/textileio/js-hub/blob/master/src/normalize.ts#L14
   * 
   * We add the file as index.html so that we can render it right in the browser afterwards.
   */
  const file = { path: '/index.html', content: Buffer.from(webpage) }

  /**
   * Push the file to the root of the Files Bucket.
   */
  const raw = await buckets.pushPath(bucketKey, 'index.html', file)
}
```
