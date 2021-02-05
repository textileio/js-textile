#!/usr/bin/env node
import yargs, {Argv} from 'yargs'
import { execute, RunOutput } from './index'
import * as dotenv from 'dotenv'

dotenv.config()

yargs
  .command(
    'push <path>', 
    'overwrite the root of a bucket with dir at path.', 
    (yargs: Argv) => {
      return yargs
      .positional('path', {
        describe: 'Path of dir to push',
        type: 'string'
      })
      .option('apiKey', {
          alias: 'k',
          type: 'string',
          describe: 'API key',
      })
      .option('apiSecret', {
          alias: 's',
          type: 'string',
          describe: 'API secret',
      })
      .option('thread', {
          alias: 't',
          type: 'string',
          describe: 'ThreadID of bucket',
      })
      .option('bucketName', {
          alias: 'n',
          type: 'string',
          describe: 'Name of bucket',
      })
      .option('globPattern', {
          alias: 'g',
          describe: 'Glob pattern',
          default: '**/*',
      })
      .option('api', {
          type: 'string',
          describe: 'API',
      })
      .demandOption(['apiKey', 'apiSecret', 'bucketName', 'thread', 'path'])
    },
    async function handler(argv) {
      const output = await execute(
        argv.api || '',
        argv.apiKey,
        argv.apiSecret,
        argv.thread,
        argv.bucketName,
        'false',
        argv.globPattern,
        argv.path,
        '',
      )
      pretty(output)
    }
  )
  .command(
    'clean', 
    'remove all files from remote bucket.', 
    (yargs: Argv) => {
      return yargs
      .option('apiKey', {
          alias: 'k',
          type: 'string',
          describe: 'API key'
      })
      .option('apiSecret', {
          alias: 's',
          type: 'string',
          describe: 'API secret',
      })
      .option('thread', {
          alias: 't',
          type: 'string',
          describe: 'ThreadID of bucket',
      })
      .option('bucketName', {
          alias: 'n',
          type: 'string',
          describe: 'Name of bucket',
      })
      .option('api', {
          type: 'string',
          describe: 'API',
      })
      .demandOption(['apiKey', 'apiSecret', 'bucketName', 'thread'])
    },
    async function handler(argv) {
      const output = await execute(
        argv.api || '',
        argv.apiKey,
        argv.apiSecret,
        argv.thread,
        argv.bucketName,
        'true',
        '',
        '',
        '',
      )
      pretty(output)
    }
  )
  .fail(function(msg: string, err: Error) {
      if (msg && msg != '') {
        console.log('Error:', msg)
      }
      if (err && err.message && err.message != '') {
        if (err.message == 'Response closed without headers') {
          console.log('Error: Connection to remote API failed')
        } else {
          console.log('Error:', err.message)
        }
      }
      process.exit(1);
  })
  .env('HUB')
  .help()
  .argv;

// pretty print format
function pretty(map: RunOutput) {
  const mm: { [key: string]: string } = {}
  for (const [k, v] of map.entries()) {
    mm[k] = v
  }
  console.log(
    JSON.stringify(mm, null, 2)
  )
}
