/* globals mocha Mocha */

// in-browser setup and runner for Mocha, at end of bundle

require('mocha/mocha.js')
const { registry, executionQueue, log, setup } = require('./common-run')

function runMocha () {
  mocha.setup({ reporter: registry.argv.mochaReporter, ui: 'bdd' })
  // mocha@7 deprecated useColors()
  if (typeof mocha.color === 'function') {
    mocha.color(true)
  } else if (typeof mocha.useColors === 'function') {
    mocha.useColors(true)
  }

  // the well-behaved reporters, like spec, are easy to intercept
  Mocha.reporters.Base.consoleLog = log.info

  for (const mod of registry.tests) {
    mod.load()
  }

  let errors = 0
  mocha
    .run((_errors) => { errors = _errors })
    .on('end', (...args) => {
      executionQueue(() => global.polendinaEnd(errors))
    })
}

setup().then(runMocha)
