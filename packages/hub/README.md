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
interface UserAuth {
  msg: <api msg>,
  sig: <api sig>,
  token: <user msg>,
  key: <user group key>,
}
```

#### KeyInfo

The `KeyInfo` object holds your API secret and so should never be used in an insecure environment (such as in an application). These methods can be used with user group keys (`type = 0`) or account keys (`type = 1`).

```typescript
interface KeyInfo {
  key: <api key>,
  secret: <api secret>,
  type: <api key type>,
}
```

#### Examples

**Developer Account Auth**

Create a database client using the Textile Hub and account keys.

```typescript
import { Client, KeyInfo } from '@textile/hub'

const keyInfo: KeyInfo = {
  key: process.env.ACCOUNT_API_KEY,
  secret: process.env.ACCOUNT_API_SECRET,
  type: 1,
}

const db = await Client.withKeyInfo(keyInfo)
```

**User Account Auth**

Create a database client using the Textile Hub and user group keys.

```typescript
import { Client, UserAuth } from '@textile/hub'

/**
 * msg, sig, and token all must be provided by a secure gateway.
 */
const auth: UserAuth = {
  msg: msg,
  sig: sig,
  token: token,
  key: process.env.USER_API_KEY,
};

const db = Client.withUserAuth(auth)
```

### ThreadDB Client

Threads client to access remote threads, generate token and more.

[Read the full client docs here](https://textileio.github.io/js-textile/docs/hub.client).

**List Threads**

```typescript
const threads = await db.listThreads()
```

**Create a thread**

```typescript
import { ThreadID } from '@textile/hub'

/**
 * Setup a new ThreadID and Database
 */
threadId = ThreadID.fromRandom();

/**
 * Each new ThreadID requires a `newDB` call.
 */
await db.newDB(threadId)

/**
 * We add our first Collection to the DB for any schema.
 */
await db.newCollection(threadId, 'Astronaut', astronautSchema);
```

**Insert data**

```typescript
/**
 * Add a new Astronaut
 * 
 * Our Thread contains the Astronaut Collection, so you just need
 * to add a new astronaut that matches the expected schema.
 * 
 * If you run this app many times, you'll notice many Buzz Aldrin
 * entries in your ThreadDB, each with a unique ID.
 */
const ids = await db.create(threadId!, 'Astronaut', [
  jsonAstronaut,
]);
```

### Bucket Client

Create, manage, and publish user and account Buckets.

[Read the full client docs here](https://textileio.github.io/js-textile/docs/hub.buckets).

**Create a new Bucket client**

```typescript
import { Buckets } from '@textile/hub'

/**
 * Create a Bucket client instance with the same auth
 * methods used for threads
 */
const buckets = Buckets.withUserAuth(auth)
```

**Read existing Buckets**

```typescript
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
  bucketKey = created.root!.key;
}
```

**Add files to Buckets**

```typescript
/**
 * Add a simple file Buffer
 * 
 * Alternative formats are here: https://github.com/textileio/js-textile/blob/master/src/normalize.ts#L14
 * 
 * We add the file as index.html so that we can render it right in the browser afterwards.
 */
const file = { path: '/index.html', content: Buffer.from(webpage) }

/**
 * Push the file to the root of the Files Bucket.
 */
const raw = await buckets.pushPath(bucketKey!, 'index.html', file)

```
