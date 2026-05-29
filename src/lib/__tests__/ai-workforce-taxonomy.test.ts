/**
 * AI Workforce taxonomy — pin the data model so the dashboard stays
 * vertical-agnostic and the cigar/local-retail vertical is always
 * present per current positioning.
 */
import { describe, it, expect } from 'vitest'
import {
  DEPARTMENTS,
  AI_EMPLOYEES,
  VERTICAL_TEMPLATES,
  SKILL_PACKS,
  ACTIVE_WORKFLOWS,
  BUSINESS_OUTCOMES,
  employeesByDepartment,
  skillPacksForVertical,
  verticalById,
} from '../ai-workforce-taxonomy'

describe('ai-workforce-taxonomy', () => {
  it('includes all 8 departments', () => {
    expect(DEPARTMENTS.length).toBe(8)
    const ids = DEPARTMENTS.map((d) => d.id)
    expect(ids).toEqual(expect.arrayContaining([
      'sales', 'marketing', 'operations', 'support',
      'finance', 'field-ops', 'property-ops', 'contractor-ops',
    ]))
  })

  it('ships the mandated 10 AI employees', () => {
    expect(AI_EMPLOYEES.length).toBeGreaterThanOrEqual(10)
    const names = AI_EMPLOYEES.map((e) => e.name)
    expect(names).toEqual(expect.arrayContaining([
      'Sales Follow-Up Agent',
      'Customer Intake Agent',
      'Scheduling Agent',
      'Estimate Builder Agent',
      'Invoice Follow-Up Agent',
      'Review Request Agent',
      'Inspection Agent',
      'VoiceOps Operator',
      'VisionOps Inspector',
      'Mission Control Supervisor',
    ]))
  })

  it('every AI employee references a valid department', () => {
    const deptIds = new Set(DEPARTMENTS.map((d) => d.id))
    for (const e of AI_EMPLOYEES) {
      expect(deptIds.has(e.department), `employee ${e.name} → unknown department ${e.department}`).toBe(true)
    }
  })

  it('ships all 10 verticals including cigar / local retail', () => {
    expect(VERTICAL_TEMPLATES.length).toBe(10)
    const ids = VERTICAL_TEMPLATES.map((v) => v.id)
    expect(ids).toEqual(expect.arrayContaining([
      'pm', 'gc', 'home-services', 'real-estate', 'mortgage',
      'cpa', 'law-firm', 'marketing-agency', 'ai-agency', 'cigar-retail',
    ]))
  })

  it('every vertical has installed employees, skills, workflows, and outcomes', () => {
    for (const v of VERTICAL_TEMPLATES) {
      expect(v.installedEmployees.length, `${v.id} employees`).toBeGreaterThan(0)
      expect(v.installedSkills.length, `${v.id} skills`).toBeGreaterThan(0)
      expect(v.workflows.length, `${v.id} workflows`).toBeGreaterThan(0)
      expect(v.outcomes.length, `${v.id} outcomes`).toBeGreaterThan(0)
    }
  })

  it('ships at least one installed skill pack so the demo workspace is "live"', () => {
    const installed = SKILL_PACKS.filter((p) => p.status === 'installed')
    expect(installed.length).toBeGreaterThan(0)
  })

  it('every active workflow has a valid department and vertical', () => {
    const deptIds = new Set(DEPARTMENTS.map((d) => d.id))
    const verticalIds = new Set(VERTICAL_TEMPLATES.map((v) => v.id))
    for (const w of ACTIVE_WORKFLOWS) {
      expect(deptIds.has(w.department)).toBe(true)
      expect(verticalIds.has(w.vertical)).toBe(true)
    }
  })

  it('exposes business outcomes with stable ids', () => {
    expect(BUSINESS_OUTCOMES.length).toBeGreaterThanOrEqual(4)
  })

  describe('helpers', () => {
    it('employeesByDepartment returns matching employees', () => {
      const sales = employeesByDepartment('sales')
      expect(sales.length).toBeGreaterThan(0)
      for (const e of sales) expect(e.department).toBe('sales')
    })
    it('skillPacksForVertical returns packs that list that vertical', () => {
      const cigar = skillPacksForVertical('cigar-retail')
      expect(cigar.length).toBeGreaterThan(0)
      for (const p of cigar) expect(p.verticals).toContain('cigar-retail')
    })
    it('verticalById returns the matching template', () => {
      expect(verticalById('cigar-retail')?.name).toBe('Cigar Lounge / Local Retail')
      expect(verticalById('pm')?.id).toBe('pm')
    })
  })
})
