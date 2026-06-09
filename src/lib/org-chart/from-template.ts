/**
 * Workforce template → Org Chart auto-generation (Phase 1).
 *
 * Maps an installed workforce into org-chart agents: departments, reporting
 * hierarchy (lead → reports), approval authority, memory permissions, skills,
 * and runtime defaults. Covers the 11 catalog verticals (from personas) + the
 * 4 ops directives (VisionOps / VoiceOps / PropControl / Market Swarm, from
 * the console directive agent maps).
 *
 * Pure + idempotent: every generated agent carries `category = "template:<slug>"`
 * so the store can skip re-creating on reinstall (no duplicate org nodes).
 * Workspace-scoping is enforced by the store, not here.
 */
import { getTemplate } from '@/lib/baseline-os/workforce-templates/catalog'
import { getDirective } from '@/lib/workforce-console'
import type { OrgAgentInput } from '@/lib/org-chart/types'

type ApprovalTier = 'auto' | 'review' | 'restricted'

export interface OrgPlanEntry {
  input: OrgAgentInput
  isLead: boolean
  /** Stable per-template key used for idempotent matching (name is the natural key). */
  key: string
}

const VERTICAL_DEPARTMENT: Record<string, string> = {
  'property-management': 'PM Division',
  insurance: 'Specialist Leads',
  'ai-product-launch': 'Creative',
  'real-estate': 'Real Estate Division',
  mortgage: 'Mortgage Division',
  cpa: 'Tax & Finance',
  'law-firm': 'Specialist Leads',
  'general-contractor': 'Specialist Leads',
  'home-services': 'Specialist Leads',
  'marketing-agency': 'Creative',
  'ai-agency': 'Intelligence',
}

// Generic, customer-safe approval tiers (no "Walt" terminology in MC).
function approvalFromRisk(risk?: string): ApprovalTier {
  if (risk === 'high' || risk === 'blocked') return 'restricted'
  if (risk === 'medium') return 'review'
  return 'auto'
}

const OPS_RUNTIME = 'claude-code'

/** Build an idempotent org plan for a template/directive slug. */
export function orgPlanFromTemplate(slug: string): OrgPlanEntry[] {
  const t = getTemplate(slug)
  if (t) {
    const dept = VERTICAL_DEPARTMENT[t.vertical] ?? 'Specialist Leads'
    return t.personas.map((p, i) => {
      const owned = t.workflows.filter((w) => w.owner_persona === p.slug)
      const worstRisk = owned.reduce<string>((acc, w) => {
        const order = ['auto', 'low', 'medium', 'high', 'blocked']
        return order.indexOf(w.approval_policy) > order.indexOf(acc) ? w.approval_policy : acc
      }, 'low')
      return {
        isLead: i === 0,
        key: p.name,
        input: {
          name: p.name,
          role: p.role,
          department: i === 0 ? 'Leadership & Orchestration' : dept,
          category: `template:${slug}`,
          managerId: null, // store wires reports → lead id
          skills: p.capabilities ?? [],
          memoryAccess: ['workspace'],
          runtime: owned[0]?.runtime_hint ?? 'claude-code',
          permissions: [approvalFromRisk(worstRisk)],
        },
      }
    })
  }

  // Ops directives (VisionOps / VoiceOps / PropControl / Market Swarm).
  const d = getDirective(slug) ?? getDirective(slug.replace(/_/g, '-'))
  if (d && d.group === 'ops') {
    return d.agentMap.map((name, i) => ({
      isLead: i === 0,
      key: name,
      input: {
        name,
        role: name,
        department: i === 0 ? 'Leadership & Orchestration' : 'Operations',
        category: `template:${slug}`,
        managerId: null,
        skills: [],
        memoryAccess: ['workspace'],
        runtime: OPS_RUNTIME,
        permissions: [d.humanGates.length ? 'review' : 'auto'],
      },
    }))
  }

  return []
}

/** Every slug this generator can produce an org for. */
export const GENERATABLE_SLUGS = [
  'property-management', 'insurance', 'ai-product-launch', 'real-estate', 'mortgage',
  'cpa', 'law-firm', 'general-contractor', 'home-services', 'marketing-agency', 'ai-agency',
  'visionops', 'voiceops', 'propcontrol', 'market-swarm',
]
