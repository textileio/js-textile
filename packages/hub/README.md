# @textile/hub

[![Made by Textile](https://img.shields.io/badge/made%20by-Textile-informational.svg?style=popout-square)](https://textile.io)
[![Chat on Slack](https://img.shields.io/badge/slack-slack.textile.io-informational.svg?style=popout-square)](https://slack.textile.io)
[![GitHub license](https://img.shields.io/github/license/textileio/js-textile.svg?style=popout-square)](./LICENSE)

> JS lib for interacting with Textile Hub APIs

Go to [the docs](https://docs.textile.io/) for more about Textile.

Join us on our [public Slack channel](https://slack.textile.io/) for news, discussions, and status updates. [Check out our blog](https://medium.com/textileio) for the latest posts and announcements.

## Table of Contents

- [@textile/hub](#textilehub)
  - [Table of Contents](#table-of-contents)
  - [Install](#install)
  - [Usage](#usage)
    - [Client](#client)
    - [Buckets](#buckets)
  - [Contributing](#contributing)
  - [Changelog](#changelog)
  - [License](#license)

## Install

`npm install @textile/hub`

## Usage

`@textile/hub` provides access to Textile APIs in apps based on a Project Token. For details on getting an app token, see [textileio/textile](https://github.com/textileio/textile) or join the [Textile Slack](https://slack.textile.io).

### Client

Access remote threads, generate token and more. 

**[Read the full set of methods](../interfaces/_textile_hub.client-1.html)**

**Developer Account Auth**

Create a database client using the Textile Hub and account keys.

```typescript
import { Client } from '@textile/hub'

const db = await Client.withUserKey({
  key: process.env.ACCOUNT_API_KEY,
  secret: process.env.ACCOUNT_API_SECRET,
  type: 1,
})
```

**User Account Auth**

Create a database client using the Textile Hub and account keys.

```typescript
import { Client, UserAuth } from '@textile/hub'

const auth: UserAuth = {
  msg: msg,
  sig: sig,
  token: token,
  key: process.env.USER_API_KEY,
};

const db = Client.withUserAuth(auth)
```

**List Threads**

```typescript
const threads = await db.listThreads()
```

[Read more on authenticating users here](https://docs.textile.io/tutorials/hub/web-app/).


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

### Buckets

Create, manage, and publish user and account Buckets.

**[Read the full set of methods](../classes/_textile_buckets.buckets-1.html)**

**Create a new Bucket client**

```typescript
import { ThreadID } from '@textile/hub'

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

## Contributing

This project is a work in progress. As such, there's a few things you can do right now to help out:

-   **Ask questions**! We'll try to help. Be sure to drop a note (on the above issue) if there is anything you'd like to work on and we'll update the issue to let others know. Also [get in touch](https://slack.textile.io) on Slack.
-   **Open issues**, [file issues](https://github.com/textileio/js-textile/issues), submit pull requests!
-   **Perform code reviews**. More eyes will help a) speed the project along b) ensure quality and c) reduce possible future bugs.
-   **Take a look at the code**. Contributions here that would be most helpful are **top-level comments** about how it should look based on your understanding. Again, the more eyes the better.
-   **Add tests**. There can never be enough tests.

Before you get started, be sure to read our [contributors guide](./CONTRIBUTING.md) and our [contributor covenant code of conduct](./CODE_OF_CONDUCT.md).

## Changelog

[Changelog is published to Releases.](https://github.com/textileio/js-textile/releases)

## License

[MIT](LICENSE)
