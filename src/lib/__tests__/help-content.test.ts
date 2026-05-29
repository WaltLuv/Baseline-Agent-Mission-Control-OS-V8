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
import { deriveChecklist, completionPercent } from '../help/checklist'

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

  it('checklist defines 11 items, each with action and panel', () => {
    expect(CHECKLIST_ITEMS.length).toBe(11)
    for (const item of CHECKLIST_ITEMS) {
      expect(item.label).toBeTruthy()
      expect(item.why).toBeTruthy()
      expect(item.actionLabel).toBeTruthy()
      expect(item.panel).toBeTruthy()
    }
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

describe('checklist derivation', () => {
  it('derives done flags from real inputs', () => {
    const items = deriveChecklist({
      workspaceConfigured: true,
      templateSelected: false,
      agentCount: 2,
      installedSkillsCount: 0,
      memorySourcesCount: 1,
      runtimesConnectedCount: 0,
      billingConfigured: true,
      taskCount: 5,
      approvalsReviewedCount: 0,
      briefingGenerated: false,
      trackedSkillRoiCount: 0,
    })
    const done = Object.fromEntries(items.map((i) => [i.id, i.done]))
    expect(done.workspace).toBe(true)
    expect(done.template).toBe(false)
    expect(done.employee).toBe(true)
    expect(done.skill).toBe(false)
    expect(done.memory).toBe(true)
    expect(done.runtime).toBe(false)
    expect(done.billing).toBe(true)
    expect(done.task).toBe(true)
    expect(done.approval).toBe(false)
    expect(done.briefing).toBe(false)
    expect(done.roi).toBe(false)
  })

  it('completion percent rounds correctly', () => {
    const items = deriveChecklist({
      workspaceConfigured: true,
      templateSelected: true,
      agentCount: 1,
      installedSkillsCount: 1,
      memorySourcesCount: 1,
      runtimesConnectedCount: 1,
      billingConfigured: true,
      taskCount: 1,
      approvalsReviewedCount: 1,
      briefingGenerated: true,
      trackedSkillRoiCount: 1,
    })
    expect(completionPercent(items)).toBe(100)
  })

  it('reports 0 percent when nothing is set', () => {
    const items = deriveChecklist({
      workspaceConfigured: false,
      templateSelected: false,
      agentCount: 0,
      installedSkillsCount: 0,
      memorySourcesCount: 0,
      runtimesConnectedCount: 0,
      billingConfigured: false,
      taskCount: 0,
      approvalsReviewedCount: 0,
      briefingGenerated: false,
      trackedSkillRoiCount: 0,
    })
    expect(completionPercent(items)).toBe(0)
  })
})
