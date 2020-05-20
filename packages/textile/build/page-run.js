/* globals self Worker */

// loaded as script file in index.html, determines how to load the bundle

const isWorkerMode = /mode=worker/.test(window.location.search)
const isServiceWorkerMode = /mode=serviceworker/.test(window.location.search)
const _consoleLog = console ? console.log : () => {}

function runPage () {
  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.src = 'bundle.js'
  document.head.appendChild(script)
}

function onWorkerMessage (msg) {
  if (!Array.isArray(msg.data)) {
    return
  }

  if (!self[msg.data[0]]) {
    _consoleLog.apply(console, msg.data)
  } else {
    self[msg.data[0]].apply(null, msg.data.slice(1))
  }
}

function runWorker () {
  const worker = new Worker('bundle.js')
  worker.addEventListener('message', onWorkerMessage, false)
}

function runServiceWorker () {
  navigator.serviceWorker.register('bundle.js', { scope: './' })
  navigator.serviceWorker.addEventListener('message', onWorkerMessage, false)
}

window.addEventListener('load', () => {
  if (isWorkerMode) {
    runWorker()
  } else if (isServiceWorkerMode) {
    runServiceWorker()
  } else {
    runPage()
  }
})
