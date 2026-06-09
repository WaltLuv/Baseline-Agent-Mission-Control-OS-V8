/**
 * Guard: the Mansa Musa design system is Walt's PERSONAL Baseline-OS-only visual
 * customization. It must NEVER ship to Mission Control (customer/cloud product).
 * Mirrors the no-Slim-Charles guard. Scans src for Mansa Musa visual-layer markers.
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

describe('Mansa Musa is Baseline-OS-only (absent from Mission Control)', () => {
  it('no Mansa Musa design-system markers anywhere in src', () => {
    // grep -ril returns matching files; we want zero. Exclude this guard file itself.
    let hits = ''
    try {
      hits = execSync(
        `grep -rilE "mansa musa|sankore-arch|mali-grid|--mm-gold|MaliGeometry|SankoreArch" src --include="*.ts" --include="*.tsx" --include="*.css" || true`,
        { cwd: process.cwd(), encoding: 'utf8' },
      )
    } catch { hits = '' }
    const files = hits.split('\n').map((s) => s.trim()).filter(Boolean).filter((f) => !f.endsWith('no-mansa-musa.test.ts'))
    expect(files, `Mansa Musa markers leaked into MC: ${files.join(', ')}`).toEqual([])
  })
})
