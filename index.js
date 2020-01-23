// https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
const reset = '\x1b[0m'

const color = {
  red: function(str) {
    return '\x1b[31m' + str + reset
  },
  green: function(str) {
    return '\x1b[32m' + str + reset
  },
  yellow: function(str) {
    return '\x1b[33m' + str + reset
  }
}

const padEnd = function(str, width = 9) {
  str = str.toString()
  while (str.length < width) {
    str += ' '
  }
  return str
}

const sizeCheck = function(options) {
  options = options || {}
  return {
    name: 'filesize',
    generateBundle(_o, bundle) {
      Object.keys(bundle)
        .map(fileName => bundle[fileName])
        .forEach(obj => {
          let { code, fileName } = obj

          //get filesize
          const bytes = Buffer.byteLength(code)
          const size = Math.ceil(bytes / 1024)

          //no expect param, just log filesize
          let log = `  ${padEnd(fileName, 15)}  -  ${padEnd(size + ' kb', 5)}`
          if (!options.expect) {
            console.log(color.yellow(log))
            return
          }
          //compare to expected size
          let diff = options.expect - size
          let diffStr = diff > 0 ? '+' + diff : diff
          log += ` (${diffStr} kb)`
          if (!options.warn) {
            console.log(color.yellow(log))
            return
          }
          //is it bad
          if (Math.abs(diff) > options.warn) {
            console.warn(color.red(log))
            return
          }
          //it is good
          console.log(color.green(log))
        })
    }
  }
}
module.exports = sizeCheck
