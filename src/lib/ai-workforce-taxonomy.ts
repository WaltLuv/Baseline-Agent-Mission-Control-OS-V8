/**
 * AI Workforce taxonomy — vertical-agnostic data model.
 *
 * Single source of truth for the AI Workforce Dashboard. Departments,
 * AI employees, skill packs, verticals, and workflows live here so
 * /app/workforce, the swarm demo, and any future onboarding can share
 * the same identifiers.
 *
 * Pure data + pure helpers — safe to import into client components
 * (no node:crypto, no DB).
 */

import { MARKETPLACE_BUNDLES, type MarketplaceBundle } from './marketplace-bundles'

export type DepartmentId =
  | 'sales'
  | 'marketing'
  | 'operations'
  | 'support'
  | 'finance'
  | 'field-ops'
  | 'property-ops'
  | 'contractor-ops'

export interface Department {
  id: DepartmentId
  name: string
  description: string
}

export const DEPARTMENTS: Department[] = [
  { id: 'sales', name: 'Sales', description: 'Lead capture, follow-up, pipeline reporting.' },
  { id: 'marketing', name: 'Marketing', description: 'Content, campaigns, lead nurture.' },
  { id: 'operations', name: 'Operations', description: 'Standups, KPIs, task triage, comms.' },
  { id: 'support', name: 'Customer Support', description: 'Intake, ticketing, escalations.' },
  { id: 'finance', name: 'Finance', description: 'Invoicing, collections, reporting, compliance.' },
  { id: 'field-ops', name: 'Field Operations', description: 'Dispatch, scheduling, technician comms.' },
  { id: 'property-ops', name: 'Property Operations', description: 'Maintenance, turnover, owner updates.' },
  { id: 'contractor-ops', name: 'Contractor Operations', description: 'Bids, estimates, project status.' },
]

export type EmployeeStatus = 'working' | 'idle' | 'needs-attention' | 'offline'

export interface AiEmployee {
  id: string
  name: string
  role: string
  department: DepartmentId
  status: EmployeeStatus
  skills: string[]
  currentWorkflow: string | null
  lastActivity: string
}

/**
 * Canonical AI employees Mission Control supervises. Vertical-agnostic
 * roles — the same Sales Follow-Up Agent works for a contractor, a CPA,
 * or a cigar retail business.
 */
export const AI_EMPLOYEES: AiEmployee[] = [
  {
    id: 'sales-followup',
    name: 'Sales Follow-Up Agent',
    role: 'Outbound cadence + handoff',
    department: 'sales',
    status: 'working',
    skills: ['lead-capture', 'follow-up-cadence', 'rep-handoff'],
    currentWorkflow: 'Day-3 cadence — 14 leads',
    lastActivity: 'sent 6 follow-ups · 3 min ago',
  },
  {
    id: 'customer-intake',
    name: 'Customer Intake Agent',
    role: 'Inbound lead triage',
    department: 'support',
    status: 'working',
    skills: ['lead-intake', 'qualification', 'routing'],
    currentWorkflow: 'New inbound queue',
    lastActivity: 'qualified 4 inbound · 1 min ago',
  },
  {
    id: 'scheduling',
    name: 'Scheduling Agent',
    role: 'Calendar + dispatch',
    department: 'field-ops',
    status: 'working',
    skills: ['appointment-booking', 'confirmation-sms', 'reschedule'],
    currentWorkflow: 'Tomorrow\u2019s dispatch',
    lastActivity: 'booked 9 appointments · 6 min ago',
  },
  {
    id: 'estimate-builder',
    name: 'Estimate Builder Agent',
    role: 'Bid + quote drafts',
    department: 'contractor-ops',
    status: 'needs-attention',
    skills: ['estimate-generation', 'material-pricing', 'margin-check'],
    currentWorkflow: 'Edgewater kitchen rebuild',
    lastActivity: 'flagged margin < 18% · 14 min ago',
  },
  {
    id: 'invoice-followup',
    name: 'Invoice Follow-Up Agent',
    role: 'AR collections + dunning',
    department: 'finance',
    status: 'working',
    skills: ['invoice-reminder', 'payment-link', 'aging-report'],
    currentWorkflow: 'Aging 30+ batch',
    lastActivity: 'recovered $4,820 · 28 min ago',
  },
  {
    id: 'review-request',
    name: 'Review Request Agent',
    role: 'Post-service review nudges',
    department: 'marketing',
    status: 'working',
    skills: ['review-ask', 'sentiment-route', 'reputation-report'],
    currentWorkflow: 'After-job nudge sequence',
    lastActivity: 'requested 11 reviews · 4 min ago',
  },
  {
    id: 'inspection',
    name: 'Inspection Agent',
    role: 'Scope + photo capture',
    department: 'field-ops',
    status: 'idle',
    skills: ['inspection-photo-capture', 'scope-drafting', 'scheduling-prep'],
    currentWorkflow: null,
    lastActivity: 'awaiting next dispatch',
  },
  {
    id: 'voiceops',
    name: 'VoiceOps Operator',
    role: 'Voice + SMS routing',
    department: 'operations',
    status: 'working',
    skills: ['voice-triage', 'sms-confirm', 'after-hours-coverage'],
    currentWorkflow: 'Live phone queue',
    lastActivity: 'answered 116 calls today',
  },
  {
    id: 'visionops',
    name: 'VisionOps Inspector',
    role: 'Photo / video analysis',
    department: 'field-ops',
    status: 'idle',
    skills: ['photo-scoring', 'damage-detection', 'qa-checklist'],
    currentWorkflow: null,
    lastActivity: 'cleared queue · 32 min ago',
  },
  {
    id: 'mission-control-supervisor',
    name: 'Mission Control Supervisor',
    role: 'Orchestration + escalation',
    department: 'operations',
    status: 'working',
    skills: ['workforce-routing', 'approval-prep', 'kpi-rollup'],
    currentWorkflow: 'Live workforce orchestration',
    lastActivity: 'rolled up 4 panels · just now',
  },
]

// ────────────────────────────────────────────────────────────────────
// Vertical templates — broader than the demo narratives, including
// Cigar / Local Retail as a first-class entry per product positioning.
// ────────────────────────────────────────────────────────────────────

export type VerticalId =
  | 'pm'
  | 'gc'
  | 'home-services'
  | 'real-estate'
  | 'mortgage'
  | 'cpa'
  | 'law-firm'
  | 'marketing-agency'
  | 'ai-agency'
  | 'cigar-retail'

export interface VerticalTemplate {
  id: VerticalId
  name: string
  icon: string
  installedEmployees: string[]
  installedSkills: string[]
  workflows: string[]
  outcomes: string[]
}

export const VERTICAL_TEMPLATES: VerticalTemplate[] = [
  {
    id: 'pm',
    name: 'Property Management',
    icon: '\u{1F3E2}',
    installedEmployees: ['Scheduling Agent', 'Inspection Agent', 'Review Request Agent', 'Invoice Follow-Up Agent'],
    installedSkills: ['maintenance-dispatch', 'tenant-comms', 'owner-update', 'turnover-checklist'],
    workflows: ['Maintenance dispatch', 'Owner update digest', 'Tenant escalation triage'],
    outcomes: ['38 tickets auto-dispatched / week', 'Owner update sent on time, every time'],
  },
  {
    id: 'gc',
    name: 'General Contractor',
    icon: '\u{1F528}',
    installedEmployees: ['Estimate Builder Agent', 'Scheduling Agent', 'Invoice Follow-Up Agent'],
    installedSkills: ['estimate-generation', 'subcontractor-routing', 'change-order'],
    workflows: ['Bid \u2192 estimate \u2192 send', 'Subcontractor dispatch', 'Aging 30+ collections'],
    outcomes: ['Estimates out same day', '15% recovered AR'],
  },
  {
    id: 'home-services',
    name: 'Home Services',
    icon: '\u{1F527}',
    installedEmployees: ['VoiceOps Operator', 'Scheduling Agent', 'Review Request Agent'],
    installedSkills: ['call-triage', 'after-hours-coverage', 'review-ask'],
    workflows: ['Inbound call \u2192 booked job', 'Same-day dispatch', 'Post-service review'],
    outcomes: ['0 missed calls', '40% more reviews / month'],
  },
  {
    id: 'real-estate',
    name: 'Real Estate',
    icon: '\u{1F511}',
    installedEmployees: ['Customer Intake Agent', 'Sales Follow-Up Agent', 'Scheduling Agent'],
    installedSkills: ['lead-intake', 'showing-scheduler', 'follow-up-cadence'],
    workflows: ['New lead \u2192 showing booked', 'Drip nurture', 'Post-showing follow-up'],
    outcomes: ['Lead response < 5 min', '2.4\u00D7 more showings booked'],
  },
  {
    id: 'mortgage',
    name: 'Mortgage',
    icon: '\u{1F3E6}',
    installedEmployees: ['Customer Intake Agent', 'Invoice Follow-Up Agent', 'Review Request Agent'],
    installedSkills: ['doc-checklist', 'preapproval-nudge', 'closing-handoff'],
    workflows: ['Application intake', 'Doc collection', 'Closing-day prep'],
    outcomes: ['Doc cycle from 7 days \u2192 36h'],
  },
  {
    id: 'cpa',
    name: 'CPA / Accounting',
    icon: '\u{1F4CA}',
    installedEmployees: ['Customer Intake Agent', 'Estimate Builder Agent', 'Invoice Follow-Up Agent'],
    installedSkills: ['client-intake', 'document-checklist-generation', 'tax-season-follow-up'],
    workflows: ['Client onboarding', 'Missing doc chase', 'Filing readiness'],
    outcomes: ['Reduced tax-season pressure'],
  },
  {
    id: 'law-firm',
    name: 'Law Firm',
    icon: '\u{2696}',
    installedEmployees: ['Customer Intake Agent', 'Scheduling Agent', 'Mission Control Supervisor'],
    installedSkills: ['conflict-check', 'matter-summary', 'client-update'],
    workflows: ['New intake conflict-check', 'Matter status updates'],
    outcomes: ['Zero client chase emails', 'Conflict checks before consult'],
  },
  {
    id: 'marketing-agency',
    name: 'Marketing Agency',
    icon: '\u{1F4E3}',
    installedEmployees: ['Review Request Agent', 'Sales Follow-Up Agent', 'Mission Control Supervisor'],
    installedSkills: ['campaign-brief', 'content-draft', 'qa-checklist'],
    workflows: ['Campaign brief \u2192 content', 'Client reporting'],
    outcomes: ['5\u00D7 content velocity'],
  },
  {
    id: 'ai-agency',
    name: 'AI Agency',
    icon: '\u{1F916}',
    installedEmployees: ['Mission Control Supervisor', 'Sales Follow-Up Agent', 'Customer Intake Agent'],
    installedSkills: ['client-onboarding', 'workflow-deploy', 'qa-judge'],
    workflows: ['New client onboarding', 'Workforce deployment', 'Weekly client report'],
    outcomes: ['Deploy AI workforce in 1 day'],
  },
  {
    id: 'cigar-retail',
    name: 'Cigar Lounge / Local Retail',
    icon: '\u{1F6CD}',
    installedEmployees: ['Customer Intake Agent', 'Review Request Agent', 'VoiceOps Operator', 'Sales Follow-Up Agent'],
    installedSkills: ['member-loyalty', 'event-rsvp', 'inventory-low-alert', 'review-ask'],
    workflows: ['Member loyalty cadence', 'Event RSVP + reminder', 'Inventory alerts \u2192 reorder'],
    outcomes: ['Members re-visit weekly', 'Events fill 3 days faster'],
  },
]

// ────────────────────────────────────────────────────────────────────
// Skill packs — reuse marketplace bundles, project the shape the
// dashboard needs (status: installed / available).
// ────────────────────────────────────────────────────────────────────

export interface SkillPack {
  id: string
  name: string
  icon: string
  category: MarketplaceBundle['category']
  description: string
  employees: string[]
  skills: string[]
  verticals: VerticalId[]
  status: 'installed' | 'available'
  hoursSaved: number
}

/**
 * Heuristic map of marketplace bundle id → applicable verticals.
 * Pure data; lives next to the marketplace so the dashboard can
 * surface "which verticals can install this".
 */
const BUNDLE_VERTICAL_MAP: Record<string, VerticalId[]> = {
  'reception-pack': ['pm', 'gc', 'home-services', 'real-estate', 'mortgage', 'cpa', 'law-firm', 'cigar-retail'],
  'sales-followup-pack': ['real-estate', 'mortgage', 'marketing-agency', 'ai-agency', 'cigar-retail', 'gc'],
  'operations-pack': ['pm', 'gc', 'cpa', 'law-firm', 'marketing-agency', 'ai-agency'],
  'cpa-admin-pack': ['cpa'],
  'marketing-content-pack': ['marketing-agency', 'real-estate', 'ai-agency'],
  'law-intake-pack': ['law-firm'],
  'contractor-ops-pack': ['gc', 'home-services', 'pm'],
  'real-estate-pack': ['real-estate'],
  'mortgage-pack': ['mortgage'],
}

// Bundles considered installed in the default demo workspace.
const DEFAULT_INSTALLED = new Set(['reception-pack', 'sales-followup-pack', 'operations-pack'])

export const SKILL_PACKS: SkillPack[] = MARKETPLACE_BUNDLES.map((b) => ({
  id: b.id,
  name: b.name,
  icon: b.icon,
  category: b.category,
  description: b.description,
  employees: b.aiEmployees,
  skills: b.skills,
  verticals: BUNDLE_VERTICAL_MAP[b.id] || [],
  status: DEFAULT_INSTALLED.has(b.id) ? 'installed' : 'available',
  hoursSaved: b.estimatedHoursSavedPerMonth,
}))

// ────────────────────────────────────────────────────────────────────
// Active workflows — surfaced in the dashboard as evidence the AI
// workforce is moving real work forward, vertical-agnostic.
// ────────────────────────────────────────────────────────────────────

export interface ActiveWorkflow {
  id: string
  title: string
  department: DepartmentId
  vertical: VerticalId
  status: 'planned' | 'running' | 'review' | 'needs-approval' | 'completed'
  assignedAgents: string[]
}

export const ACTIVE_WORKFLOWS: ActiveWorkflow[] = [
  { id: 'wf-1', title: 'Inbound lead \u2192 booked appointment', department: 'sales', vertical: 'home-services', status: 'running', assignedAgents: ['Customer Intake Agent', 'Scheduling Agent'] },
  { id: 'wf-2', title: 'Tenant escalation triage', department: 'property-ops', vertical: 'pm', status: 'review', assignedAgents: ['Mission Control Supervisor', 'Scheduling Agent'] },
  { id: 'wf-3', title: 'Tax-season missing-doc chase', department: 'finance', vertical: 'cpa', status: 'running', assignedAgents: ['Customer Intake Agent', 'Invoice Follow-Up Agent'] },
  { id: 'wf-4', title: 'Conflict check before consult', department: 'support', vertical: 'law-firm', status: 'needs-approval', assignedAgents: ['Customer Intake Agent', 'Mission Control Supervisor'] },
  { id: 'wf-5', title: 'Event RSVP + reminder', department: 'marketing', vertical: 'cigar-retail', status: 'planned', assignedAgents: ['Review Request Agent', 'Customer Intake Agent'] },
  { id: 'wf-6', title: 'Bid \u2192 estimate \u2192 send', department: 'contractor-ops', vertical: 'gc', status: 'running', assignedAgents: ['Estimate Builder Agent'] },
]

// ────────────────────────────────────────────────────────────────────
// Outcomes — rolled-up business impact, vertical-agnostic.
// ────────────────────────────────────────────────────────────────────

export interface BusinessOutcome {
  id: string
  label: string
  value: string
  trend: 'up' | 'flat' | 'down'
}

export const BUSINESS_OUTCOMES: BusinessOutcome[] = [
  { id: 'hours-saved', label: 'Hours saved this week', value: '142', trend: 'up' },
  { id: 'workflows-completed', label: 'Workflows completed', value: '318', trend: 'up' },
  { id: 'value-created', label: 'Value created this month', value: '$38,420', trend: 'up' },
  { id: 'approval-cycle', label: 'Approval cycle time', value: '4m 12s', trend: 'flat' },
]

// ────────────────────────────────────────────────────────────────────
// Helpers — small, testable.
// ────────────────────────────────────────────────────────────────────

export function getDepartment(id: DepartmentId): Department | undefined {
  return DEPARTMENTS.find((d) => d.id === id)
}

export function employeesByDepartment(id: DepartmentId): AiEmployee[] {
  return AI_EMPLOYEES.filter((e) => e.department === id)
}

export function skillPacksForVertical(vertical: VerticalId): SkillPack[] {
  return SKILL_PACKS.filter((p) => p.verticals.includes(vertical))
}

export function verticalById(id: VerticalId): VerticalTemplate | undefined {
  return VERTICAL_TEMPLATES.find((v) => v.id === id)
}
