/* eslint-disable no-console */
import picomatch from 'picomatch'
const statusColors = { PASS: 32, WARN: 33, FAIL: 31 }

const useColor = (option, stream) => {
  if (typeof option === 'boolean') return option
  return Boolean(stream.isTTY) && process.env.NO_COLOR === undefined && process.env.TERM !== 'dumb'
}

const paint = (text, status, enabled) => {
  if (!enabled || !statusColors[status]) return text
  return `\x1b[${statusColors[status]}m${text}\x1b[0m`
}

const formatDifference = bytes => {
  const sign = bytes > 0 ? '+' : ''
  // Keep small changes visible instead of displaying +0.00 KiB.
  if (Math.abs(bytes) < 10 && bytes !== 0) return `${sign}${Number(bytes.toFixed(2))} B`
  return `${sign}${(bytes / 1024).toFixed(2)} KiB`
}

const budgetKeys = ['expect', 'warn', 'throw', 'failOnError']
const filterKeys = ['include', 'exclude']

const validateObject = (value, label, keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an options object`)
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new TypeError(`${label}.${key} is not a supported option`)
  }
  for (const key of ['expect', 'warn', 'throw']) {
    if (value[key] !== undefined && (!Number.isFinite(value[key]) || value[key] < 0 || !Number.isFinite(value[key] * 1024))) {
      throw new TypeError(`${label}.${key} must be a finite, non-negative number in KiB`)
    }
  }
  if (value.failOnError !== undefined && typeof value.failOnError !== 'boolean') {
    throw new TypeError(`${label}.failOnError must be a boolean`)
  }
}

const compilePatterns = (patterns, label) => {
  if (patterns === undefined) return null
  const list = Array.isArray(patterns) ? patterns : [patterns]
  if (list.some(pattern => typeof pattern !== 'string' || pattern.length === 0)) {
    throw new TypeError(`${label} must be a glob string or an array of non-empty glob strings`)
  }
  // Match output-relative paths, including hidden files. Exclusions have their own option.
  return picomatch(list, { dot: true, nonegate: true })
}

const compileFilter = (options, label) => {
  const include = compilePatterns(options.include, `${label}.include`)
  const exclude = compilePatterns(options.exclude, `${label}.exclude`)
  return fileName => (!include || include(fileName)) && (!exclude || !exclude(fileName))
}

const configurationWarning = (budget, label) => {
  if (budget.expect === undefined && (budget.warn !== undefined || budget.throw !== undefined || budget.failOnError)) {
    return `${label}: expect is required to enforce a size tolerance; only sizes will be reported`
  }
  if (budget.failOnError && budget.throw === undefined && budget.warn === undefined) {
    return `${label}: failOnError requires warn or an explicit throw tolerance; no failure threshold is active`
  }
  return null
}

const sizeCheck = function (options = {}) {
  validateObject(options, 'options', [...budgetKeys, ...filterKeys, 'color', 'budgets'])
  if (options.color !== undefined && options.color !== 'auto' && typeof options.color !== 'boolean') {
    throw new TypeError("options.color must be a boolean or 'auto'")
  }
  if (options.budgets !== undefined && !Array.isArray(options.budgets)) {
    throw new TypeError('options.budgets must be an array')
  }
  const filter = compileFilter(options, 'options')
  const budgets = (options.budgets || []).map((budget, index) => {
    const label = `options.budgets[${index}]`
    validateObject(budget, label, [...budgetKeys, ...filterKeys])
    if (budget.include === undefined) throw new TypeError(`${label}.include is required`)
    return { ...budget, label, matches: compileFilter(budget, label) }
  })
  const configWarnings = [configurationWarning(options, 'options'), ...budgets.map(budget => configurationWarning(budget, budget.label))].filter(Boolean)

  return {
    name: 'filesize',
    buildStart() {
      for (const message of configWarnings) this.warn({ code: 'INVALID_SIZE_BUDGET', message })
    },
    generateBundle: {
      order: 'post',
      handler(_o, bundle) {
        const rows = Object.values(bundle).filter(obj => filter(obj.fileName)).map(obj => {
          const budget = budgets.find(rule => rule.matches(obj.fileName)) || options
          let failureTolerance = budget.throw
          if (failureTolerance === undefined && budget.failOnError) failureTolerance = budget.warn
          const bytes = Buffer.byteLength(obj.type === 'asset' ? obj.source : obj.code)
          const diff = budget.expect === undefined ? undefined : bytes - budget.expect * 1024
          const checked = diff !== undefined && (budget.warn !== undefined || failureTolerance !== undefined)
          const warns = diff !== undefined && budget.warn !== undefined && Math.abs(diff) > budget.warn * 1024
          const fails = diff !== undefined && failureTolerance !== undefined && Math.abs(diff) > failureTolerance * 1024
          let status = checked ? 'PASS' : 'SIZE'
          if (warns) status = 'WARN'
          if (fails) status = 'FAIL'
          const tolerance = fails ? failureTolerance : budget.warn
          return { fileName: obj.fileName, bytes, diff, status, tolerance, expect: budget.expect, size: `${(bytes / 1024).toFixed(2)} KiB` }
        })
        const nameWidth = rows.reduce((width, row) => Math.max(width, row.fileName.length), 0)
        const sizeWidth = rows.reduce((width, row) => Math.max(width, row.size.length), 0)
        const failures = []

        for (const row of rows) {
          let message = `  ${row.status}  ${row.fileName.padEnd(nameWidth)}  ${row.size.padStart(sizeWidth)}`
          if (row.diff !== undefined) message += `  (${formatDifference(row.diff)})`
          if (row.status === 'FAIL' || row.status === 'WARN') {
            message += ` — ${row.bytes} bytes is outside the expected ${row.expect} KiB ± ${row.tolerance} KiB`
            const diagnostic = {
              code: 'FILESIZE_EXCEEDED',
              message: paint(message, row.status, useColor(options.color, process.stderr)),
              fileName: row.fileName
            }
            if (row.status === 'FAIL') failures.push(diagnostic)
            else this.warn(diagnostic)
          } else {
            console.log(paint(message, row.status, useColor(options.color, process.stdout)))
          }
        }
        if (failures.length) {
          this.error({
            code: 'FILESIZE_EXCEEDED',
            message: `${failures.length} output(s) outside size tolerance:\n${failures.map(failure => failure.message).join('\n')}`,
            fileNames: failures.map(failure => failure.fileName)
          })
        }
      }
    }
  }
}
export default sizeCheck
