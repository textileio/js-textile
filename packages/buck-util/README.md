# @textile/buck-util

Node util for pushing buckets `buck-util`

**Install**

```bash
npm install @textile/buck-util
```

**Usage**

Push an updated root to your bucket

```bash
buck-util push -k {api-key} -s {api-secret} -t {thread-id} -n {bucket-name} -p {path-to-bucket}
```

Clean all files from the root of your bucket

```bash
buck-util clean -k {api-key} -s {api-secret} -t {thread-id} -n {bucket-name}
```

[Read the docs](https://textileio.github.io/js-textile/).
