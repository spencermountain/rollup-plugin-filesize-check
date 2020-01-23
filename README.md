# rollup-plugin-filesize-check

a small [rollup](https://rollupjs.org) plugin to ensure your build is approx the expected filesize.

![image](https://user-images.githubusercontent.com/399657/72990325-f6fb5080-3dbd-11ea-9d90-5e2882b80ca8.png)

`npm i rollup-plugin-filesize-check --save-dev`

then in rollup config:

```js
export default [
  {
    input: 'src/index.js',
    output: [{ file: 'builds/out.js', format: 'umd' }],
    plugins: [
      sizeCheck({
        expect: 95, //(sizes in kb)
        warn: 5
      })
    ]
  }
]
```

looks best with `rollup -c --silent` flag

## Options

- **expect <number>** (optional): the size, in kilobytes, you expect the builds to be

* **warn <number>** (optional): a difference (+/-), in kilobytes, that like to be warned of (with red text)

## See also

- [rollup-plugin-filesize](https://github.com/ritz078/rollup-plugin-filesize) by ritz078
- [rollup-plugin-sizes](https://github.com/tivac/rollup-plugin-sizes) by tivac

MIT
