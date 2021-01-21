#!/usr/bin/env node

import yargs, {Argv, string} from "yargs"
import { execute, RunOutput } from './index'

// Example:
// buckjs push --api=http://127.0.0.1:3007 -k blp5ihqcs5zdryhc23fx2x7l5ru -s b6dtmohcxvcd3uqnbpx6b7ygb6m7hu4cslgsoroy -t bafku6ozemzot6fwazeolxag2kvd3c753nudnwat4mfoinatiffeicdi -n test -p /Users/andrewhill/Textile/textile/js-textile/packages/buckets-node-sync/test/website
// buckjs clean --api=http://127.0.0.1:3007 -k blp5ihqcs5zdryhc23fx2x7l5ru -s b6dtmohcxvcd3uqnbpx6b7ygb6m7hu4cslgsoroy -t bafku6ozemzot6fwazeolxag2kvd3c753nudnwat4mfoinatiffeicdi -n test

yargs
  .command(
    "push", 
    "push updates to remote bucket.", 
    (yargs: Argv) => {
      return yargs
      .option('key', {
          alias: 'k',
          type: "string",
          describe: "API key",
      })
      .option('secret', {
          alias: 's',
          type: "string",
          describe: "API secret",
      })
      .option('path', {
          alias: 'p',
          type: "string",
          describe: "Path of dir to push",
      })
      .option('thread', {
          alias: 't',
          type: "string",
          describe: "ThreadID of bucket",
      })
      .option('name', {
          alias: 'n',
          type: "string",
          describe: "Name of bucket",
      })
      .option('pattern', {
          alias: 'g',
          describe: "Glob pattern",
          default: "*/**",
      })
      .option('api', {
          type: "string",
          describe: "API",
      })
      .demandOption(['key', 'secret', 'name', 'thread', 'path'])
    },
    async function handler(argv) {
      const output = await execute(
        argv.api || "",
        argv.key,
        argv.secret,
        argv.thread,
        argv.name,
        "false",
        argv.pattern,
        argv.path,
        "",
      )
      const json = pp(output)
      console.log(json)
      return json
    }
  )
  .command(
    "clean", 
    "remove all files from remote bucket.", 
    (yargs: Argv) => {
      return yargs
      .option('key', {
          alias: 'k',
          type: "string",
          describe: "API key",
      })
      .option('secret', {
          alias: 's',
          type: "string",
          describe: "API secret",
      })
      .option('thread', {
          alias: 't',
          type: "string",
          describe: "ThreadID of bucket",
      })
      .option('name', {
          alias: 'n',
          type: "string",
          describe: "Name of bucket",
      })
      .option('api', {
          type: "string",
          describe: "API",
      })
      .demandOption(['key', 'secret', 'name', 'thread'])
    },
    async function handler(argv) {
      const output = await execute(
        argv.api || "",
        argv.key,
        argv.secret,
        argv.thread,
        argv.name,
        "true",
        "",
        "",
        "",
      )
      const json = pp(output)
      console.log(json)
      return json
    }
  ).argv;

// pretty print format
function pp(map: RunOutput): string {
  const mm: { [key: string]: string } = {}
  for (const [k, v] of map.entries()) {
    mm[k] = v
  }
  return JSON.stringify(mm, null, 2);
}