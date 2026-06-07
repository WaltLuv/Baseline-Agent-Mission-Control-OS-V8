/**
 * Marketplace bundles — the "App Store for AI Employees" preview.
 *
 * Each bundle is a curated set of AI employees + skills designed for a
 * specific business outcome. Customers install bundles, not individual
 * agents.
 *
 * This is preview-only for now. Install CTA is wired to onboarding so
 * customers can try a bundle as a workspace template.
 */
export interface MarketplaceBundle {
  id: string
  name: string
  icon: string
  category:
    | 'reception'
    | 'sales'
    | 'operations'
    | 'finance'
    | 'marketing'
    | 'legal'
    | 'contractor'
  tagline: string
  description: string
  aiEmployees: string[]
  skills: string[]
  estimatedHoursSavedPerMonth: number
  /** Optional template id to provision this bundle through onboarding. */
  linkedTemplateId?: string
  /** Soft launch — true means the install CTA is disabled. */
  comingSoon?: boolean
}

export const MARKETPLACE_BUNDLES: MarketplaceBundle[] = [
  {
    id: 'reception-pack',
    name: 'AI Receptionist Pack',
    icon: '📞',
    category: 'reception',
    tagline: 'Never miss a customer call again',
    description:
      'Answer inbound calls, qualify leads, book appointments, and send confirmations — 24/7.',
    aiEmployees: ['AI Receptionist', 'AI Appointment Scheduler', 'AI Lead Qualifier'],
    skills: ['call-answer', 'lead-intake', 'appointment-booking', 'confirmation-sms'],
    estimatedHoursSavedPerMonth: 60,
  },
  {
    id: 'sales-followup-pack',
    name: 'Sales Follow-Up Pack',
    icon: '💼',
    category: 'sales',
    tagline: 'Stop losing deals between phone and CRM',
    description:
      'Pull every inbound lead into a personalized follow-up cadence — same-day, day 3, day 7, day 14.',
    aiEmployees: ['AI Lead Capture Assistant', 'AI Follow-Up Coordinator', 'AI Pipeline Reporter'],
    skills: ['lead-capture', 'follow-up-cadence', 'pipeline-status', 'rep-handoff'],
    estimatedHoursSavedPerMonth: 35,
  },
  {
    id: 'operations-pack',
    name: 'Operations Assistant Pack',
    icon: '⚙️',
    category: 'operations',
    tagline: 'Keep the wheels turning so you can focus on growth',
    description:
      'Standup summaries, weekly KPIs, task triage, customer comms. The ops glue your business needs.',
    aiEmployees: ['AI Operations Coordinator', 'AI Standup Reporter', 'AI Task Triager'],
    skills: ['standup-summary', 'task-triage', 'weekly-kpi-report', 'customer-comms'],
    estimatedHoursSavedPerMonth: 45,
  },
  {
    id: 'cpa-admin-pack',
    name: 'CPA Admin Pack',
    icon: '📊',
    category: 'finance',
    tagline: 'Take admin work off your tax-season plate',
    description:
      'Client intake, missing-document chase, bookkeeping follow-up, payroll/compliance reminders.',
    aiEmployees: ['AI Client Intake Assistant', 'AI Tax Document Organizer', 'AI Reporting Analyst'],
    skills: ['client-intake', 'document-checklist-generation', 'tax-season-follow-up', 'monthly-report-drafting'],
    estimatedHoursSavedPerMonth: 40,
    linkedTemplateId: 'cpa',
  },
  {
    id: 'marketing-content-pack',
    name: 'Marketing Content Pack',
    icon: '📣',
    category: 'marketing',
    tagline: 'Ship 5× more content with the same headcount',
    description:
      'Weekly content calendars, ad copy, social repurposing, client performance reports.',
    aiEmployees: ['AI Content Strategist', 'AI Social Media Scheduler', 'AI Client Reporting Analyst'],
    skills: ['content-calendar-creation', 'social-post-repurposing', 'ad-copy-generation', 'client-report-drafting'],
    estimatedHoursSavedPerMonth: 35,
    linkedTemplateId: 'marketing-agency',
  },
  {
    id: 'law-firm-intake-pack',
    name: 'Law Firm Intake Pack',
    icon: '⚖️',
    category: 'legal',
    tagline: 'Move clients from inquiry to consult in hours, not days',
    description:
      'Client intake summaries, scheduling, document checklists, follow-up emails. Internal workflow support only — never legal advice.',
    aiEmployees: ['AI Client Intake Assistant', 'AI Case Summary Assistant', 'AI Scheduling Assistant'],
    skills: ['client-intake-summary', 'consultation-prep', 'document-checklist-creation', 'follow-up-email-drafting'],
    estimatedHoursSavedPerMonth: 30,
    linkedTemplateId: 'law-firm',
  },
  {
    id: 'contractor-ops-pack',
    name: 'Contractor Ops Pack',
    icon: '🔨',
    category: 'contractor',
    tagline: 'Bid more jobs, manage them tighter, close them cleaner',
    description:
      'Bid estimating, project scheduling, sub coordination, punch-list management.',
    aiEmployees: ['AI Bid Estimator', 'AI Project Scheduler', 'AI QC Inspector'],
    skills: ['cost-estimation', 'project-scheduling', 'subcontractor-matching', 'quality-inspection'],
    estimatedHoursSavedPerMonth: 50,
    linkedTemplateId: 'general-contractor',
  },
  {
    id: 'real-estate-agent-pack',
    name: 'Real Estate Agent Pack',
    icon: '🏡',
    category: 'sales',
    tagline: 'Close more deals with less time at your desk',
    description:
      'Lead capture, CMA, showing coordination, transaction coordination, post-close nurture.',
    aiEmployees: ['AI Lead Capture Assistant', 'AI CMA Analyst', 'AI Transaction Coordinator'],
    skills: ['lead-capture', 'cma-report-generator', 'showing-scheduling', 'transaction-coordination'],
    estimatedHoursSavedPerMonth: 26,
    linkedTemplateId: 'real-estate',
  },
  {
    id: 'mortgage-broker-pack',
    name: 'Mortgage Broker Pack',
    icon: '💰',
    category: 'finance',
    tagline: 'Close more loans without growing your team',
    description:
      'Application intake, pre-qualification, document collection, rate quotes, underwriting follow-through.',
    aiEmployees: ['AI Application Intake Assistant', 'AI Doc Collection Assistant', 'AI Rate Quote Assistant'],
    skills: ['application-intake', 'document-collection-request', 'rate-quote-comparison', 'underwriting-status-tracker'],
    estimatedHoursSavedPerMonth: 32,
    linkedTemplateId: 'mortgage',
  },
]

export const MARKETPLACE_CATEGORIES: { id: MarketplaceBundle['category']; label: string }[] = [
  { id: 'reception', label: 'Reception' },
  { id: 'sales', label: 'Sales' },
  { id: 'operations', label: 'Operations' },
  { id: 'finance', label: 'Finance' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'legal', label: 'Legal' },
  { id: 'contractor', label: 'Contractor' },
]
