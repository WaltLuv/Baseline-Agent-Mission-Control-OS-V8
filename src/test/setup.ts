import '@testing-library/jest-dom'

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
