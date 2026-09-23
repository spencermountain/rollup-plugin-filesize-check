import sizeCheck, { type SizeCheckOptions } from '../index.js'
import type { Plugin, RollupOptions } from 'rollup'

const options: SizeCheckOptions = { expect: 95, warn: 5, throw: 10, failOnError: true, color: 'auto' }
const plugin: Plugin = sizeCheck(options)
const config: RollupOptions = { plugins: [plugin, sizeCheck(), sizeCheck({ color: false })] }
void config
sizeCheck({ expect: 95, throw: 0 })

// @ts-expect-error Size budgets must be numbers.
sizeCheck({ expect: '95' })
// @ts-expect-error Tolerances must be numbers.
sizeCheck({ warn: '5' })
// @ts-expect-error Throw tolerances must be numbers.
sizeCheck({ throw: true })
// @ts-expect-error Failure mode must be boolean.
sizeCheck({ failOnError: 'true' })
// @ts-expect-error Only booleans and 'auto' are accepted for color.
sizeCheck({ color: 'red' })
// @ts-expect-error Unknown options should be rejected.
sizeCheck({ unknown: true })

sizeCheck({
  include: ['**/*.js', '**/*.css'],
  exclude: '**/*.map',
  budgets: [{ include: '**/*.js', exclude: 'vendor.js', expect: 95, throw: 5 }]
})
// @ts-expect-error File filters must be globs.
sizeCheck({ include: 12 })
// @ts-expect-error Every per-file budget needs a selector.
sizeCheck({ budgets: [{ expect: 95 }] })
// @ts-expect-error Per-file tolerances must be numeric.
sizeCheck({ budgets: [{ include: '*.js', throw: '5' }] })

const outputConfig: RollupOptions = {
  output: { format: 'umd', name: 'example', plugins: [sizeCheck({ expect: 200, warn: 5 })] }
}
void outputConfig
