## 2.0.0 - [Sep 2026]
no breaking API changes. The original `sizeCheck({ expect, warn })` syntax remains supported. 

- **[new]** - add `throw` to fail builds outside a separate +/- filesize tolerance, with or without `warn`
- **[new]** - add `failOnError` to fail at the warning threshold when no `throw` threshold is supplied
- **[new]** - add `include` / `exclude` glob filters and an ordered `budgets` array for separate per-file limits
- **[new]** - include TypeScript declarations and exported options types
- **[new]** - add a `color` option, with automatic terminal detection and support for `NO_COLOR`
- **[fix]** - handle emitted CSS, text, and binary assets without crashing
- **[fix]** - compare exact byte sizes instead of rounding before checking limits
- **[fix]** - support `expect: 0`, `warn: 0`, and `throw: 0`; exact tolerance boundaries pass
- **[fix]** - run checks after ordinary bundle hooks and support placement in `output.plugins`
- **[fix]** - keep warning reports visible with Rollup's `--silent` flag
- **[change]** - clearer output messages showing whether files are over or below the expected size, with distinct colors and consistent spacing
- **[change]** - passing size checks are silent; report-only mode still prints sizes
- **[change]** - collect all failing files in an output bundle into one concise error, without a stack trace
- **[change]** - integrate with Rollup's warning and error handling, including structured filesize diagnostics
- **[change]** - reject invalid option values and unknown options; warn when a tolerance is supplied without `expect`
- **[change]** - require Node.js 18+ and Rollup 2.78.0+, with no upper bound on the Rollup peer dependency
- **[internal]** - expand behavior, CLI, color, TypeScript, and Rollup compatibility checks


## 1.2.0 - [Jul 2024]

- **[fix]** - negative sign backwards

## 1.0.0 - [Jul 2024]

- **[change]** - use esmodules
