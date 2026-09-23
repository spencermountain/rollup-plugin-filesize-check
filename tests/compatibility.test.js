/* eslint-disable no-console */
import test from 'tape'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import sizeCheck from '../index.js'

// Set ROLLUP_TEST_MODULE to an installed Rollup package or entry point to check another version.
const require = createRequire(import.meta.url)
const rollupPath = require.resolve(process.env.ROLLUP_TEST_MODULE || 'rollup')
const { rollup, VERSION } = await import(rollupPath)
const fixture = () => ({
  name: 'fixture',
  resolveId: id => id,
  load: () => 'export default 42',
  generateBundle(_options, output) {
    for (const item of Object.values(output)) if (item.type === 'chunk') item.code = 'x'.repeat(1024)
    this.emitFile({ type: 'asset', fileName: 'style.css', source: 'x'.repeat(2048) })
    this.emitFile({ type: 'asset', fileName: 'image.bin', source: new Uint8Array([0, 255]) })
  }
})

for (const placement of ['input', 'output']) {
  test(`Rollup ${VERSION}: ${placement} plugin budgets, assets and late hooks`, async t => {
    const warnings = []
    const logs = []
    const plugin = sizeCheck({
      expect: 0, throw: 0, exclude: '**/*.bin', color: false,
      budgets: [
        { include: '**/*.js', expect: 1, throw: 0 },
        { include: '**/*.css', expect: 2, throw: 0 }
      ]
    })
    const bundle = await rollup({
      input: 'entry', onwarn: warning => warnings.push(warning),
      plugins: placement === 'input' ? [plugin, fixture()] : [fixture()]
    })
    const originalError = console.error
    try {
      console.error = line => logs.push(line)
      await bundle.generate({ format: 'es', plugins: placement === 'output' ? [plugin] : [] })
    } finally {
      console.error = originalError
      await bundle.close()
    }
    t.equal(warnings.length, 0, 'no unsupported hook or budget warnings')
    t.equal(logs.length, 2, 'selected chunk and asset pass after the ordinary hook runs')
    t.ok(logs.every(line => line.includes('Filesize ok:')), 'each file passes its own exact budget')
  })

  test(`Rollup ${VERSION}: ${placement} warnings and aggregate failures`, async t => {
    const warnings = []
    const options = { expect: 0, throw: 0, color: false, budgets: [{ include: '**/*.bin', expect: 0, warn: 0 }] }
    const plugin = sizeCheck(options)
    const bundle = await rollup({
      input: 'entry', onwarn: warning => warnings.push(warning),
      plugins: placement === 'input' ? [plugin, fixture()] : [fixture()]
    })
    const originalError = console.error
    let failure
    try {
      console.error = () => {}
      await bundle.generate({ format: 'es', plugins: placement === 'output' ? [plugin] : [] })
    } catch (error) {
      failure = error
    } finally {
      console.error = originalError
      await bundle.close()
    }
    t.ok(failure, 'generation rejects')
    t.equal(failure?.pluginCode, 'FILESIZE_EXCEEDED', 'error code survives Rollup wrapping')
    t.deepEqual(failure?.fileNames?.slice().sort(), ['entry.js', 'style.css'], 'all failures are retained')
    t.equal(warnings.length, 1, 'remaining asset still warns')
    t.equal(warnings[0]?.pluginCode, 'FILESIZE_EXCEEDED', 'warning code survives Rollup wrapping')
  })
}

test(`Rollup ${VERSION}: actual silent CLI warnings and failures`, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'filesize-compat-'))
  const config = join(directory, 'rollup.config.mjs')
  // All supported versions expose their CLI alongside the resolved JS entry point.
  const cli = join(rollupPath, '..', 'bin', 'rollup')
  try {
    for (const threshold of ['warn', 'throw']) {
      writeFileSync(config, `
import sizeCheck from ${JSON.stringify(new URL('../index.js', import.meta.url).href)}
export default {
  input: 'entry',
  plugins: [{ name: 'fixture', resolveId: id => id, load: () => 'export default 42' }],
  output: { file: ${JSON.stringify(join(directory, 'out.js'))}, format: 'es', plugins: [sizeCheck({ expect: 200, ${threshold}: 5, color: false })] }
}
`)
      const result = spawnSync(process.execPath, [cli, '-c', config, '--silent'], { encoding: 'utf8' })
      t.equal(result.status, threshold === 'warn' ? 0 : 1, `${threshold} has the correct exit status`)
      t.match(result.stderr, threshold === 'warn' ? /Filesize warning:/ : /Size check failed:/, 'size report remains visible')
      t.notOk(result.stderr.includes('RollupError'), 'no redundant RollupError prefix')
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
