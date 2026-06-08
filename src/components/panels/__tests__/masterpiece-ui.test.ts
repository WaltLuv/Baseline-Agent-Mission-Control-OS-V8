/**
 * Org Chart CRUD, Pipeline, and configurable-paths UI surfaces.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'

const read = (p: string) => readFileSync(p, 'utf8')

describe('AI Org Chart CRUD UI', () => {
  const panel = read('src/components/panels/org-chart-panel.tsx')
  it('has create/edit/delete with a destructive-delete confirm', () => {
    expect(panel).toContain('org-chart-panel')
    expect(panel).toContain('org-save')
    expect(panel).toContain("method: 'DELETE'")
    expect(panel).toContain('window.confirm')
  })
  it('assigns department, manager, skills, memory, runtime, permissions', () => {
    for (const f of ['department', 'managerId', 'skills', 'memoryAccess', 'runtime', 'permissions']) {
      expect(panel, `org form missing ${f}`).toContain(f)
    }
  })
})

describe('Pipeline UI', () => {
  const panel = read('src/components/panels/pipeline-panel.tsx')
  it('captures an idea and runs it through the gated stages', () => {
    expect(panel).toContain('pipeline-panel')
    expect(panel).toContain('idea-capture')
    expect(panel).toContain("action: 'approve'")
    expect(panel).toContain("action: 'advance'")
    expect(panel).toContain("action: 'ship'")
  })
})

describe('Settings exposes configurable paths', () => {
  it('mounts the Paths & Config section', () => {
    const src = read('src/components/settings/paths-config-section.tsx')
    expect(src).toContain('paths-config-section')
    expect(src).toContain('/api/config/paths')
    expect(existsSync('src/app/api/config/paths/route.ts')).toBe(true)
  })
})
