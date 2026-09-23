// https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
const reset = '\x1b[0m'

const color = {
  green: function (str) {
    return '\x1b[32m' + str + reset
  },
  yellow: function (str) {
    return '\x1b[33m' + str + reset
  }
}

const padEnd = function (str, width = 9) {
  str = str.toString()
  while (str.length < width) {
    str += ' '
  }
  return str
}

const sizeCheck = function (options) {
  options = options || {}
  return {
    name: 'filesize',
    generateBundle(_o, bundle) {
      Object.keys(bundle)
        .map(fileName => bundle[fileName])
        .forEach(obj => {
          const { fileName } = obj

          //get filesize
          const bytes = Buffer.byteLength(obj.type === 'asset' ? obj.source : obj.code)
          const size = bytes / 1024

          //no expect param, just log filesize
          let log = `  ${padEnd(fileName, 15)}  -  ${size.toFixed(2)} KiB`
          if (options.expect === undefined) {
            console.log(color.yellow(log))
            return
          }
          //compare to expected size
          const diff = bytes - options.expect * 1024
          const diffStr = (diff > 0 ? '+' : diff < 0 ? '-' : '') + (Math.abs(diff) / 1024).toFixed(2)
          log += ` (${diffStr} KiB)`
          if (options.warn === undefined) {
            console.log(color.yellow(log))
            return
          }
          //is it bad
          if (Math.abs(diff) > options.warn * 1024) {
            const warning = {
              code: 'FILESIZE_EXCEEDED',
              message: `${fileName}: ${bytes} bytes is outside the expected ${options.expect} KiB ± ${options.warn} KiB`,
              fileName
            }
            if (options.failOnError) {
              this.error(warning)
            } else {
              this.warn(warning)
            }
            return
          }
          //it is good
          console.log(color.green(log))
        })
    }
  }
}
export default sizeCheck
