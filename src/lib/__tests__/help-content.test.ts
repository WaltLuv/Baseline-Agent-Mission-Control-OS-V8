/**
 * Help content sanity tests.
 *
 * These tests guard the integrity of the help system without testing
 * presentation. They guarantee that:
 *   - Every guide has at least one step.
 *   - The checklist derives honestly from real inputs.
 *   - No customer-facing content leaks vector/orchestration jargon.
 */
import { describe, it, expect } from 'vitest'
import {
  GETTING_STARTED,
  USER_GUIDE,
  RUNTIME_SETUP,
  MEMORY_SETUP,
  TROUBLESHOOTING,
  GLOSSARY,
  FAQ,
  HELP_INDEX,
  CONTEXTUAL_HELP,
  TOUR_STEPS,
  CHECKLIST_ITEMS,
} from '../help/content'
import { deriveChecklist, completionPercent, nextStep } from '../help/checklist'

const FORBIDDEN_IN_OWNER_CONTENT = ['pinecone', 'embedding', 'vector index', 'orchestrator', 'langchain']

function corpus(text: string): string {
  return text.toLowerCase()
}

describe('help content', () => {
  it('every getting-started step has a title and body', () => {
    expect(GETTING_STARTED.length).toBe(10)
    for (const s of GETTING_STARTED) {
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.body.length).toBeGreaterThan(0)
    }
  })

  it('user guide has all sections A-I', () => {
    const ids = USER_GUIDE.map((s) => s.id)
    expect(ids).toEqual(['basics', 'employees', 'skills', 'memory', 'approvals', 'billing', 'runtimes', 'marketplace', 'security'])
    for (const section of USER_GUIDE) {
      expect(section.steps.length).toBeGreaterThan(0)
    }
  })

  it('runtime setup covers hermes, openclaw, and claude', () => {
    const ids = RUNTIME_SETUP.map((s) => s.id)
    expect(ids).toEqual(['hermes', 'openclaw', 'claude'])
  })

  it('memory setup covers obsidian, notion, and knowledge intelligence', () => {
    const ids = MEMORY_SETUP.map((s) => s.id)
    expect(ids).toEqual(['obsidian', 'notion', 'kb-intelligence'])
  })

  it('every troubleshooting entry has all required fields', () => {
    expect(TROUBLESHOOTING.length).toBeGreaterThanOrEqual(10)
    for (const t of TROUBLESHOOTING) {
      expect(t.symptom).toBeTruthy()
      expect(t.meaning).toBeTruthy()
      expect(t.likelyCause).toBeTruthy()
      expect(t.fix.length).toBeGreaterThan(0)
    }
  })

  it('every glossary term has short + long definitions', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(15)
    for (const g of GLOSSARY) {
      expect(g.short.length).toBeGreaterThan(0)
      expect(g.long.length).toBeGreaterThan(0)
    }
  })

  it('FAQ has at least 8 questions', () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(8)
    for (const f of FAQ) {
      expect(f.q.endsWith('?')).toBe(true)
    }
  })

  it('help index covers all top-level pages', () => {
    const ids = HELP_INDEX.map((e) => e.id)
    expect(ids).toContain('getting-started')
    expect(ids).toContain('user-guide')
    expect(ids).toContain('runtime-setup')
    expect(ids).toContain('memory-setup')
    expect(ids).toContain('troubleshooting')
    expect(ids).toContain('glossary')
    expect(ids).toContain('faq')
  })

  it('contextual help covers core surfaces', () => {
    for (const key of [
      'executive-briefing',
      'workforce-health',
      'ai-employee-card',
      'skill-roi',
      'skills-active-inventory',
      'approval-queue',
      'memory-settings',
      'billing',
      'runtime-connections',
    ]) {
      expect(CONTEXTUAL_HELP[key]).toBeTruthy()
      expect(CONTEXTUAL_HELP[key].what).toBeTruthy()
      expect(CONTEXTUAL_HELP[key].why).toBeTruthy()
      expect(CONTEXTUAL_HELP[key].next).toBeTruthy()
    }
  })

  it('first-run tour has 10 steps', () => {
    expect(TOUR_STEPS.length).toBe(10)
  })

  it('checklist defines required + optional items with valid CTAs', () => {
    expect(CHECKLIST_ITEMS.length).toBeGreaterThan(0)
    for (const item of CHECKLIST_ITEMS) {
      expect(item.label).toBeTruthy()
      expect(item.why).toBeTruthy()
      expect(item.actionLabel).toBeTruthy()
      expect(['required', 'optional']).toContain(item.tier)
      // No item may have an empty panel string OR a placeholder href.
      expect(item.panel.length).toBeGreaterThan(0)
      if (item.href) {
        expect(item.href.startsWith('/')).toBe(true)
        expect(item.href).not.toBe('#')
      }
    }
  })

  it('required tier sums to exactly 100% weight (deterministic progress bar)', () => {
    const required = CHECKLIST_ITEMS.filter((i) => i.tier === 'required')
    expect(required.length).toBeGreaterThan(0)
    const total = required.reduce((sum, i) => sum + (i.weight ?? 0), 0)
    expect(total).toBe(100)
  })

  it('Walt\'s P0: no required item routes back to the overview page (no circular CTAs)', () => {
    // The OLD bug: template → panel='overview' which is /app which is THIS page.
    // Required items must point to a real destination, not the same page.
    const required = CHECKLIST_ITEMS.filter((i) => i.tier === 'required')
    for (const item of required) {
      if (!item.href) {
        expect(item.panel, `${item.id} routes to overview (circular)`).not.toBe('overview')
      }
    }
  })

  it('template CTA points at the activation hub (not overview), per Walt\'s acceptance criteria', () => {
    const tmpl = CHECKLIST_ITEMS.find((i) => i.id === 'template')!
    expect(tmpl).toBeDefined()
    expect(tmpl.panel).toBe('activate')
    expect(tmpl.actionLabel.toLowerCase()).toContain('template')
  })

  it('credentials, runtime, task CTAs route to /app/<panel> destinations that exist', () => {
    // Sanity guard: routes for the four key onboarding steps must match
    // the real /app subroutes built earlier in the cycle.
    const idToPanel = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.id, i.panel]))
    expect(idToPanel.credentials).toBe('credentials')
    expect(idToPanel.runtime).toBe('runtimes')
    expect(idToPanel.task).toBe('tasks')
  })

  describe('owner-facing copy stays free of technical jargon', () => {
    const ownerSurfaces: string[] = []
    for (const s of GETTING_STARTED) ownerSurfaces.push(s.title, s.body)
    for (const section of USER_GUIDE) {
      ownerSurfaces.push(section.title, section.intro ?? '')
      for (const step of section.steps) ownerSurfaces.push(step.title, step.body)
    }
    for (const t of TROUBLESHOOTING) ownerSurfaces.push(t.symptom, t.meaning, t.likelyCause, ...t.fix)
    for (const f of FAQ) ownerSurfaces.push(f.q, f.a)
    for (const g of GLOSSARY) ownerSurfaces.push(g.short, g.long)
    for (const key of Object.keys(CONTEXTUAL_HELP)) {
      const v = CONTEXTUAL_HELP[key]
      ownerSurfaces.push(v.what, v.why, v.next)
    }
    const blob = corpus(ownerSurfaces.join('\n'))
    for (const term of FORBIDDEN_IN_OWNER_CONTENT) {
      it(`does not expose "${term}"`, () => {
        expect(blob.includes(term)).toBe(false)
      })
    }
  })
})

describe('checklist derivation — Walt P0 model', () => {
  const fresh = {
    workspaceConfigured: false,
    templateSelected: false,
    credentialsOrCreditsConfigured: false,
    runtimesConnectedCount: 0,
    taskCount: 0,
  }

  it('fresh account reports 0% (no fake ticks)', () => {
    expect(completionPercent(deriveChecklist(fresh))).toBe(0)
  })

  it('account-only signin reports 20%', () => {
    const items = deriveChecklist({ ...fresh, workspaceConfigured: true })
    expect(completionPercent(items)).toBe(20)
    expect(items.find((i) => i.id === 'workspace')!.done).toBe(true)
    expect(items.find((i) => i.id === 'template')!.done).toBe(false)
  })

  it('signin + template installed reports 40%', () => {
    const items = deriveChecklist({
      ...fresh,
      workspaceConfigured: true,
      templateSelected: true,
    })
    expect(completionPercent(items)).toBe(40)
  })

  it('signin + template + credentials reports 60% (the credentials-or-credits rule)', () => {
    const items = deriveChecklist({
      ...fresh,
      workspaceConfigured: true,
      templateSelected: true,
      credentialsOrCreditsConfigured: true,
    })
    expect(completionPercent(items)).toBe(60)
  })

  it('signin + template + credentials + runtime reports 80%', () => {
    const items = deriveChecklist({
      ...fresh,
      workspaceConfigured: true,
      templateSelected: true,
      credentialsOrCreditsConfigured: true,
      runtimesConnectedCount: 1,
    })
    expect(completionPercent(items)).toBe(80)
  })

  it('all required = 100%', () => {
    const items = deriveChecklist({
      workspaceConfigured: true,
      templateSelected: true,
      credentialsOrCreditsConfigured: true,
      runtimesConnectedCount: 1,
      taskCount: 1,
    })
    expect(completionPercent(items)).toBe(100)
  })

  it('optional items do not push percent past 100', () => {
    const items = deriveChecklist({
      workspaceConfigured: true,
      templateSelected: true,
      credentialsOrCreditsConfigured: true,
      runtimesConnectedCount: 1,
      taskCount: 1,
      teamInvitedCount: 3,
      googleConnected: true,
      flightDeckInstalled: true,
      marketplacePurchasesCount: 5,
      briefingGenerated: true,
    })
    expect(completionPercent(items)).toBe(100)
  })

  it('optional items do NOT contribute to the percent when required are incomplete', () => {
    const items = deriveChecklist({
      ...fresh,
      workspaceConfigured: true,
      teamInvitedCount: 5,
      googleConnected: true,
      marketplacePurchasesCount: 10,
    })
    // Only workspace (required) is done → 20%; optional state is ignored
    // by the percent calculation.
    expect(completionPercent(items)).toBe(20)
  })

  it('nextStep walks required tier first, then optional, then null at 100%', () => {
    const noneDone = deriveChecklist(fresh)
    expect(nextStep(noneDone)?.id).toBe('workspace')

    const requiredDone = deriveChecklist({
      workspaceConfigured: true,
      templateSelected: true,
      credentialsOrCreditsConfigured: true,
      runtimesConnectedCount: 1,
      taskCount: 1,
    })
    // All required done; nextStep returns the first undone optional row.
    const next = nextStep(requiredDone)
    expect(next?.tier).toBe('optional')

    const allDone = deriveChecklist({
      workspaceConfigured: true,
      templateSelected: true,
      credentialsOrCreditsConfigured: true,
      runtimesConnectedCount: 1,
      taskCount: 1,
      teamInvitedCount: 1,
      googleConnected: true,
      flightDeckInstalled: true,
      marketplacePurchasesCount: 1,
      briefingGenerated: true,
    })
    expect(nextStep(allDone)).toBeNull()
  })

  it('the stuck-37% scenario from Walt no longer happens (no fake auto-true items)', () => {
    // Old bug: workspace/interface/credentials hardcoded as true → ~37%
    // for a fresh user. The new model only ticks `workspace` automatically.
    const items = deriveChecklist({ ...fresh, workspaceConfigured: true })
    const required = items.filter((i) => i.tier === 'required')
    const requiredDone = required.filter((i) => i.done).length
    // Exactly 1 of 5 required ticked → 20%, NOT 37%.
    expect(requiredDone).toBe(1)
    expect(completionPercent(items)).toBe(20)
  })
})
