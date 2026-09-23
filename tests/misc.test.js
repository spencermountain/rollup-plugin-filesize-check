/* eslint-disable no-console */
import { rollup } from 'rollup'
import test from 'tape'
import sizeCheck from '../index.js'

const chunk = bytes => ({ type: 'chunk', fileName: 'out.js', code: 'x'.repeat(bytes) })

const inspect = (options, output) => {
  const warnings = []
  const logs = []
  const originalLog = console.error
  console.error = message => logs.push(message)
  try {
    // Wording assertions should not depend on whether the runner has a terminal.
    // Color tests explicitly opt into true or 'auto'.
    const plugin = sizeCheck({ color: false, ...options })
    const context = {
      warn: warning => warnings.push(warning),
      error: error => { throw Object.assign(new Error(error.message), error) }
    }
    plugin.renderStart.call(context)
    const outputs = Array.isArray(output) ? output : [output]
    plugin.generateBundle.handler.call(context, {}, Object.fromEntries(outputs.map(item => [item.fileName, item])))
  } finally {
    console.error = originalLog
  }
  return { warnings, logs }
}

test('reports sizes without a budget or tolerance', async t => {
  t.match(inspect(undefined, chunk(1025)).logs[0], /1\.00kb/, 'formats size with the compact kb label')
  t.match(inspect({ expect: 2 }, chunk(1024)).logs[0], /\(-1\.00kb\)/, 'shows a signed decrease')
  t.match(inspect({ expect: 1 }, chunk(2048)).logs[0], /\(\+1\.00kb\)/, 'shows a signed increase')
})

test('compares exact bytes and includes both tolerance boundaries', async t => {
  for (const bytes of [512, 1024, 1025, 1536]) {
    t.equal(inspect({ expect: 1, warn: 0.5 }, chunk(bytes)).warnings.length, 0, `${bytes} bytes passes`)
  }
  for (const bytes of [511, 1537]) {
    const { warnings } = inspect({ expect: 1, warn: 0.5 }, chunk(bytes))
    t.equal(warnings.length, 1, `${bytes} bytes warns`)
    t.equal(warnings[0].code, 'FILESIZE_EXCEEDED', 'has a stable diagnostic code')
    t.equal(warnings[0].bytes, bytes, 'provides precise bytes in diagnostic metadata')
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

test('uses explicit status labels and consistent severity colors', async t => {
  const report = inspect({ color: true }, chunk(1024)).logs[0]
  t.match(report, /Filesize:/, 'report-only output is labeled')
  t.match(report, /Filesize:  \x1b\[36m/, 'report label stays neutral and filename is cyan')
  const pass = inspect({ expect: 1, warn: 1, color: true }, chunk(1536))
  t.deepEqual(pass.logs, [], 'passing checks are silent even when colors are enabled')
  t.deepEqual(pass.warnings, [], 'an allowed increase does not warn')
  for (const bytes of [0, 2048]) {
    const warning = inspect({ expect: 1, warn: 0, color: true }, chunk(bytes)).warnings[0]
    t.ok(warning.message.trimStart().startsWith('\x1b[33m'), 'either direction outside tolerance is yellow')
    t.match(warning.message, /Filesize warning:/, 'warning has a text label')
  }
  t.throws(() => inspect({ expect: 0, warn: 0, failOnError: true, color: true }, chunk(1)), /\x1b\[31m.*Size check failed:/, 'failure is red and labeled')
  const plain = inspect({ color: false }, chunk(1024)).logs[0]
  t.notOk(plain.includes('\x1b['), 'color false disables ANSI')
  const warning = inspect({ expect: 0, warn: 0, color: false }, chunk(1)).warnings[0]
  t.notOk(warning.message.includes('\x1b['), 'color false also applies to diagnostics')
  t.match(warning.message, /above limit of 0kb  - over by 1 B/, 'one-byte differences do not round to zero')
})

test('automatic colors respect terminal capabilities and NO_COLOR', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY')
  const oldNoColor = process.env.NO_COLOR
  const oldTerm = process.env.TERM
  const report = () => inspect({ color: 'auto' }, chunk(1024)).logs[0]
  try {
    delete process.env.NO_COLOR
    process.env.TERM = 'xterm'
    Object.defineProperty(process.stderr, 'isTTY', { configurable: true, value: false })
    t.notOk(report().includes('\x1b['), 'redirected output has no ANSI')
    Object.defineProperty(process.stderr, 'isTTY', { configurable: true, value: true })
    t.ok(report().includes('\x1b[36m'), 'interactive terminal gets a cyan filename')
    process.env.NO_COLOR = ''
    t.notOk(report().includes('\x1b['), 'NO_COLOR disables ANSI')
    delete process.env.NO_COLOR
    process.env.TERM = 'dumb'
    t.notOk(report().includes('\x1b['), 'dumb terminals have no ANSI')
  } finally {
    if (descriptor) Object.defineProperty(process.stderr, 'isTTY', descriptor)
    else delete process.stderr.isTTY
    if (oldNoColor === undefined) delete process.env.NO_COLOR
    else process.env.NO_COLOR = oldNoColor
    if (oldTerm === undefined) delete process.env.TERM
    else process.env.TERM = oldTerm
  }
})

test('independent warning and failure tolerances check both directions', async t => {
  const options = { expect: 2, warn: 0.5, throw: 1, color: false }
  for (const bytes of [1536, 2048, 2560]) {
    t.deepEqual(inspect(options, chunk(bytes)), { warnings: [], logs: [] }, `${bytes} bytes passes silently including warning boundaries`)
  }
  for (const bytes of [1024, 1535, 2561, 3072]) {
    const result = inspect(options, chunk(bytes))
    t.equal(result.warnings.length, 1, `${bytes} bytes only warns including failure boundaries`)
    t.equal(result.warnings[0].toleranceKiB, 0.5, 'warning uses its own tolerance')
  }
  for (const bytes of [1023, 3073]) {
    let failure
    try {
      inspect(options, chunk(bytes))
    } catch (error) {
      failure = error
    }
    t.equal(failure?.failures[0].toleranceKiB, 1, `${bytes} bytes fails with its own tolerance`)
  }
})

test('throw works independently, including zero tolerance and expectation', async t => {
  t.deepEqual(inspect({ expect: 0, throw: 0 }, chunk(0)), { warnings: [], logs: [] }, 'empty output matches zero silently')
  t.throws(() => inspect({ expect: 0, throw: 0 }, chunk(1)), /Size check failed:/, 'one byte violates zero tolerance')
  for (const bytes of [1023, 1025]) {
    t.throws(() => inspect({ expect: 1, throw: 0 }, chunk(bytes)), /Size check failed:/, 'zero tolerance fails in either direction')
  }
  const missing = inspect({ throw: 0 }, chunk(1))
  t.match(missing.logs[0], /Filesize:/, 'expectation is required to check a tolerance')
  t.equal(missing.warnings[0].code, 'INVALID_SIZE_BUDGET', 'missing expectation produces a warning')
  t.throws(() => inspect({ expect: 1, warn: 10, throw: 0 }, chunk(1025)), /Size check failed:/, 'failure does not depend on exceeding warn')
  t.equal(inspect({ expect: 1, warn: 0, throw: 1, failOnError: true }, chunk(1025)).warnings.length, 1, 'explicit throw overrides failOnError')
})

test('throw rejects Rollup generation with a plugin error', async t => {
  const warnings = []
  const bundle = await build({ expect: 0, warn: 0, throw: 0, color: true }, warnings)
  try {
    try {
      await bundle.generate({ format: 'es' })
      t.fail('throw threshold should reject generation')
    } catch (error) {
      t.equal(error.code, 'PLUGIN_ERROR', 'uses a Rollup error')
      t.equal(error.pluginCode, 'FILESIZE_EXCEEDED', 'identifies the budget violation')
      t.match(error.message, /\x1b\[31m.*Size check failed:/, 'failure output is red')
      t.equal(warnings.length, 0, 'failure takes priority without also warning')
    }
  } finally {
    await bundle.close()
  }
})

test('rejects invalid options before building', async t => {
  for (const key of ['expect', 'warn', 'throw']) {
    for (const value of [-1, NaN, Infinity, '1', null, Number.MAX_VALUE]) {
      t.throws(() => sizeCheck({ [key]: value }), new RegExp(`options.${key}`), `${key} rejects ${value}`)
    }
  }
  for (const options of [null, false, [], 'bad', { typo: 1 }, { failOnError: 1 }, { color: 'red' }, { include: 1 }, { exclude: [''] }, { budgets: {} }, { budgets: [null] }, { budgets: [{}] }, { budgets: [{ include: '*.js', throw: -1 }] }]) {
    t.throws(() => sizeCheck(options), TypeError, 'invalid configuration is rejected')
  }
  const missing = inspect({ warn: 1, throw: 2 }, chunk(1))
  t.equal(missing.warnings.length, 1, 'one configuration warning for missing expectation')
  t.equal(missing.warnings[0].code, 'INVALID_SIZE_BUDGET', 'uses a distinct warning code')
  t.match(inspect({ expect: 1, failOnError: true }, chunk(1)).warnings[0].message, /requires warn/, 'ineffective failure switch warns')
  t.equal(inspect({ expect: 0, warn: 0, throw: 0 }, chunk(0)).warnings.length, 0, 'zero values remain valid')
})

const namedChunk = (fileName, bytes) => ({ ...chunk(bytes), fileName })

test('filters output-relative globs and gives exclusions priority', async t => {
  const outputs = [namedChunk('app.js', 0), namedChunk('nested/app.js', 1), namedChunk('.hidden.js', 0), namedChunk('app.js.map', 1), { type: 'asset', fileName: 'style.css', source: '' }]
  const result = inspect({ include: '**/*.js', exclude: 'nested/**' }, outputs)
  t.equal(result.logs.length, 2, 'includes root and hidden JS, excluding nested JS, maps, and CSS')
  t.equal(inspect({ include: [] }, outputs).logs.length, 0, 'empty include selects nothing')
  t.equal(inspect({ include: ['*.js', '*.css'], exclude: [] }, outputs).logs.length, 3, 'arrays select multiple output types')
  t.equal(inspect({ exclude: '**/*' }, outputs).logs.length, 0, 'all-excluded output is valid')
})

test('per-file budgets are independent, first-match wins, and unmatched files use defaults', async t => {
  const options = {
    expect: 0, throw: 0,
    budgets: [
      { include: 'app.js', expect: 1, throw: 0 },
      { include: '**/*.js', exclude: 'vendor.js', expect: 2, throw: 0 },
      { include: '**/*.css', expect: 3, throw: 0 }
    ]
  }
  const outputs = [namedChunk('app.js', 1024), namedChunk('nested/app.js', 2048), namedChunk('vendor.js', 0), { type: 'asset', fileName: 'style.css', source: 'x'.repeat(3072) }, namedChunk('other.txt', 0)]
  t.deepEqual(inspect(options, outputs), { warnings: [], logs: [] }, 'each output passes its selected budget silently')
  t.match(inspect({ expect: 0, throw: 0, budgets: [{ include: '*.js' }] }, chunk(1024)).logs[0], /Filesize:/, 'a report-only rule does not inherit global limits')
  const missing = inspect({ budgets: [{ include: '*.js', throw: 0 }] }, chunk(1))
  t.match(missing.warnings[0].message, /budgets\[0\].*expect/, 'incomplete rule warns with its index')
})

test('collects every failure and continues reporting other outputs', async t => {
  const warnings = []
  const logs = []
  const errors = []
  const plugin = sizeCheck({ color: false, expect: 1, throw: 0, budgets: [{ include: 'warn.js', expect: 0, warn: 0 }] })
  const originalLog = console.error
  console.error = message => logs.push(message)
  try {
    plugin.generateBundle.handler.call({
      warn: warning => warnings.push(warning),
      error: error => errors.push(error)
    }, {}, Object.fromEntries([namedChunk('small.js', 0), namedChunk('pass.js', 1024), namedChunk('warn.js', 1), namedChunk('large.js', 2048)].map(output => [output.fileName, output])))
  } finally {
    console.error = originalLog
  }
  t.equal(errors.length, 1, 'emits one combined error')
  t.deepEqual(errors[0].fileNames, ['small.js', 'large.js'], 'both failing files are identified')
  t.match(errors[0].message, /small\.js/, 'reports undersized output')
  t.match(errors[0].message, /large\.js/, 'reports oversized output')
  t.equal(warnings.length, 1, 'still reports the warning')
  t.equal(logs.length, 1, 'passing output stays silent in a mixed build')
  t.match(logs[0], /Filesize warning:.*warn\.js/, 'only the warning is printed before the error')
})

test('post hook observes later ordinary hooks and warnings reach Rollup', async t => {
  const warnings = []
  const bundle = await rollup({
    input: 'virtual-entry',
    onwarn: warning => warnings.push(warning),
    plugins: [sizeCheck({ expect: 0, throw: 0, include: '**/*.js', budgets: [{ include: '*.css', warn: 1 }] }), {
      name: 'late-fixture',
      resolveId: id => id,
      load: () => 'export default 42',
      generateBundle(_options, output) {
        for (const file of Object.values(output)) if (file.type === 'chunk') file.code = ''
        this.emitFile({ type: 'asset', fileName: 'extra.js', source: 'x' })
        this.emitFile({ type: 'asset', fileName: 'second.js', source: 'xx' })
      }
    }]
  })
  try {
    try {
      await bundle.generate({ format: 'es' })
      t.fail('late-emitted assets must fail')
    } catch (error) {
      t.deepEqual(error.fileNames, ['extra.js', 'second.js'], 'measures final chunk and sees both late assets')
      t.equal(error.pluginCode, 'FILESIZE_EXCEEDED', 'uses combined Rollup diagnostic')
    }
    t.equal(warnings[0].pluginCode, 'INVALID_SIZE_BUDGET', 'configuration warning reaches onwarn')
  } finally {
    await bundle.close()
  }
})

test('output plugins keep WARN rows visible with silent logging', async t => {
  const warnings = []
  const logs = []
  const bundle = await rollup({
    input: 'virtual-entry',
    logLevel: 'silent',
    onwarn: warning => warnings.push(warning),
    plugins: [{ name: 'fixture', resolveId: id => id, load: () => 'export default 42' }]
  })
  const originalLog = console.error
  try {
    console.error = message => logs.push(message)
    await bundle.generate({ format: 'es', plugins: [sizeCheck({ expect: 200, warn: 5, color: false })] })
  } finally {
    console.error = originalLog
    await bundle.close()
  }
  t.equal(logs.length, 1, 'prints one compact report row')
  t.match(logs[0], /Filesize warning:.*virtual-entry\.js.*below limit/, 'undersized output remains visible under silent logging')
  t.equal(warnings.length, 0, 'Rollup still suppresses warning diagnostics')
})

test('output-plugin configuration warnings use output hooks and throw still fails silently', async t => {
  const warnings = []
  const bundle = await rollup({
    input: 'virtual-entry',
    onwarn: warning => warnings.push(warning),
    plugins: [{ name: 'fixture', resolveId: id => id, load: () => 'export default 42' }]
  })
  try {
    await bundle.generate({ format: 'es', plugins: [sizeCheck({ throw: 0, include: [] })] })
    t.equal(warnings.length, 1, 'only the intended configuration warning is emitted')
    t.equal(warnings[0].pluginCode, 'INVALID_SIZE_BUDGET', 'configuration validation runs for output plugins')
  } finally {
    await bundle.close()
  }
  const silent = await rollup({
    input: 'virtual-entry',
    logLevel: 'silent',
    plugins: [{ name: 'fixture', resolveId: id => id, load: () => 'export default 42' }]
  })
  try {
    try {
      await silent.generate({ format: 'es', plugins: [sizeCheck({ expect: 200, throw: 5, color: false })] })
      t.fail('silent mode must not disable failure enforcement')
    } catch (error) {
      t.equal(error.pluginCode, 'FILESIZE_EXCEEDED', 'throw rejects generation even in silent mode')
    }
  } finally {
    await silent.close()
  }
})
