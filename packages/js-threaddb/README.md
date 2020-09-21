Javascript implementation of Textile's ThreadDB

> An offline-first local db that syncs to the distributed web.

**This project is pre-release, do not use it in production, breaking changes will still occur without notice.**
 
## Getting Started

### Development

Start by cloning and digging into this repo:

```bash
git clone git@github.com:textileio/thread-db.git
cd thread-db
```

Next, install the required `npm` modules:

```bash
npm i
```

### Tests

For now, you'll need to have a local `threadd` daemon running. The easiest way to do this is via
`docker-compose`. You can use the following `docker-compose.yml` file:

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

Test coverage is pretty comprehensive, and you should get a coverage report upon running the tests
(coverage is generated from the node tests):

```bash
npm run test:node
```

Browser tests are run via `polendina`, and the tests are built on-the-fly using webpack (this is
the only thing webpack is used for). The `webpack.test.js` config is used to enable `polendina`
testing in typescript modules.

```bash
npm run test:browser
```

### Build

We don't actually use `tsc` to build our javascript outputs. Instead, we use `rollup`, which
makes it easier to derive different output types (e.g., commonjs vs es modules vs type defs). To
create the relevant build outputs simply call:

```bash
npm run build
```

This should produce a dist folder with multiple output types. These are referenced in the
`package.json`'s `exports` entry, so that the right module types are used in the right context
(i.e., `import` vs `require`). Note that an `iife` output for browsers is also created, though
the es modules should be the preferred option for browsers these days.

### Releasing

We'll try to be pretty serious about semantic versioning. To help us with this, we use conventional
commits (and some `commitlint` hooks/linters) as well as automatically-generated conventional
changelogs (via `standard-version`). To create a new version/release simply call:

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

These settings pair nicely with the `hbenl.vscode-mocha-test-adapter` and
`ryanluker.vscode-coverage-gutters` plugins. I also highly recommend `dbaeumer.vscode-eslint` for
in-editor linting. Note that we also use prettier for code formatting (called via eslint).
