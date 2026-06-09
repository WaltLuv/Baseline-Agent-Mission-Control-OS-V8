import '@testing-library/jest-dom'

// ─────────────────────────────────────────────────────────────────────
// Test DB isolation. Tests must NOT run against the developer's live
// `.data/mission-control.db` — accumulated state there (an existing admin,
// migrated rows) makes signup 500 and breaks seedAdminUserFromEnv, producing
// flaky failures that depend on which test seeds the DB first. Point every
// test run at a throwaway temp data dir BEFORE config.ts reads the env, so the
// whole suite gets a fresh, deterministic SQLite DB. Set only if the runner
// hasn't already chosen one.
if (typeof process !== 'undefined' && !process.env.MISSION_CONTROL_DATA_DIR) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('node:os') as typeof import('node:os')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path') as typeof import('node:path')
  process.env.MISSION_CONTROL_DATA_DIR = path.join(os.tmpdir(), `mc-vitest-${process.pid}`)
}

// ─────────────────────────────────────────────────────────────────────
// Suppress MaxListenersExceededWarning during the vitest run.
//
// Several production modules (most notably the scheduler in
// `src/lib/scheduler.ts`) attach `process.on('exit' | 'SIGINT' | 'SIGTERM')`
// hooks at import-time so backups, cleanups and heartbeats can flush
// gracefully on shutdown. Vitest in single-thread mode re-imports those
// modules across hundreds of test files in the same process, so the
// listener count comfortably exceeds Node's default soft cap of 10 and
// emits a spam of:
//
//   (node:NNNN) MaxListenersExceededWarning: 11 exit listeners added…
//
// The warnings are harmless in tests but pollute the output and trip
// downstream quality-gate scripts that scan logs for "Warning". Raising
// the cap is the documented, lint-clean fix.
// ─────────────────────────────────────────────────────────────────────
if (typeof process !== 'undefined' && typeof process.setMaxListeners === 'function') {
  process.setMaxListeners(64)
}
