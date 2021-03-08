/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { getPackages } from '@lerna/project'
import filterPackages from '@lerna/filter-packages'
import batchPackages from '@lerna/batch-packages'
import typescript from '@wessberg/rollup-plugin-ts'
import commonjs from '@rollup/plugin-commonjs'
import { terser } from 'rollup-plugin-terser'

import resolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'
import path from 'path'
import minimist from 'minimist'

const external = [
  // Textile
  '@textile/threads-client',
  '@textile/context',
  '@textile/threads-id',
  '@textile/multiaddr',
  '@textile/security',
  '@textile/threads',
  '@textile/threaddb',
  '@textile/transport',
  '@textile/buckets',
  '@textile/crypto',
  '@textile/grpc-authentication',
  '@textile/grpc-connection',
  '@textile/hub',
  '@textile/hub-filecoin',
  '@textile/hub-threads-client',
  '@textile/users',
  // Others (add externals and valid es modules here)
  'stream',
  'fs',
  'path',
]

/**
 * @param {string[]}[scope] - packages to only build (if you don't
 *    want to build everything)
 * @param {string[]}[ignore] - packages to not build
 *
 * @returns {Promise<any[]>} - sorted list of Package objects that
 *    represent packages to be built.
 */
async function getSortedPackages(scope, ignore) {
  const packages = await getPackages(__dirname)
  const filtered = filterPackages(packages, scope, ignore, false, true)

  return batchPackages(filtered).reduce((arr, batch) => arr.concat(batch), [])
}

/**
 * @returns Promise<RollupConfig>
 */
async function main() {
  const config = []
  // Support --scope and --ignore globs if passed in via commandline
  const { scope, ignore } = minimist(process.argv.slice(2))
  const packages = await getSortedPackages(scope, ignore)
  packages.forEach((pkg) => {
    if (pkg.name.includes('buck-util')) return
    if (pkg.name.includes('buckr')) return
    /* Absolute path to package directory */
    const basePath = path.resolve(__dirname, pkg.location)
    /* Absolute path to input file */
    const input = path.join(basePath, 'src/index.ts')
    /* Push build config for this package. */
    config.push({
      input,
      output: [
        {
          exports: 'named',
          file: path.join(basePath, 'dist/esm/index.js'),
          format: 'es',
        },
      ],
      external,
      plugins: [
        json(),
        resolve({
          preferBuiltins: false,
          browser: true,
        }),
        commonjs(),
        typescript(),
        terser(),
      ],
      onwarn(warning, warn) {
        // suppress eval warnings
        if (warning.code === 'EVAL') return
        warn(warning)
      },
    })
  })
  return config
}

export default main()
