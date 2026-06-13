/**
 * Ecosystem integration model + Browser Action Registry + execution modes.
 * API preferred → controlled Browser → Visible Only. Allowlist + approval gates
 * enforced. PropControl Empire is the game/simulator (replaces Office).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ECOSYSTEM_APPS, getEcosystemApp, resolveEcosystemApp, resolveExecutionMode } from '../apps'
import { BROWSER_ACTIONS, listBrowserActions, getBrowserAction, checkBrowserAction } from '../browser-actions'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('ecosystem app model', () => {
  it('covers the four ecosystem apps', () => {
    expect(ECOSYSTEM_APPS.map((a) => a.id).sort()).toEqual(['propcontrol', 'propcontrol-empire', 'visionops', 'voiceops'])
  })

  it('API mode preferred when an API base url is configured', () => {
    const pc = resolveEcosystemApp(getEcosystemApp('propcontrol')!, { PROPCONTROL_IFRAME_URL: 'https://app.propcontrolempire.com', PROPCONTROL_API_BASE_URL: 'https://api.propcontrolempire.com' } as never)
    expect(pc.status).toBe('api_connected')
    expect(resolveExecutionMode(pc)).toBe('api')
  })

  it('Browser mode used when API missing but iframe configured', () => {
    const pc = resolveEcosystemApp(getEcosystemApp('propcontrol')!, { PROPCONTROL_IFRAME_URL: 'https://app.propcontrolempire.com' } as never)
    expect(pc.status).toBe('browser_automation_ready')
    expect(resolveExecutionMode(pc)).toBe('browser')
  })

  it('Visible-only / Setup-needed when nothing configured (VoiceOps has no URL)', () => {
    const vo = resolveEcosystemApp(getEcosystemApp('voiceops')!, {} as never)
    expect(vo.status).toBe('setup_needed')
    expect(resolveExecutionMode(vo)).toBe('visible_only')
    expect(vo.setupNeeded.length).toBeGreaterThan(0)
  })
})

describe('browser action registry — controlled execution', () => {
  it('registers actions for each ecosystem app', () => {
    expect(listBrowserActions('propcontrol').map((a) => a.actionId)).toContain('create_work_order')
    expect(listBrowserActions('visionops').map((a) => a.actionId)).toContain('review_inspection_media')
    expect(listBrowserActions('voiceops').map((a) => a.actionId)).toContain('escalate_call')
    expect(listBrowserActions('propcontrol-empire').map((a) => a.actionId)).toContain('launch_game')
  })

  it('blocks cross-domain navigation (allowlist enforced)', () => {
    const a = getBrowserAction('propcontrol', 'create_work_order')!
    const bad = checkBrowserAction(a, { url: 'https://evil.example.com/x', role: 'operator', permissions: ['create_work_order'] })
    expect(bad.allowed).toBe(false)
    expect(bad.reason).toMatch(/allowlist/i)
  })

  it('requires the right permission', () => {
    const a = getBrowserAction('propcontrol', 'create_work_order')!
    const noPerm = checkBrowserAction(a, { url: 'https://app.propcontrolempire.com/wo', role: 'operator', permissions: ['read_context'] })
    expect(noPerm.allowed).toBe(false)
    expect(noPerm.reason).toMatch(/permission/i)
  })

  it('approval-gated actions are blocked until approved', () => {
    const a = getBrowserAction('propcontrol', 'request_owner_approval')!
    expect(a.approvalRequired).toBe(true)
    const unapproved = checkBrowserAction(a, { url: 'https://app.propcontrolempire.com/x', role: 'operator', permissions: ['request_approval'] })
    expect(unapproved.allowed).toBe(false)
    expect(unapproved.needsApproval).toBe(true)
    const approved = checkBrowserAction(a, { url: 'https://app.propcontrolempire.com/x', role: 'operator', permissions: ['request_approval'], approved: true })
    expect(approved.allowed).toBe(true)
  })

  it('every action defines proof capture + replay event', () => {
    for (const a of BROWSER_ACTIONS) {
      expect(a.replayEvent).toBeTruthy()
      expect(['screenshot', 'dom_snapshot', 'none']).toContain(a.proofCapture)
    }
  })
})

describe('Office replaced by PropControl Empire', () => {
  it('nav no longer shows a generic Office item; shows PropControl Empire', () => {
    const nav = read('src/components/layout/nav-rail.tsx')
    expect(nav).not.toContain("label: 'Office'")
    expect(nav).toContain("label: 'PropControl Empire'")
  })
  it('legacy /office and /propcontrol-empire both render the Empire panel', () => {
    const page = read('src/app/app/[[...panel]]/page.tsx')
    expect(page).toContain("case 'propcontrol-empire':")
    expect(page).toContain('PropControlEmpirePanel')
  })
  it('panel copy describes the game/simulator, not an operations app', () => {
    const panel = read('src/components/panels/propcontrol-empire-panel.tsx')
    expect(panel).toMatch(/real estate strategy game|simulat/i)
    expect(panel).toContain('pce-open-new-tab')
    expect(panel).toContain('pce-setup-needed')
  })
})
