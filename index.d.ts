import type { Plugin } from 'rollup'

export interface SizeBudget {
  /** Expected size of each chunk or asset in KiB (1024 bytes). Zero is supported. */
  expect?: number
  /** Allowed difference in either direction, in KiB. Zero requires an exact match. */
  warn?: number
  /** Fail beyond this difference in either direction, in KiB. Requires expect. Zero requires an exact match. */
  throw?: number
  /** Fail at the warn tolerance when throw is omitted. Requires expect and warn. Default: false. */
  failOnError?: boolean
}

export type FilePatterns = string | string[]

export interface FileSizeBudget extends SizeBudget {
  /** Output-relative glob(s). The first matching budget applies, without inheriting top-level limits. */
  include: FilePatterns
  /** Excluded paths do not match this budget. */
  exclude?: FilePatterns
}

export interface SizeCheckOptions extends SizeBudget {
  /** Select output-relative paths. Omit to select all; an empty array selects none. */
  include?: FilePatterns
  /** Exclude output-relative paths, taking priority over include and budgets. */
  exclude?: FilePatterns
  /** Independent budgets in priority order; unmatched files use the top-level budget. */
  budgets?: FileSizeBudget[]
  /** Force or disable ANSI colors. Default: 'auto' (TTY, respecting NO_COLOR and TERM=dumb). */
  color?: boolean | 'auto'
}

/** Report output sizes and optionally enforce an expected size with +/- tolerance. */
export default function sizeCheck(options?: SizeCheckOptions): Plugin
