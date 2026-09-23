import { rollup } from 'rollup'
import test from 'tape-async'
import sizeCheck from '../index.js'

const chunk = bytes => ({ type: 'chunk', fileName: 'out.js', code: 'x'.repeat(bytes) })

const inspect = (options, output) => {
  const warnings = []
  const logs = []
  const originalLog = console.log
  console.log = message => logs.push(message)
  try {
    sizeCheck(options).generateBundle.call({
      warn: warning => warnings.push(warning),
      error: error => { throw Object.assign(new Error(error.message), error) }
    }, {}, { [output.fileName]: output })
  } finally {
    console.log = originalLog
  }
  return { warnings, logs }
}

test('reports sizes without a budget or tolerance', async t => {
  t.match(inspect(undefined, chunk(1025)).logs[0], /1\.00 KiB/, 'formats size in KiB')
  t.match(inspect({ expect: 2 }, chunk(1024)).logs[0], /\(-1\.00 KiB\)/, 'shows a signed decrease')
  t.match(inspect({ expect: 1 }, chunk(2048)).logs[0], /\(\+1\.00 KiB\)/, 'shows a signed increase')
})

test('compares exact bytes and includes both tolerance boundaries', async t => {
  for (const bytes of [512, 1024, 1025, 1536]) {
    t.equal(inspect({ expect: 1, warn: 0.5 }, chunk(bytes)).warnings.length, 0, `${bytes} bytes passes`)
  }
  for (const bytes of [511, 1537]) {
    const { warnings } = inspect({ expect: 1, warn: 0.5 }, chunk(bytes))
    t.equal(warnings.length, 1, `${bytes} bytes warns`)
    t.equal(warnings[0].code, 'FILESIZE_EXCEEDED', 'has a stable diagnostic code')
    t.match(warnings[0].message, new RegExp(`${bytes} bytes`), 'reports precise bytes')
  }
})

test('supports zero expectation and tolerance', async t => {
  t.equal(inspect({ expect: 0, warn: 0 }, chunk(0)).warnings.length, 0, 'empty output passes')
  t.equal(inspect({ expect: 0, warn: 0 }, chunk(1)).warnings.length, 1, 'one byte warns')
  t.equal(inspect({ expect: 1, warn: 0 }, chunk(1024)).warnings.length, 0, 'exact size passes')
  t.equal(inspect({ expect: 1, warn: 0 }, chunk(1025)).warnings.length, 1, 'one byte above warns')
})

test('measures UTF-8 chunks and string and binary assets', async t => {
  for (const output of [
    { type: 'chunk', fileName: 'out.js', code: 'é' },
    { type: 'asset', fileName: 'style.css', source: 'é' },
    { type: 'asset', fileName: 'image.bin', source: new Uint8Array([0, 255]) },
    { type: 'asset', fileName: 'buffer.bin', source: Buffer.from([0, 255]) }
  ]) {
    t.equal(inspect({ expect: 2 / 1024, warn: 0 }, output).warnings.length, 0, `${output.fileName} is two bytes`)
    t.equal(inspect({ expect: 0, warn: 0 }, output).warnings.length, 1, `${output.fileName} is checked`)
  }
})

const build = async (options, warnings) => rollup({
  input: 'virtual-entry',
  onwarn: warning => warnings.push(warning),
  plugins: [{
    name: 'fixture',
    resolveId: id => id === 'virtual-entry' ? id : null,
    load: () => 'export default 42',
    buildStart() {
      this.emitFile({ type: 'asset', fileName: 'style.css', source: 'body {}' })
    }
  }, sizeCheck(options)]
})

test('Rollup receives warnings for chunks and assets and still generates output', async t => {
  const warnings = []
  const bundle = await build({ expect: 0, warn: 0 }, warnings)
  try {
    const { output } = await bundle.generate({ format: 'es' })
    t.equal(output.length, 2, 'generates the chunk and asset')
    t.equal(warnings.length, 2, 'both outputs warn')
    t.ok(warnings.every(w => w.code === 'PLUGIN_WARNING' && w.pluginCode === 'FILESIZE_EXCEEDED'), 'uses Rollup diagnostics')
  } finally {
    await bundle.close()
  }
})

test('optional failure mode rejects the Rollup build', async t => {
  const bundle = await build({ expect: 0, warn: 0, failOnError: true }, [])
  try {
    try {
      await bundle.generate({ format: 'es' })
      t.fail('budget violation should reject generation')
    } catch (error) {
      t.equal(error.code, 'PLUGIN_ERROR', 'uses a Rollup error')
      t.equal(error.pluginCode, 'FILESIZE_EXCEEDED', 'identifies the budget violation')
      t.equal(error.plugin, 'filesize', 'identifies the plugin')
    }
  } finally {
    await bundle.close()
  }
})

test('failure mode permits sizes within tolerance', async t => {
  t.equal(inspect({ expect: 1, warn: 0, failOnError: true }, chunk(1024)).warnings.length, 0, 'matching output succeeds')
})
