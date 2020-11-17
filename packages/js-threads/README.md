# Textile's Threads protocol & database _(js-threads)_

[![Textile](https://img.shields.io/badge/made%20by-Textile-informational.svg)](https://textile.io)
[![Slack](https://img.shields.io/badge/slack-slack.textile.io-informational.svg)](https://slack.textile.io)
[![License](https://img.shields.io/github/license/textileio/js-threads.svg)](./LICENSE)
[![Release](https://img.shields.io/github/release/textileio/js-threads.svg)](https://github.com/textileio/js-threads/releases/latest)
[![Readme](https://img.shields.io/badge/readme-OK-green.svg)](https://github.com/RichardLitt/standard-readme)
[![Lerna](https://img.shields.io/badge/monorepo-lerna-cc00ff.svg)](https://lerna.js.org/)

![Tests](https://github.com/textileio/js-threads/workflows/Test/badge.svg)
[![Docs](https://img.shields.io/badge/docs-docs.textile.io-informational.svg)](https://docs.textile.io/)

> A protocol & event-sourced database for decentralized user-siloed data written in Typescript

## Using Threads

To get started using Threads, check out the [docs site](https://docs.textile.io/) and [API documentation](https://textileio.github.io/js-threads).

## Getting help

The Textile/Threads developers/community are active on [Slack](https://slack.textile.io/) and [Twitter (@textileio)](https://twitter.com/textileio), join us there for news, discussions, questions, and status updates. Also, [check out our blog](https://blog.textile.io) for the latest posts and announcements.

If you think you've found a bug in Threads, please file a Github issue. Take a look at our comprehensive [contributor guide](#contributing) for details on how to get started.

## Table of Contents

- [Textile's Threads protocol & database _(js-threads)_](#textiles-threads-protocol--database-js-threads)
  - [Using Threads](#using-threads)
  - [Getting help](#getting-help)
  - [Table of Contents](#table-of-contents)
  - [Security](#security)
  - [Background](#background)
  - [Install](#install)
  - [Usage](#usage)
  - [Authentication](#authentication)
  - [Developing](#developing)
  - [Releasing](#releasing)
  - [API](#api)
  - [Maintainers](#maintainers)
  - [Contributing](#contributing)
  - [License](#license)

## Security

ThreadDB is still under heavy development and no part of it should be used before a thorough review of the underlying code and an understanding APIs and protocols may change rapidly. There may be coding mistakes, and the underlying protocols may contain design flaws. Please [let us know](mailto:contact@textile.io) immediately if you have discovered a security vulnerability.

Please also read the [security note](https://github.com/ipfs/go-ipfs#security-issues) for [go-ipfs](https://github.com/ipfs/go-ipfs).

## Background

ThreadDB is an implementation of the database described in the paper entitled [_A protocol & event-sourced database for decentralized user-siloed data_](https://docsend.com/view/gu3ywqi). The code and libraries in this repo are the Javascript implementation and wrappers around our Go reference implementation (https://github.com/textileio/go-threads).

Go to [the docs](https://docs.textile.io/) for more about the motivations behind ThreadDB and Textile.

## Install

`js-threads` is implemented as a series of sub-packages. For general use, you can get most of what you need by simply installing and using the `@textile/threads` library.

```shell script
npm install --save @textile/threads
```

If you are running `js-threads` in an environment that does not support [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) by default (such as Node), be sure to include it explicitly by installing the `ws` module:

```bash
npm i ws
```

## Usage

For an introduction to use the `Database` class, read the [Threads Introduction here](https://docs.textile.io/threads/). Additionally, there are a growing list of [examples](https://github.com/textileio/js-examples) available.

## Authentication

Textile provides remote Threads APIs you can use when developing your app. See [`@textile/hub`](https://textileio.github.io/js-hub) (or [docs.textile.io](https://docs.textile.io)) for details on authenticating with these APIs, and how to set up your own local development peer.

## Developing

Underlying the Threads Database are a number of ideas and technologies, which are outlined in detail in the [Threads whitepaper](https://github.com/textileio/papers). These components are all housed within this [mono-repo](https://en.wikipedia.org/wiki/Monorepo).
This mono-repo is all managed by [lerna](https://github.com/lerna/lerna). You shouldn't have to do anything special to get started, however, here are a few steps that will make it easier to develop new functionality locally.

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

Similarly, you can compile the Typescript-based sub-packages to Javascript all at once.

```bash
npm run build
```

### Browsers

If you'd like to build browser bundles (say, using webpack), you may want to use something like the following in your `webpack.config.js`. Note however, that if you are working with a framework such as React or Angular, you might be better off letting that bundler handle the tree-shaking etc for you!

```javascript
const path = require('path')

module.exports = {
  entry: './src/index.ts',
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolveLoader: {
    modules: ['../../node_modules'],
  },
  resolve: {
    modules: ['./node_modules'],
    ['.tsx', '.ts', '.js', 'json'],
    symlinks: false,
  output: {
    filename: './[name].js',
    path: path.resolve(process.cwd(), 'dist'),
    library: 'threads',
    libraryTarget: 'var',
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
    minimize: true,
  },
}
```

The the bundle(s) can be built with:

```bash
cd packages/threads
webpack --mode production --config webpack.config.js
```

### Typescript

This project also uses incremental Typescript builds, so to take advantage of that (rather than building from scratch each time) use `compile`. You should notice significant speed-ups in your build process:

```shell script
npm run compile
```

## Releasing

This project utilises lerna's 'independent' release mode. So each time you run `lerna publish`, it will check for local updates and determine which packages have changed and need publishing. To do this locally, follow these steps:

1. Ensure you are on a clean master branch (we only want to release from master). If you have to, run `lerna clean && lerna bootstrap` to get to a clean state. If this produces new changes, then make sure you commit these (or reject them) before proceeding.
2. Ensure that webpack and webpack-cli are available. Ideally, install these globally. It is also a good idea to have typescript available globally. `npm i -g webpack webpack-cli typescript`
3. Ensure your git config does not specify signed tags. The `lerna` cli tool does not seem to be able to handle these at this time.
4. Ensure you are logged in to an npmjs.org account that has permission to publish to the @textile org/scope.
5. Run `lerna publish`, and sit back and wait. Ideally, this will go off without a hitch.

If it fails after creating tags and/or pushing the version updates to git, but before the actual npm publish completes, you should be able to 'recover' by running `lerna publish from-package`, which will attempt to publish new releases based on the versions available on npmjs.org. If it failed before or during tag creation, you might have to start over by dropping the version updates (`git checkout -- .`) and trying again. If `lerna` managed to _commit_ the changes, you can use something like `git reset --hard HEAD~1` to reset the last commit, followed by `git push --force --follow-tags` (if it was pushed to remote already and you are allowed to do pushes to master), **but check that the right commit was reverted first**.

See the [lerna docs](https://github.com/lerna/lerna#what-can-lerna-do) for other things you can do to make working across multiple packages easier. **Note**: If you are using `lerna` commands directly (as opposed to the ones wrapped in the package.json scripts), you'll want to install `lerna` globally to make your life easier: `npm i -g lerna`.

## API

See [the Textile docs](https://docs.textile.io/), which includes the API docs for public APIs.

## Maintainers

[Carson Farmer](https://github.com/carsonfarmer)

## Contributing

This project is a work in progress. As such, there's a few things you can do right now to help out:

- **Ask questions**! We'll try to help. Be sure to drop a note (on the above issue) if there is anything you'd like to work on and we'll update the issue to let others know. Also [get in touch](https://slack.textile.io) on Slack.
- **Open issues**, [file issues](https://github.com/textileio/js-threads/issues), submit pull requests!
- **Perform code reviews**. More eyes will help a) speed the project along b) ensure quality and c) reduce possible future bugs.
- **Take a look at the code**. Contributions here that would be most helpful are **top-level comments** about how it should look based on your understanding. Again, the more eyes the better.
- **Add tests**. There can never be enough tests.
- **PRs gratefully accepted!**

Please also see [the contributing guide](./CONTRIBUTING.md) for details on getting started.

## License

[MIT](./LICENSE) (c) 2019-2020 Textile
