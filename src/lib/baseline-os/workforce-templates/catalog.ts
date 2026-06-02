/**
 * Workforce Templates — vertical-specific "install in 60 seconds" bundles.
 *
 * Each template enumerates the personas, workflows, tool hints, and
 * approval policy expectations a customer in that vertical needs on day 1.
 * Templates are pure data; installation is performed by
 * `installWorkforceTemplate()` in ./install.ts.
 *
 * The catalog ships ONE vertical deeply (Property Management) plus
 * "coming soon" entries for the other seven verticals. Walt's directive:
 *   "Property Management is the flagship proof."
 */

export type WorkforceRisk = 'low' | 'medium' | 'high' | 'blocked'

export interface WorkforcePersona {
  /** Stable slug used for idempotency. */
  slug: string
  name: string
  role: string
  description: string
  capabilities: string[]
}

export interface WorkforceWorkflow {
  /** Stable slug used for idempotency. */
  slug: string
  title: string
  description: string
  /** Persona slug that owns this workflow. */
  owner_persona: string
  /** Hint for the Workforce Router — Baseline OS makes the final choice. */
  runtime_hint?: string
  tool_hint?: string
  skill_hint?: string
  approval_policy: WorkforceRisk
  proof_expectation: string
  success_criteria: string
  /** Initial task state. Most are 'inbox' so the operator triages them. */
  initial_status?: 'inbox' | 'in_progress' | 'backlog'
  priority?: 'low' | 'medium' | 'high' | 'critical'
}

export interface WorkforceToolHint {
  cli_tool_id: string
  label: string
  description: string
  /** Whether the tool is shipped + ready to call, or needs connecting. */
  state: 'installed' | 'available' | 'needs_connect'
  default_risk: WorkforceRisk
}

export interface WorkforceTemplate {
  slug: string
  vertical: string
  /** Customer-facing headline ("Tessa, Marcus and 4 more, ready to work"). */
  headline: string
  /** Marketing one-liner. */
  tagline: string
  /** Estimated install duration shown to the user. */
  install_seconds: number
  /** Coming-soon templates skip install but render in the catalog grid. */
  status: 'ready' | 'coming_soon'
  personas: WorkforcePersona[]
  workflows: WorkforceWorkflow[]
  tools: WorkforceToolHint[]
  /** Highlighted approval gates the customer should know about. */
  approval_summary: {
    auto: string[]
    medium: string[]
    high: string[]
    blocked: string[]
  }
}

// ───────────────────────────────────────────────────────────────────
// Property Management Workforce — flagship.
// ───────────────────────────────────────────────────────────────────

const PROPERTY_MGMT: WorkforceTemplate = {
  slug: 'property-management',
  vertical: 'Property Management',
  headline: 'Tessa, Marcus, and 4 more — ready to work the moment you install.',
  tagline:
    'A six-person AI workforce that triages maintenance, drafts tenant replies, chases rent, and flags vendor risk before it costs you a unit.',
  install_seconds: 60,
  status: 'ready',
  personas: [
    {
      slug: 'tessa-reyes-tenant-relations',
      name: 'Tessa Reyes',
      role: 'Tenant Relations Lead',
      description:
        'Drafts replies, triages inbound complaints, monitors satisfaction signals, and escalates anything that needs a human.',
      capabilities: ['draft-reply', 'tenant-triage', 'sentiment-flag', 'escalation'],
    },
    {
      slug: 'marcus-doyle-maintenance-dispatch',
      name: 'Marcus Doyle',
      role: 'Maintenance Dispatcher',
      description:
        'Receives work orders, classifies urgency, picks the right vendor, and tracks the job from intake to sign-off.',
      capabilities: ['work-order-intake', 'urgency-classify', 'vendor-dispatch', 'job-tracking'],
    },
    {
      slug: 'rena-patel-leasing',
      name: 'Rena Patel',
      role: 'Leasing Coordinator',
      description:
        'Runs lease renewals on the 60/30/14 cadence, screens applications, and refreshes listings the second a unit vacates.',
      capabilities: ['lease-renewal', 'application-screening', 'listing-refresh', 'tour-scheduling'],
    },
    {
      slug: 'owen-whitfield-owner-relations',
      name: 'Owen Whitfield',
      role: 'Owner Relations',
      description:
        'Prepares owner statements, drafts month-end summaries, and answers owner questions in the voice you trained him in.',
      capabilities: ['owner-statement', 'monthly-summary', 'owner-comm', 'roi-rollup'],
    },
    {
      slug: 'vince-cardella-vendor-coordinator',
      name: 'Vince Cardella',
      role: 'Vendor Coordinator',
      description:
        'Tracks vendor insurance, COI expiry, performance scores, and never lets a non-compliant vendor onto your properties.',
      capabilities: ['vendor-onboard', 'coi-expiry-watch', 'performance-track', 'payment-prep'],
    },
    {
      slug: 'quinn-hartley-inspections',
      name: 'Quinn Hartley',
      role: 'Inspections & Compliance',
      description:
        'Schedules move-ins, move-outs, annuals, and habitability inspections; flags compliance gaps before they become fines.',
      capabilities: ['inspection-schedule', 'compliance-watch', 'habitability-flag', 'punch-list'],
    },
  ],
  workflows: [
    {
      slug: 'pm-wf-maintenance-intake',
      title: 'Maintenance intake',
      description:
        'A tenant reported a leak under the kitchen sink at 1248 Oak Ave Unit B. Classify urgency, choose the right vendor, and draft the dispatch message — Marcus runs the loop.',
      owner_persona: 'marcus-doyle-maintenance-dispatch',
      tool_hint: 'vendor-cli',
      skill_hint: 'work-order-intake',
      approval_policy: 'medium',
      proof_expectation:
        'work_order_id linked to vendor + ETA confirmation pasted as task proof_url',
      success_criteria: 'Vendor dispatched within the urgency SLA; tenant receives an ETA reply.',
      initial_status: 'inbox',
      priority: 'high',
    },
    {
      slug: 'pm-wf-rent-collection-cascade',
      title: 'Rent collection cascade',
      description:
        'Day 3 / 5 / 7 / 10 late-rent cascade for unit 412. Each escalation step requires owner approval before any communication goes out.',
      owner_persona: 'tessa-reyes-tenant-relations',
      tool_hint: 'resend',
      skill_hint: 'rent-collection',
      approval_policy: 'high',
      proof_expectation: 'message_id from Resend per cascade step + screenshot of payment receipt',
      success_criteria: 'Rent collected OR formal notice issued with owner sign-off.',
      initial_status: 'inbox',
      priority: 'high',
    },
    {
      slug: 'pm-wf-lease-renewal-60-30-14',
      title: 'Lease renewal 60 / 30 / 14',
      description:
        'Renewal cadence for any unit within 60 days of lease end. Rena drafts the offer, you approve, she sends.',
      owner_persona: 'rena-patel-leasing',
      tool_hint: 'docusign-cli',
      skill_hint: 'lease-renewal',
      approval_policy: 'high',
      proof_expectation: 'signed lease document URL + counter-signed PDF in Notion',
      success_criteria: 'Renewal signed before lease end OR move-out workflow initiated.',
      priority: 'medium',
    },
    {
      slug: 'pm-wf-move-in',
      title: 'Move-in workflow',
      description:
        'New tenant move-in: keys, deposit confirmation, inspection scheduling, welcome packet, utility setup checklist.',
      owner_persona: 'quinn-hartley-inspections',
      tool_hint: 'inspection-cli',
      skill_hint: 'move-in-coord',
      approval_policy: 'medium',
      proof_expectation: 'signed move-in inspection PDF + photo set',
      success_criteria: 'Tenant has keys; inspection signed; deposit applied; welcome packet sent.',
      priority: 'medium',
    },
    {
      slug: 'pm-wf-move-out',
      title: 'Move-out workflow',
      description:
        'Tenant 30-day notice received: schedule inspection, prep punch list, calculate deposit refund, draft owner update.',
      owner_persona: 'quinn-hartley-inspections',
      tool_hint: 'inspection-cli',
      skill_hint: 'move-out-coord',
      approval_policy: 'medium',
      proof_expectation: 'final inspection PDF + itemized deposit reconciliation',
      success_criteria: 'Unit returned, deposit reconciled, listing refreshed, owner notified.',
      priority: 'medium',
    },
    {
      slug: 'pm-wf-inspection-scheduling',
      title: 'Inspection scheduling',
      description:
        'Quinn looks 14 days ahead, batches inspections by neighborhood, and books them on the calendar.',
      owner_persona: 'quinn-hartley-inspections',
      tool_hint: 'calendar',
      skill_hint: 'inspection-schedule',
      approval_policy: 'low',
      proof_expectation: 'calendar event IDs for each booked inspection',
      success_criteria: 'All upcoming inspections scheduled with no double-booking.',
      priority: 'low',
    },
    {
      slug: 'pm-wf-vendor-coi-expiry',
      title: 'Vendor insurance / COI expiry monitor',
      description:
        'Daily sweep of vendor COIs. Vince flags any expiring in the next 30 days and drafts the renewal request.',
      owner_persona: 'vince-cardella-vendor-coordinator',
      tool_hint: 'vendor-cli',
      skill_hint: 'coi-expiry-watch',
      approval_policy: 'medium',
      proof_expectation: 'updated COI PDF URL + new expiry date in vendor record',
      success_criteria: 'Zero vendors operating with expired COI on any active property.',
      priority: 'high',
    },
    {
      slug: 'pm-wf-owner-statements',
      title: 'Owner statements',
      description:
        'Month-end statement prep for every owner: rent collected, expenses, vacancy, work orders. Owen drafts; you approve before send.',
      owner_persona: 'owen-whitfield-owner-relations',
      tool_hint: 'owner-statement-cli',
      skill_hint: 'monthly-summary',
      approval_policy: 'high',
      proof_expectation: 'statement PDF link per owner + Resend message_id of delivery email',
      success_criteria: 'All owners receive a signed-off statement by the 5th of the next month.',
      priority: 'medium',
    },
    {
      slug: 'pm-wf-listing-refresh',
      title: 'Listing refresh on vacancy',
      description:
        'The moment Quinn confirms a move-out date, Rena rebuilds the listing — copy, photos, pricing, syndication feed.',
      owner_persona: 'rena-patel-leasing',
      tool_hint: 'listing-feed',
      skill_hint: 'listing-refresh',
      approval_policy: 'medium',
      proof_expectation: 'live listing URL on Zillow / Apartments.com / Rentals.com',
      success_criteria: 'Listing live within 24h of confirmed vacancy date.',
      priority: 'medium',
    },
    {
      slug: 'pm-wf-after-hours-emergency',
      title: 'After-hours emergency routing',
      description:
        'Any inbound call/message after 6pm that mentions water, smoke, gas, or no-heat skips triage and dispatches the on-call vendor immediately. Tessa wakes the operator with a SMS only if the vendor cannot be reached.',
      owner_persona: 'marcus-doyle-maintenance-dispatch',
      tool_hint: 'vendor-cli',
      skill_hint: 'emergency-dispatch',
      approval_policy: 'high',
      proof_expectation: 'on-call vendor confirmation timestamp + tenant safety-check reply',
      success_criteria: 'Emergency dispatched within 15 minutes of inbound message.',
      priority: 'critical',
    },
    {
      slug: 'pm-wf-application-processing',
      title: 'Application processing',
      description:
        'New rental application: credit pull, employment verification, prior-landlord references, scoring against your unit criteria.',
      owner_persona: 'rena-patel-leasing',
      tool_hint: 'screening-cli',
      skill_hint: 'application-screening',
      approval_policy: 'high',
      proof_expectation: 'screening report PDF + scoring rubric with pass/fail per criterion',
      success_criteria: 'Decision delivered to applicant within 48h.',
      priority: 'medium',
    },
    {
      slug: 'pm-wf-vendor-performance',
      title: 'Vendor performance tracking',
      description:
        'Vince rolls up vendor performance weekly: on-time %, callbacks, tenant satisfaction, invoice variance. Bottom performers get flagged.',
      owner_persona: 'vince-cardella-vendor-coordinator',
      tool_hint: 'vendor-cli',
      skill_hint: 'performance-track',
      approval_policy: 'low',
      proof_expectation: 'weekly performance rollup CSV / Notion page',
      success_criteria: 'Operator has actionable list of underperformers before week starts.',
      priority: 'low',
    },
  ],
  tools: [
    { cli_tool_id: 'mc', label: 'Mission Control CLI', description: 'Talk to your own supervision plane.', state: 'installed', default_risk: 'low' },
    { cli_tool_id: 'gh', label: 'GitHub CLI', description: 'Engineering escalations and PRs.', state: 'installed', default_risk: 'medium' },
    { cli_tool_id: 'notion-q', label: 'Notion API shim', description: 'Owner-facing reports + tenant records.', state: 'installed', default_risk: 'medium' },
    { cli_tool_id: 'resend', label: 'Resend (transactional email)', description: 'Tenant / owner communication.', state: 'installed', default_risk: 'high' },
    { cli_tool_id: 'vendor-cli', label: 'Vendor dispatch CLI', description: 'Connects to your vendor management system (Buildium / AppFolio / Yardi).', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'docusign-cli', label: 'DocuSign CLI', description: 'Lease signing + renewals.', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'calendar', label: 'Calendar integration', description: 'Inspection + tour scheduling.', state: 'needs_connect', default_risk: 'low' },
    { cli_tool_id: 'owner-statement-cli', label: 'Owner statement generator', description: 'Month-end statement PDF + delivery.', state: 'available', default_risk: 'high' },
    { cli_tool_id: 'listing-feed', label: 'Listing syndication feed', description: 'Push to Zillow / Apartments.com / Rentals.com.', state: 'needs_connect', default_risk: 'medium' },
    { cli_tool_id: 'inspection-cli', label: 'Inspection CLI', description: 'Move-in / move-out / annual inspection PDFs.', state: 'available', default_risk: 'medium' },
    { cli_tool_id: 'screening-cli', label: 'Applicant screening', description: 'Credit, employment, prior-landlord pulls.', state: 'needs_connect', default_risk: 'high' },
  ],
  approval_summary: {
    auto: [
      'Calendar lookups, inbox triage, performance rollups',
    ],
    medium: [
      'Tenant communication drafts, owner update drafts, vendor follow-up drafts',
    ],
    high: [
      'Late rent notices, vendor payment authorizations, lease signing, owner financial statements, compliance/legal communication',
    ],
    blocked: [
      'Deleting tenant data, exposing secrets, unauthorized payments, cancelling a lease without sign-off',
    ],
  },
}

// ───────────────────────────────────────────────────────────────────
// Coming soon — exposed in the catalog but installation refuses.
// ───────────────────────────────────────────────────────────────────

function comingSoon(slug: string, vertical: string, tagline: string): WorkforceTemplate {
  return {
    slug,
    vertical,
    headline: `${vertical} workforce — coming soon`,
    tagline,
    install_seconds: 0,
    status: 'coming_soon',
    personas: [],
    workflows: [],
    tools: [],
    approval_summary: { auto: [], medium: [], high: [], blocked: [] },
  }
}

export const WORKFORCE_TEMPLATES: Record<string, WorkforceTemplate> = {
  'property-management': PROPERTY_MGMT,
  'general-contractor': comingSoon(
    'general-contractor',
    'General Contractor',
    'Punch lists, change orders, sub-trade coordination, and lien-waiver tracking.',
  ),
  'home-services': comingSoon(
    'home-services',
    'Home Services',
    'Lead intake, quoting, technician routing, and recurring service reminders.',
  ),
  'real-estate': comingSoon(
    'real-estate',
    'Real Estate',
    'Listing prep, transaction coordination, and post-close client nurture.',
  ),
  mortgage: comingSoon(
    'mortgage',
    'Mortgage',
    'Pre-qual triage, doc collection, lender coordination, and closing readiness.',
  ),
  cpa: comingSoon(
    'cpa',
    'CPA',
    'Client doc intake, deadline tracking, IRS notice triage, and engagement letters.',
  ),
  'law-firm': comingSoon(
    'law-firm',
    'Law Firm',
    'Matter intake, deposition prep, deadline-watch, and client status updates.',
  ),
  agency: comingSoon(
    'agency',
    'Agency',
    'Client briefs, deliverable QA, status reports, and renewal pipeline.',
  ),
}

export function getTemplate(slug: string): WorkforceTemplate | null {
  return WORKFORCE_TEMPLATES[slug] ?? null
}

export function listTemplates(): WorkforceTemplate[] {
  return Object.values(WORKFORCE_TEMPLATES)
}
