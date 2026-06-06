/**
 * CLAUDE.md operating-manual template shape guard.
 *
 * The template at docs/templates/CLAUDE.md.template is the canonical
 * project-bootstrap doc Walt named for #67 — A through G sections
 * (Project / Goal / Stack / Decisions / Memory Map / References /
 * Overrides). This test asserts the section spine so a future edit
 * can't silently drop a required section.
 *
 * Kept intentionally lightweight: structural only, not stylistic.
 */
import { readFileSync, existsSync } from 'fs'
import { describe, it, expect } from 'vitest'

const PATH = 'docs/templates/CLAUDE.md.template'

describe('CLAUDE.md operating-manual template', () => {
  it('exists at the canonical path', () => {
    expect(existsSync(PATH)).toBe(true)
  })

  const src = existsSync(PATH) ? readFileSync(PATH, 'utf8') : ''

  it('declares the {{PROJECT_NAME}} title slot', () => {
    expect(src).toMatch(/^# \{\{PROJECT_NAME\}\}/m)
  })

  it('has all seven A–G sections in order', () => {
    const headings = [
      /^## A\. Project\b/m,
      /^## B\. Goal\b/m,
      /^## C\. Stack\b/m,
      /^## D\. Decisions\b/m,
      /^## E\. Memory Map\b/m,
      /^## F\. References\b/m,
      /^## G\. Overrides/m,
    ]
    let cursor = 0
    for (const heading of headings) {
      const match = src.slice(cursor).match(heading)
      expect(match, `missing heading ${heading}`).not.toBeNull()
      cursor += (match?.index ?? 0) + (match?.[0]?.length ?? 0)
    }
  })

  it('lists the six build/test command slots Stack must capture', () => {
    for (const slot of ['{{INSTALL}}', '{{DEV}}', '{{BUILD}}', '{{LINT}}', '{{TYPECHECK}}', '{{TEST}}']) {
      expect(src).toContain(slot)
    }
  })

  it('Decisions section seeds a D-NNN log entry shape', () => {
    expect(src).toMatch(/D-001 \(YYYY-MM-DD\)/)
    expect(src).toMatch(/D-002 \(YYYY-MM-DD\)/)
  })

  it('Memory Map section names the gitignored data dir slot', () => {
    expect(src).toContain('{{DATA_DIR}}')
    expect(src).toContain('{{DATA_DIR_ENV_VAR}}')
  })

  it('reminds the maintainer that secrets must not land in MEMORY.md (Walt\'s post-2026-06-06 rule)', () => {
    expect(src).toMatch(/Never in MEMORY\.md/)
    expect(src).toMatch(/Credentials Manager/)
  })

  it('includes the "Don\'t break" no-regression contract section', () => {
    expect(src).toMatch(/^## Don't break/m)
  })

  it('does not leak any literal "[REDACTED" tokens (sanity check after the 2026-06-06 scrub)', () => {
    expect(src).not.toContain('[REDACTED')
    expect(src).not.toContain('8484225062')
  })
})
