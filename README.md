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

## Options

- **expect <number>** (optional): the expected size of each output in KiB (1024 bytes). Omit to only report sizes. Zero is supported.
- **warn <number>** (optional): the acceptable difference (+/-) in KiB. An output warns only when its difference exceeds this value; an exact boundary passes. Zero requires an exact match. Omit to report differences without checking a tolerance.
- **failOnError <boolean>** (optional, default `false`): fail the build instead of warning when an output falls outside the tolerance. Requires both `expect` and `warn`.

For CI builds:

```js
sizeCheck({ expect: 95, warn: 5, failOnError: true })
```

Budget violations use Rollup's warning/error handling with plugin code
`FILESIZE_EXCEEDED`. Warnings can be captured with `onwarn` and are suppressed by
Rollup's `--silent` flag. Build errors still fail the build.

## See also

- [rollup-plugin-filesize](https://github.com/ritz078/rollup-plugin-filesize) by ritz078
- [rollup-plugin-sizes](https://github.com/tivac/rollup-plugin-sizes) by tivac

MIT
