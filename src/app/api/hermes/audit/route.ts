/**
 * GET /api/hermes/audit — Hermes version + update audit.
 *
 * Walt's D-A2 (CONSOLIDATION_ARCHITECTURE.md §10): "If `hermes update`
 * surfaces a `v16.x` tag, that's the version. If it doesn't, the UI
 * reports the actual latest available version, never a fabricated
 * `v16`."
 *
 * This endpoint never returns a hard-coded version tag. It shells out
 * to the real hermes CLI for both pieces:
 *
 *   1. `hermes --version` → installed version banner
 *   2. `hermes update --check` → upstream check that prints
 *      "Update available: N commits behind <branch>" when a newer
 *      revision exists, or an "Already up to date" line otherwise.
 *
 * The raw stdout/stderr is included in the response so the UI can show
 * the operator the literal CLI output if the parser fails to match —
 * better than a confidently-wrong UI cell.
 *
 * Auth: viewer role. Read-only; never invokes `hermes update` itself.
 */
import { NextRequest, NextResponse } from 'next/server'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

// Walk the same install locations detectBinary() does. Surface the first
// hit so the audit lines up with what the runtime registry reports.
function resolveHermesBin(): string | null {
  const candidates = [
    process.env.HERMES_BIN,
    join(homedir(), '.local', 'bin', 'hermes'),
    '/opt/homebrew/bin/hermes',
    '/usr/local/bin/hermes',
    join(homedir(), '.hermes', 'hermes-agent', 'venv', 'bin', 'hermes'),
  ].filter(Boolean) as string[]
  for (const c of candidates) {
    if (c.startsWith('/') && existsSync(c)) return c
  }
  // Last resort — bare name, in case it's on PATH but not at a known path.
  return 'hermes'
}

interface HermesAuditResult {
  installed: boolean
  installedVersion: string | null
  updateAvailable: boolean | null
  commitsBehind: number | null
  branch: string | null
  /** Free-form hint for the UI when the parser couldn't extract structured data. */
  hint: string | null
  /** Literal CLI output, for the operator to inspect when in doubt. */
  raw: {
    version: string
    updateCheck: string
  }
}

function parseInstalledVersion(out: string): string | null {
  // Hermes prints `Hermes Agent v0.15.1 (2026.5.29)` — extract just the
  // semantic version. We do NOT massage this into "v16" if a v16 tag
  // doesn't exist; the UI gets the real number.
  const m = out.match(/Hermes Agent v([\d.]+)/i)
  return m?.[1] ?? null
}

function parseUpdateCheck(out: string): {
  updateAvailable: boolean | null
  commitsBehind: number | null
  branch: string | null
} {
  // Happy path: "Update available: 291 commits behind origin/main."
  const m = out.match(/Update available:\s*(\d+)\s+commits?\s+behind\s+([^\s.]+)/i)
  if (m) {
    return {
      updateAvailable: true,
      commitsBehind: Number(m[1]),
      branch: m[2],
    }
  }
  // No-op path: hermes prints variants like "Already up to date" or
  // "No updates available". Either signal means: no update.
  if (/already up to date|no updates? available|up-to-date/i.test(out)) {
    return { updateAvailable: false, commitsBehind: 0, branch: null }
  }
  return { updateAvailable: null, commitsBehind: null, branch: null }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const bin = resolveHermesBin()
  const installed = bin !== 'hermes' || !!process.env.HERMES_BIN

  const result: HermesAuditResult = {
    installed,
    installedVersion: null,
    updateAvailable: null,
    commitsBehind: null,
    branch: null,
    hint: null,
    raw: { version: '', updateCheck: '' },
  }

  // 1. Installed version. hermes --version exits 0 quickly.
  try {
    const r = spawnSync(bin ?? 'hermes', ['--version'], {
      stdio: 'pipe',
      timeout: 3000,
    })
    const stdout = r.stdout?.toString() ?? ''
    const stderr = r.stderr?.toString() ?? ''
    const merged = (stdout + stderr).trim()
    result.raw.version = merged
    result.installedVersion = parseInstalledVersion(merged)
    if (!result.installedVersion && merged) {
      result.hint = 'could not parse "Hermes Agent vX.Y.Z" out of --version output; raw shown below'
    }
    // If the binary isn't actually installed the spawn returns non-zero
    // and stdout is empty. Reflect that honestly.
    if (r.status !== 0 && !result.installedVersion) {
      result.installed = false
    }
  } catch (err) {
    result.installed = false
    result.hint = err instanceof Error ? err.message : 'version probe threw'
  }

  if (!result.installed) {
    return NextResponse.json(result)
  }

  // 2. Update check. This hits the network (fetch from upstream) so we
  // give it a longer timeout. If it fails (no network, git not available
  // in venv, etc.) we just return whatever we've got — the UI handles a
  // null update state.
  try {
    const r = spawnSync(bin ?? 'hermes', ['update', '--check'], {
      stdio: 'pipe',
      timeout: 15000,
    })
    const stdout = r.stdout?.toString() ?? ''
    const stderr = r.stderr?.toString() ?? ''
    const merged = (stdout + stderr).trim()
    result.raw.updateCheck = merged
    const parsed = parseUpdateCheck(merged)
    result.updateAvailable = parsed.updateAvailable
    result.commitsBehind = parsed.commitsBehind
    result.branch = parsed.branch
    if (parsed.updateAvailable === null && merged) {
      result.hint = (result.hint ? result.hint + '; ' : '') +
        'could not parse update-check output; raw shown below'
    }
  } catch (err) {
    logger.warn({ err }, 'hermes update --check probe failed')
    result.hint = (result.hint ? result.hint + '; ' : '') +
      `update probe failed: ${err instanceof Error ? err.message : 'unknown'}`
  }

  return NextResponse.json(result)
}

export const dynamic = 'force-dynamic'

// Exported for tests — keep the parsers callable without spinning up a
// route handler.
export const __test = { parseInstalledVersion, parseUpdateCheck }
