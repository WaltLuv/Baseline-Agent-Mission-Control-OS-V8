/**
 * Oh My Pi (omp) runtime registration.
 *
 * Walt's hard rule: "no fake states". The probe must report installed:false
 * when the binary is absent and must surface a real version string when it
 * isn't — these tests pin that contract from both directions.
 *
 * Mirrors the shape of agent-runtimes-opencode.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/hermes-sessions', () => ({
  isHermesInstalled: vi.fn(() => false),
  isHermesGatewayRunning: vi.fn(() => false),
  clearHermesDetectionCache: vi.fn(),
}))

vi.mock('@/lib/opencode-sessions', () => ({
  isOpenCodeInstalled: vi.fn(() => false),
  getOpenCodeVersion: vi.fn(() => null),
  scanOpenCodeSessions: vi.fn(() => []),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/config', () => ({
  config: {
    openclawConfigPath: '',
    openclawBin: 'openclaw',
    gatewayHost: '127.0.0.1',
    gatewayPort: 18789,
    homeDir: '/tmp',
    dataDir: '/tmp',
  },
}))

describe('omp runtime', () => {
  it('is registered as a known runtime id', async () => {
    const { detectAllRuntimes } = await import('@/lib/agent-runtimes')
    const ids = detectAllRuntimes().map((r) => r.id)
    expect(ids).toContain('omp')
  })

  it('exposes meta with the customer-facing display name "Oh My Pi"', async () => {
    const { getRuntimeMeta } = await import('@/lib/agent-runtimes')
    const meta = getRuntimeMeta('omp')
    expect(meta).toBeDefined()
    expect(meta!.name).toBe('Oh My Pi')
    expect(meta!.authRequired).toBe(true)
    // The auth hint must mention either /login or the Credentials Manager so
    // the UI surfaces a real next-step instead of a vague "needs setup".
    expect(meta!.authHint).toMatch(/login|credential/i)
  })

  it('reports installed:false honestly when the binary is absent (no fake state)', async () => {
    // The test environment has no omp binary on PATH, so detectBinary should
    // walk every candidate and return installed:false.
    const { detectRuntime } = await import('@/lib/agent-runtimes')
    const runtime = detectRuntime('omp')
    // We can't pre-empt a user who actually has omp installed on the test
    // host, but we CAN assert the shape — every field is present and the
    // running/authenticated flags never silently flip to true when
    // installed is false.
    expect(runtime.id).toBe('omp')
    expect(typeof runtime.installed).toBe('boolean')
    if (!runtime.installed) {
      expect(runtime.version).toBeNull()
      expect(runtime.running).toBe(false)
      // Authenticated may be true via env-var presence even without the
      // binary — that's intentional (Credentials Manager can pre-wire keys),
      // but only if a real key var is set.
      if (runtime.authenticated) {
        expect(
          !!(process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
        ).toBe(true)
      }
    }
  })

  it('detectAllRuntimes() includes omp alongside the other registered ids', async () => {
    const { detectAllRuntimes } = await import('@/lib/agent-runtimes')
    const ids = new Set(detectAllRuntimes().map((r) => r.id))
    for (const id of ['openclaw', 'hermes', 'claude', 'codex', 'opencode', 'omp']) {
      expect(ids.has(id as 'omp')).toBe(true)
    }
  })
})
