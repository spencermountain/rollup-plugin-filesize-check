<div align="center">
  <div><b>rollup-plugin-filesize-check</b></div>
  <div>
    <a href="https://npmjs.org/package/rollup-plugin-filesize-check">
    <img src="https://img.shields.io/npm/v/rollup-plugin-filesize-check.svg?style=flat-square" />
  </a>
  <a href="https://bundlephobia.com/result?p=rollup-plugin-filesize-check">
    <img src="https://badge-size.herokuapp.com/spencermountain/rollup-plugin-filesize-check/index.js" />
  </a>
  </div>
</div>

a small [rollup](https://rollupjs.org) plugin to ensure your build is approx the expected filesize.

![image](https://user-images.githubusercontent.com/399657/72990325-f6fb5080-3dbd-11ea-9d90-5e2882b80ca8.png)

`npm i rollup-plugin-filesize-check --save-dev`

then in rollup config:

```js
import sizeCheck from 'rollup-plugin-filesize-check'

export default [
  {
    input: 'src/index.js',
    output: [{ file: 'builds/out.js', format: 'umd' }],
    plugins: [
      sizeCheck({
        expect: 95, // sizes in KiB (1024 bytes)
        warn: 5 // acceptable diff (+/-)
      })
    ]
  }
]
```

Sizes are checked separately for every output chunk and asset, including CSS and
binary assets. Comparisons use exact bytes; displayed sizes are rounded to two
decimal places. Both smaller and larger outputs can fall outside the tolerance.
Requires Rollup 2.78.0 or later and Node.js 18 or later. Rollup 2.78.0 introduced
the ordered plugin hooks this plugin uses. Compatibility checks cover Rollup
2.78.0, 2.79.2, 3.0.0, 3.29.5, 4.0.0, and 4.63.4, including TypeScript and CLI use.
The peer range has no upper bound, allowing future major releases without a
dependency conflict; compatibility with those future releases is not yet verified.

## Options

- **expect <number>** (optional): the expected size of each output in KiB (1024 bytes). Omit to only report sizes. Zero is supported.
- **warn <number>** (optional): the warning tolerance (+/-) in KiB. Requires `expect`. An output warns only when its difference exceeds this value. Zero requires an exact match.
- **throw <number>** (optional): the build failure tolerance (+/-) in KiB. Requires `expect` and works with or without `warn`. Zero requires an exact match. A failure takes priority over a warning.
- **failOnError <boolean>** (optional, default `false`): fail at the `warn` tolerance when `throw` is omitted. Requires both `expect` and `warn`. An explicit `throw` value takes precedence.
- **color <boolean | 'auto'>** (optional, default `'auto'`): color interactive terminal output, respecting `NO_COLOR` and `TERM=dumb`. Use `false` for plain text or `true` to force ANSI colors. This controls the plugin's messages; Rollup controls its own diagnostic formatting.
- **include <string | string[]>** (optional): select output-relative paths using globs. Omit to select all files; `[]` selects none.
- **exclude <string | string[]>** (optional): exclude output-relative paths. Exclusions take priority over includes and per-file budgets.
- **budgets <object[]>** (optional): ordered, independent per-file budgets. Each requires `include` and accepts `exclude`, `expect`, `warn`, `throw`, and `failOnError`.

Numeric options must be finite, non-negative numbers. Invalid types and unknown
options throw a configuration error immediately. Supplying a tolerance without
`expect`, or `failOnError` without a failure threshold, emits an
`INVALID_SIZE_BUDGET` warning at the start of each output generation.

## Selecting files and budgets

```js
sizeCheck({
  include: ['**/*.js', '**/*.css'],
  exclude: ['**/*.map', '**/vendor-*.js'],
  budgets: [
    { include: '**/app-*.js', expect: 95, warn: 5, throw: 10 },
    { include: '**/*.css', expect: 20, warn: 2, throw: 5 }
  ]
})
```

Patterns match emitted filenames such as `assets/app-abc123.js`, relative to the
output directory. `*.js` matches the root; `**/*.js` also matches nested paths.
Hidden files are included when they match. Use `exclude` for exclusions instead
of a leading `!` in a pattern.

Global filters apply first. The first matching budget applies to each selected
file, without inheriting top-level limits. A budget's `exclude` only prevents
that rule from matching; later rules can still apply. Unmatched files use the
top-level `expect`, `warn`, `throw`, and `failOnError`, or simply report their size
if no top-level budget is supplied. Empty or fully excluded bundles are valid.

## Failing CI builds

For CI builds:

```js
sizeCheck({ expect: 95, warn: 5, throw: 10 })
```

This passes from 90–100 KiB, warns below 90 or above 100 KiB, and fails below
85 or above 105 KiB. Differences exactly equal to a threshold do not exceed it:
85 and 105 KiB still warn, but do not fail. Both thresholds compare exact bytes.

To fail without a warning tier, use `sizeCheck({ expect: 95, throw: 5 })`.
Omit both `warn` and `throw` to report differences without enforcing a tolerance.

Budget violations use Rollup's warning/error handling with plugin code
`FILESIZE_EXCEEDED`. Warnings can be captured with `onwarn`. Rollup's `--silent`
flag suppresses its warning diagnostics, but the plugin's compact size report
(including `Filesize warning:` rows) remains visible. A `warn` threshold does not fail the
build; use `throw` for that. Build errors still fail under `--silent`.
All failing files in an output bundle are collected into one error with a
`fileNames` array. Passing files and warnings are still reported before that
error is raised. Separate output configurations are checked separately.
Expected size failures omit stack traces and repeat neither the plugin name nor
the byte count. Exact `bytes`, `expectedKiB`, and `toleranceKiB` remain available
on warning diagnostics and on each entry in an error's `failures` array.

```text
[!] (plugin filesize) Size check failed:
  spacetime.min.js 50.06kb  - 149.94kb below limit of 200kb (±5 kb)
```

Checks run in a `generateBundle` hook with `order: 'post'`, after ordinary hooks.
Place this plugin after other plugins with `post` hooks if they change file sizes.
Changes made later in `writeBundle` are not measured.
The plugin works in either the top-level `plugins` array or an individual
output's `plugins` array, after a minifier such as Terser.

## Output

```text
  Filesize ok:  app.js 94.50kb  (-0.50kb)
  Filesize warning:  spacetime.min.js 50.06kb  - 149.94kb below limit of 200kb
```

Filenames and sizes align across outputs. Positive differences mean larger than
expected; negative differences mean smaller. Tiny differences use bytes so a
one-byte change appears as `1 B`, not `0.00kb`. The compact `kb` label
still represents 1024 bytes. Warnings and errors describe the absolute difference
from `expect` as “over limit” or “below limit”; `warn` and `throw` remain the
allowed tolerances around that expected size.

Label colors describe the check result, not the direction of the change:

- `Filesize:`: neutral, when no tolerance is being checked.
- `Filesize ok:`: green, within tolerance (including a small increase).
- `Filesize warning:`: yellow, outside tolerance in either direction.
- `Size check failed:`: red heading, outside the `throw` tolerance (or the `warn` tolerance with `failOnError: true` when `throw` is omitted).

Both unusually small and unusually large bundles can indicate a broken build,
so a decrease outside the configured tolerance still warns or fails. Redirected output
has no plugin ANSI codes by default; status labels remain readable without color.
Filenames are cyan, sizes and expected limits are blue, and differences are magenta.
Each colored field resets independently. Reports use stderr alongside Rollup's
progress messages, with a blank line before and after the report and a final newline.

## TypeScript

Type declarations are included, with an exported options interface and a Rollup
`Plugin` return type:

```ts
import sizeCheck, { type SizeCheckOptions } from 'rollup-plugin-filesize-check'

const options: SizeCheckOptions = {
  expect: 95,
  warn: 5,
  throw: 10,
  color: 'auto'
}

export default {
  input: 'src/index.js',
  plugins: [sizeCheck(options)]
}
```

## See also

- [rollup-plugin-filesize](https://github.com/ritz078/rollup-plugin-filesize) by ritz078
- [rollup-plugin-sizes](https://github.com/tivac/rollup-plugin-sizes) by tivac

MIT
