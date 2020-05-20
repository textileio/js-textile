/* globals WorkerGlobalScope ServiceWorkerGlobalScope clients */

const registry = require('./test-registry')
const inPage =
  typeof window !== 'undefined' &&
  window.location &&
  typeof WorkerGlobalScope === 'undefined'
const inServiceWorker = !inPage &&
  typeof ServiceWorkerGlobalScope !== 'undefined' &&
  global instanceof ServiceWorkerGlobalScope
const inWorker = !inPage && !inServiceWorker &&
  typeof WorkerGlobalScope !== 'undefined' &&
  global instanceof WorkerGlobalScope
let _executionQueue = Promise.resolve()

function executionQueue (fn) {
  _executionQueue = _executionQueue.then(fn)
  return _executionQueue
}

const log = {
  info: (...args) => {
    executionQueue(() => global.polendinaLog(['info'].concat(args)))
    return executionQueue
  },
  // TODO
  warn: (...args) => {
    executionQueue(() => global.polendinaLog(['warn'].concat(args)))
    return executionQueue
  },
  // TODO
  error: (...args) => {
    executionQueue(() => global.polendinaLog(['error'].concat(args)))
    return executionQueue
  }
}

function setupWorkerGlobals () {
  global.polendinaLog = async function (...args) {
    global.postMessage(['polendinaLog'].concat(args))
  }

  global.polendinaWrite = async function (...args) {
    global.postMessage(['polendinaWrite'].concat(args))
  }

  global.polendinaEnd = async function (...args) {
    global.postMessage(['polendinaEnd'].concat(args))
  }
}

function setupServiceWorkerGlobals () {
  async function _postMessage (msg) {
    for (const client of await clients.matchAll()) {
      client.postMessage(msg)
    }
  }

  global.polendinaLog = async function (...args) {
    _postMessage(['polendinaLog'].concat(args))
  }

  global.polendinaWrite = async function (...args) {
    _postMessage(['polendinaWrite'].concat(args))
  }

  global.polendinaEnd = async function (...args) {
    _postMessage(['polendinaEnd'].concat(args))
  }
}

function setupLogging () {
  console.log = function (...args) {
    try {
      if (/BrowserStdout.*write/.test(new Error().stack)) {
        // the BrowserStdout polyfill (Mocha ships with among others) that converts
        // process.stdout.write() to console.log()
        // so we strip out the extra \n that necessarily inserts
        // args[0] = args[0].replace(/\n$/, '')
        executionQueue(() => global.polendinaWrite(args))
        return
      }
    } catch (err) {}
    log.info.apply(null, args)
  }

  // TODO: differentiate
  console.warn = log.warn
  console.error = log.error
}

async function setup () {
  if (inWorker) {
    setupWorkerGlobals()
  } else if (inServiceWorker) {
    await new Promise((resolve, reject) => {
      global.addEventListener('activate', (event) => {
        event.waitUntil(global.clients.claim())
        setupServiceWorkerGlobals()
        resolve()
      })
    })
  }

  setupLogging()
}

module.exports.executionQueue = executionQueue
module.exports.registry = registry
module.exports.log = log
module.exports.setup = setup
