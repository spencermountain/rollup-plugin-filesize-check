import test from 'tape'
import TapDance from 'tap-dancer'
import { pipeline } from 'node:stream'

const reporter = new TapDance()
reporter.on('complete', results => {
  if (!results.ok) process.exitCode = 1
})

pipeline(test.createStream(), reporter, process.stdout, error => {
  if (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
})
