/* eslint-disable no-console */
import picomatch from 'picomatch'
const statusColors = { WARN: 33, FAIL: 31 }
const statusLabels = {
  SIZE: 'Filesize:',
  WARN: 'Filesize warning:',
  FAIL: 'Filesize error:'
}

const useColor = (option, stream) => {
  if (typeof option === 'boolean') return option
  return Boolean(stream.isTTY) && process.env.NO_COLOR === undefined && process.env.TERM !== 'dumb'
}

const paint = (text, color, enabled) => {
  if (!enabled || !color) return text
  return `\x1b[${color}m${text}\x1b[0m`
}

const formatDifference = bytes => {
  const sign = bytes > 0 ? '+' : ''
  // Keep small changes visible instead of displaying +0.00kb.
  if (Math.abs(bytes) < 10 && bytes !== 0) return `${sign}${Number(bytes.toFixed(2))} B`
  return `${sign}${(bytes / 1024).toFixed(2)}kb`
}

const formatRow = (row, widths, colored, showLabel = true) => {
  const label = paint(statusLabels[row.status], statusColors[row.status], colored)
  const name = paint(row.fileName.padEnd(widths.name), 36, colored)
  const size = paint(row.size.padStart(widths.size), 34, colored)
  const prefix = showLabel ? `  ${label}  ` : '  '
  let message = `${prefix}${name} = ${size}`
  if (row.diff !== undefined) {
    if (row.status === 'WARN' || row.status === 'FAIL') {
      const direction = row.diff > 0 ? 'above' : 'below'
      const change = row.diff > 0 ? 'over' : 'under'
      const difference = formatDifference(Math.abs(row.diff)).replace(/^\+/, '')
      message += `  - ${direction} limit of ${paint(`${row.expect}kb`, 34, colored)}  - ${change} by ${paint(difference, 35, colored)}`
    } else {
      message += `  (${paint(formatDifference(row.diff), 35, colored)})`
    }
  }
  return message
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
    renderStart() {
      for (const message of configWarnings) this.warn({ code: 'INVALID_SIZE_BUDGET', message })
    },
    generateBundle: {
      order: 'post',
      handler(_o, bundle) {
        const rows = Object.values(bundle)
          .filter((obj) => filter(obj.fileName))
          .map((obj) => {
            const budget = budgets.find((rule) => rule.matches(obj.fileName)) || options
            let failureTolerance = budget.throw
            if (failureTolerance === undefined && budget.failOnError) failureTolerance = budget.warn
            const bytes = Buffer.byteLength(obj.type === 'asset' ? obj.source : obj.code)
            const diff = budget.expect === undefined ? undefined : bytes - budget.expect * 1024
            const checked =
              diff !== undefined && (budget.warn !== undefined || failureTolerance !== undefined)
            const warns =
              diff !== undefined && budget.warn !== undefined && Math.abs(diff) > budget.warn * 1024
            const fails =
              diff !== undefined &&
              failureTolerance !== undefined &&
              Math.abs(diff) > failureTolerance * 1024
            let status = checked ? 'PASS' : 'SIZE'
            if (warns) status = 'WARN'
            if (fails) status = 'FAIL'
            const tolerance = fails ? failureTolerance : budget.warn
            return {
              fileName: obj.fileName,
              bytes,
              diff,
              status,
              tolerance,
              expect: budget.expect,
              size: `${(bytes / 1024).toFixed(2)}kb`
            }
          })
          .filter(row => row.status !== 'PASS')
        const nameWidth = rows.reduce((width, row) => Math.max(width, row.fileName.length), 0)
        const sizeWidth = rows.reduce((width, row) => Math.max(width, row.size.length), 0)
        const failures = []
        const reports = []
        const colored = useColor(options.color, process.stderr)
        const widths = { name: nameWidth, size: sizeWidth }

        for (const row of rows) {
          const message = formatRow(row, widths, colored, row.status !== 'FAIL')
          // Keep size reports visible with --silent; fatal rows appear in the combined error.
          if (row.status !== 'FAIL') reports.push(message)
          if (row.status === 'FAIL' || row.status === 'WARN') {
            const diagnostic = {
              code: 'FILESIZE_EXCEEDED',
              message,
              fileName: row.fileName,
              bytes: row.bytes,
              expectedKiB: row.expect,
              toleranceKiB: row.tolerance
            }
            if (row.status === 'FAIL') failures.push(diagnostic)
            else this.warn(diagnostic)
          }
        }
        // Rollup writes its progress to stderr too. Keep the report together, with a
        // blank line before and after, and reset each color before returning to Rollup.
        for (const [index, message] of reports.entries()) {
          const before = index === 0 ? '\n' : ''
          const after = index === reports.length - 1 ? '\n' : ''
          console.error(before + message + after)
        }
        if (failures.length) {
          // This is an expected budget violation, not a plugin crash. Passing an
          // Error preserves its concise message without Rollup adding a second prefix.
          const message = `${paint('Size check failed:', 31, colored)}\n${failures.map((failure) => failure.message).join('\n')}\n`
          const error = Object.assign(new Error(message), {
            name: '',
            stack: '',
            code: 'FILESIZE_EXCEEDED',
            fileNames: failures.map((failure) => failure.fileName),
            failures
          })
          this.error(error)
        }
      }
    }
  }
}
export default sizeCheck
