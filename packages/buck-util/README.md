# @textile/buck-util

Node util for pushing buckets `buck-util`

**Install**

```bash
npm install @textile/buck-util
```

**Usage**

Push an updated root to your bucket

```bash
HUB_API_KEY=blp5ihqcs5zdryhc23fx2x7l5ru \
HUB_API_SECRET=b6dtmohcxvcd3uqnbpx6b7ygb6m7hu4cslgsoroy \
HUB_THREAD=bafku6ozemzot6fwazeolxag2kvd3c753nudnwat4mfoinatiffeicdi \
HUB_BUCKET_NAME=testsss \
buck-util push /test/website
```

Clean all files from the root of your bucket

```bash
HUB_API_KEY=blp5ihqcs5zdryhc23fx2x7l5ru \
HUB_API_SECRET=b6dtmohcxvcd3uqnbpx6b7ygb6m7hu4cslgsoroy \
HUB_THREAD=bafku6ozemzot6fwazeolxag2kvd3c753nudnwat4mfoinatiffeicdi \
HUB_BUCKET_NAME=testsss \
buck-util clean
```

[Read the docs](https://textileio.github.io/js-textile/).
