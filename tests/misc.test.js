import { rollup } from 'rollup'
import test from 'tape-async'
import { existsSync } from 'fs'
import sizeCheck from '../index.js'

const output = { file: './tests/_out.js', format: 'umd' }

test('no-expect-test', async function (t) {
  t.ok(true, 'didnt crash')
  const bundle = await rollup({
    input: './tests/tmp.js',
    plugins: [sizeCheck()]
  })
  t.ok(true, 'didnt crash')
  await bundle.write(output)
  t.ok(existsSync('./tests/_out.js'), 'made file')
})
test('no-warn-test', async function (t) {
  const bundle = await rollup({
    input: './tests/tmp.js',
    plugins: [sizeCheck({ expect: 2 })]
  })
  t.ok(true, 'didnt crash')
  await bundle.write(output)
  t.ok(existsSync('./tests/_out.js'), 'made file')
})

test('pass-test', async function (t) {
  const bundle = await rollup({
    input: './tests/tmp.js',
    plugins: [sizeCheck({ expect: 2, warn: 2 })]
  })
  t.ok(true, 'didnt crash')
  await bundle.write(output)
  t.ok(existsSync('./tests/_out.js'), 'made file')
})

test('fail-test', async function (t) {
  const bundle = await rollup({
    input: './tests/tmp.js',
    plugins: [sizeCheck({ expect: 12, warn: 2 })]
  })
  t.ok(true, 'didnt crash')
  await bundle.write(output)
  t.ok(existsSync('./tests/_out.js'), 'made file')
})
