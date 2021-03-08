#!/usr/bin/env node
import yargs, {Argv} from 'yargs'
import { apiConn, execute, toDateString, RunOutput, getJSONTree } from './index'
import * as dotenv from 'dotenv'
import {
  bucketsList,
  bucketsCreate,
  bucketsMovePath,
  bucketsArchive,
  bucketsSetPath,
} from '@textile/buckets/dist/cjs/api'

dotenv.config()

yargs
  .command(
    'show', 
    'show all buckets in the thread.', 
    (yargs: Argv) => {
      return yargs
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
      .demandOption(['apiKey', 'apiSecret', 'thread'])
    },
    async function handler(argv) {
      if (!argv.apiKey || !argv.apiSecret || !argv.thread) throw Error("env variables missing")
      const conn = await apiConn(
        argv.apiKey,
        argv.apiSecret,
        argv.thread
      )

      const roots = await bucketsList(conn)
      for (const root of roots) {
        console.log(`${root.name} | ${root.key} | ${toDateString(root.createdAt)}`)
      }

    }
  )
  .command(
    'ls [name]', 
    'list bucket contents', 
    (yargs: Argv) => {
      return yargs
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
      .positional('name', {
        describe: 'Name of the bucket',
        type: 'string'
      })
      .demandOption(['apiKey', 'apiSecret', 'thread', 'name'])
    },
    async function handler(argv) {
      if (!argv.apiKey || !argv.apiSecret || !argv.thread) throw Error("env variables missing")
      const conn = await apiConn(
        // @ts-ignore
        argv.apiKey,
        argv.apiSecret,
        argv.thread
      )

      const roots = await bucketsList(conn)
      const existing = roots.find((bucket: any) => bucket.name === argv.name)

      if (!existing) {
        throw Error(`Bucket does not exist: ${argv.name}`)
      }
      const pathTree = await getJSONTree(conn, existing.key, argv.name, '')
      console.log(JSON.stringify(pathTree, null, 2))
    }
  )
  .command(
    'init [name]', 
    'init a new bucket', 
    (yargs: Argv) => {
      return yargs
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
      .positional('name', {
        describe: 'Name of the bucket',
        type: 'string'
      })
      .demandOption(['apiKey', 'apiSecret', 'thread', 'name'])
    },
    async function handler(argv) {
      if (!argv.apiKey || !argv.apiSecret || !argv.thread) throw Error("env variables missing")
      const conn = await apiConn(
        // @ts-ignore
        argv.apiKey,
        argv.apiSecret,
        argv.thread
      )

      const roots = await bucketsList(conn)
      const existing = roots.find((bucket: any) => bucket.name === argv.name)

      if (existing) {
        throw Error(`Bucket alread exist: ${argv.name}`)
      }
      const res = await bucketsCreate(conn, argv.name, false)
      console.log(JSON.stringify(res, null, 2))
    }
  )
  .command(
    'mv [name] [path] [dest]', 
    'mv a bucket path', 
    (yargs: Argv) => {
      return yargs
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
      .positional('name', {
        describe: 'Name of the bucket',
        type: 'string'
      })
      .positional('path', {
        describe: 'Existing path in bucket',
        type: 'string'
      })
      .positional('dest', {
        describe: 'Destination path in bucket',
        type: 'string'
      })
      .demandOption(['apiKey', 'apiSecret', 'thread', 'name', 'path', 'dest'])
    },
    async function handler(argv) {
      if (!argv.apiKey || !argv.apiSecret || !argv.thread) throw Error("env variables missing")
      const conn = await apiConn(
        // @ts-ignore
        argv.apiKey,
        argv.apiSecret,
        argv.thread
      )

      const roots = await bucketsList(conn)
      const existing = roots.find((bucket: any) => bucket.name === argv.name)

      if (!existing) {
        throw Error(`Bucket does not exist: ${argv.name}`)
      }
      
      await bucketsMovePath(conn, existing.key, argv.path, argv.dest)
      console.log("Success")
    }
  )
  .command(
    'set [name] [path] [cid]', 
    'adds the data of a cid to a path', 
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
      .positional('name', {
        describe: 'Name of the bucket',
        type: 'string'
      })
      .positional('path', {
        describe: 'Existing path in bucket',
        type: 'string'
      })
      .positional('cid', {
        describe: 'CID available from IPFS to set at path',
        type: 'string'
      })
      .demandOption(['apiKey', 'apiSecret', 'thread', 'name', 'path', 'cid'])
    },
    async function handler(argv) {
      if (!argv.apiKey || !argv.apiSecret || !argv.thread) throw Error("env variables missing")
      const conn = await apiConn(
        // @ts-ignore
        argv.apiKey,
        argv.apiSecret,
        argv.thread
      )

      const roots = await bucketsList(conn)
      const existing = roots.find((bucket: any) => bucket.name === argv.name)

      if (!existing) {
        throw Error(`Bucket does not exist: ${argv.name}`)
      }
      
      await bucketsSetPath(conn, existing.key, argv.path, argv.cid)
      console.log("Success")
    }
  )
  .command(
    'archive [name]', 
    'adds the data of a cid to a path', 
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
      .positional('name', {
        describe: 'Name of the bucket',
        type: 'string'
      })
      .demandOption(['apiKey', 'apiSecret', 'thread', 'name'])
    },
    async function handler(argv) {
      if (!argv.apiKey || !argv.apiSecret || !argv.thread) throw Error("env variables missing")
      const conn = await apiConn(
        // @ts-ignore
        argv.apiKey,
        argv.apiSecret,
        argv.thread
      )

      const roots = await bucketsList(conn)
      const existing = roots.find((bucket: any) => bucket.name === argv.name)

      if (!existing) {
        throw Error(`Bucket does not exist: ${argv.name}`)
      }
      
      await bucketsArchive(conn, existing.key)
      console.log("Success")
    }
  )
  .command(
    'push <path>', 
    'overwrite the root of a bucket with dir at path.', 
    (yargs: Argv) => {
      return yargs
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
      .positional('path', {
        describe: 'Path of dir to push',
        type: 'string'
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
      .demandOption(['apiKey', 'apiSecret', 'thread', 'bucketName', 'path'])
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
      .demandOption(['apiKey', 'apiSecret', 'thread', 'bucketName'])
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
