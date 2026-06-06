/**
 * Hermes audit parser contract.
 *
 * Walt's D-A2: report the real installed version + the real update status.
 * NEVER fabricate a "v16" tag. These tests pin the parsing surface against
 * the literal output the hermes CLI prints today, so a future maintainer
 * can't silently flip the audit to "say v16".
 */
import { describe, expect, it } from 'vitest'

import { __test } from '@/app/api/hermes/audit/route'

const { parseInstalledVersion, parseUpdateCheck } = __test

describe('parseInstalledVersion', () => {
  it('extracts the semver from the canonical banner', () => {
    const raw = `Hermes Agent v0.15.1 (2026.5.29)
Project: /Users/walt/.hermes/hermes-agent
Python: 3.11.14
OpenAI SDK: 2.24.0
Update available: 283 commits behind — run 'hermes update'`
    expect(parseInstalledVersion(raw)).toBe('0.15.1')
  })

  it('returns null when no version banner is present', () => {
    expect(parseInstalledVersion('command not found: hermes')).toBeNull()
    expect(parseInstalledVersion('')).toBeNull()
  })

  it('does not invent a v16 tag from a v0.15.x banner', () => {
    // This is the regression guard. The parser must surface the literal
    // version, not coerce it into something marketing-friendly.
    expect(parseInstalledVersion('Hermes Agent v0.15.1')).not.toBe('16')
    expect(parseInstalledVersion('Hermes Agent v0.15.1')).not.toBe('16.0.0')
    expect(parseInstalledVersion('Hermes Agent v0.15.1')).toBe('0.15.1')
  })

  it('does not match similar-looking strings outside the banner', () => {
    expect(parseInstalledVersion('see version v9.9.9 in the changelog')).toBeNull()
  })
})

describe('parseUpdateCheck', () => {
  it('detects "Update available: N commits behind <branch>"', () => {
    const raw = `→ Fetching from upstream...
→ Fetching from origin...
⚕ Update available: 291 commits behind origin/main.
  Run 'hermes update' to install.`
    expect(parseUpdateCheck(raw)).toEqual({
      updateAvailable: true,
      commitsBehind: 291,
      branch: 'origin/main',
    })
  })

  it('detects the singular form "1 commit behind"', () => {
    const raw = 'Update available: 1 commit behind origin/main.'
    expect(parseUpdateCheck(raw)).toEqual({
      updateAvailable: true,
      commitsBehind: 1,
      branch: 'origin/main',
    })
  })

  it('detects "Already up to date"', () => {
    expect(parseUpdateCheck('Already up to date.')).toEqual({
      updateAvailable: false,
      commitsBehind: 0,
      branch: null,
    })
    expect(parseUpdateCheck('No updates available')).toEqual({
      updateAvailable: false,
      commitsBehind: 0,
      branch: null,
    })
  })

  it('returns nulls when the output is unparseable (honest, not invented)', () => {
    const raw = 'error: could not contact upstream'
    expect(parseUpdateCheck(raw)).toEqual({
      updateAvailable: null,
      commitsBehind: null,
      branch: null,
    })
  })

  it('refuses to infer a v16-style result from any plausible CLI output', () => {
    // Regression guard against future "smart" parsing that tries to
    // surface a marketing tag from raw text.
    const cases = [
      'Update available: 291 commits behind origin/main',
      'Hermes Agent v0.15.1',
      'Already up to date',
      'Upcoming v16 release per blog post',
    ]
    for (const c of cases) {
      const parsed = parseUpdateCheck(c)
      // Branch is the only string field — it must never read "v16".
      if (parsed.branch !== null) expect(parsed.branch).not.toMatch(/^v16(\.|$)/i)
    }
  })
})
