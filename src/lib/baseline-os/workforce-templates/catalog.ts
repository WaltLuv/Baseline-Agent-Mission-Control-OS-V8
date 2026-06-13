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

import { EXTENDED_VERTICALS } from './extended-verticals'

export type WorkforceRisk = 'low' | 'medium' | 'high' | 'blocked'

export type WorkforceTeam = 'Executive' | 'Operations' | 'Finance' | 'AI Systems'

export interface WorkforcePersona {
  /** Stable slug used for idempotency. */
  slug: string
  name: string
  role: string
  description: string
  capabilities: string[]
  /** Team grouping for the org chart / agent directory. */
  team?: WorkforceTeam
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
  /**
   * Optional demo-seed multiplier. When > 1, the installer creates N task
   * instances from this workflow at install time so the operator sees a
   * realistic operational density on first run (e.g. 8 open claims, not 1).
   * Defaults to 1 when omitted.
   */
  demo_seed_count?: number
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
  headline: 'A full property-management org — Executive, Operations, Finance, and AI Systems — ready on install.',
  tagline:
    'A grouped AI workforce: leadership, operations, finance, and AI-systems agents. Level-2 workflow agents work immediately; Level-3 runtime agents show Needs Runtime until connected.',
  install_seconds: 60,
  status: 'ready',
  personas: [
    // ── Executive ──
    { slug: 'pm-coo', name: 'Dana Whitmore', role: 'COO / Operations Director', team: 'Executive', description: 'Owns operational oversight, approvals within delegated limits, and cross-team reporting.', capabilities: ['oversight', 'approvals', 'reporting'] },
    { slug: 'pm-portfolio-manager', name: 'Garrett Cole', role: 'Portfolio Manager', team: 'Executive', description: 'Tracks portfolio performance, occupancy, NOI, and asset-level decisions.', capabilities: ['portfolio-perf', 'occupancy', 'noi-rollup'] },
    { slug: 'pm-chief-of-staff', name: 'Priya Anand', role: 'Chief of Staff', team: 'Executive', description: 'Coordinates priorities across teams, prepares executive briefings, drives follow-through.', capabilities: ['coordination', 'briefings', 'follow-through'] },

    // ── Operations ──
    { slug: 'marcus-doyle-maintenance-dispatch', name: 'Marcus Doyle', role: 'Maintenance Dispatcher', team: 'Operations', description: 'Receives work orders, classifies urgency, picks the right vendor, tracks jobs to sign-off.', capabilities: ['work-order-intake', 'urgency-classify', 'vendor-dispatch', 'job-tracking'] },
    { slug: 'vince-cardella-vendor-coordinator', name: 'Vince Cardella', role: 'Vendor Coordinator', team: 'Operations', description: 'Tracks vendor insurance/COI, performance scores, and payment prep; blocks non-compliant vendors.', capabilities: ['vendor-onboard', 'coi-expiry-watch', 'performance-track', 'payment-prep'] },
    { slug: 'owen-whitfield-owner-relations', name: 'Owen Whitfield', role: 'Owner Relations', team: 'Operations', description: 'Prepares owner statements, month-end summaries, and answers owner questions in your voice.', capabilities: ['owner-statement', 'monthly-summary', 'owner-comm', 'roi-rollup'] },
    { slug: 'rena-patel-leasing', name: 'Rena Patel', role: 'Leasing Coordinator', team: 'Operations', description: 'Runs lease renewals on the 60/30/14 cadence, screens applications, refreshes listings on vacancy.', capabilities: ['lease-renewal', 'application-screening', 'listing-refresh', 'tour-scheduling'] },
    { slug: 'tessa-reyes-tenant-relations', name: 'Tessa Reyes', role: 'Resident Success Manager', team: 'Operations', description: 'Drafts replies, triages complaints, monitors satisfaction, escalates anything needing a human.', capabilities: ['draft-reply', 'tenant-triage', 'sentiment-flag', 'escalation'] },

    // ── Finance ──
    { slug: 'pm-accounts-receivable', name: 'Noor Haddad', role: 'Accounts Receivable', team: 'Finance', description: 'Tracks rent, late fees, and delinquencies; prepares collections follow-up (gated).', capabilities: ['rent-tracking', 'delinquency', 'collections-prep'] },
    { slug: 'pm-accounts-payable', name: 'Victor Mensah', role: 'Accounts Payable', team: 'Finance', description: 'Processes vendor invoices and payment runs; billing actions require approval.', capabilities: ['invoice-processing', 'payment-runs'] },
    { slug: 'pm-budget-analyst', name: 'Elena Sokolova', role: 'Budget Analyst', team: 'Finance', description: 'Builds and tracks property budgets, variance reports, and forecasts.', capabilities: ['budgeting', 'variance', 'forecasting'] },
    { slug: 'pm-asset-manager', name: 'Theo Banks', role: 'Asset Manager', team: 'Finance', description: 'Asset-level performance, capex planning, and disposition analysis.', capabilities: ['asset-perf', 'capex', 'disposition'] },

    // ── AI Systems (PI harness + runtime agents — Needs Runtime until connected) ──
    { slug: 'pm-pi-agent', name: 'PI Agent', role: 'PI Agent — Context Harness', team: 'AI Systems', description: 'Context/memory harness: retrieves context, enforces policy, routes to specialized agents, indexes proof/replay. Not the worker.', capabilities: ['memory_context', 'graphify_query', 'task_routing', 'proof_index'] },
    { slug: 'pm-hermes', name: 'Hermes', role: 'Hermes Runtime Agent', team: 'AI Systems', description: 'Long-running orchestration runtime. Requires Hermes connection.', capabilities: ['orchestration', 'scheduling'] },
    { slug: 'pm-claude-code', name: 'Claude Code', role: 'Claude Code Engineer', team: 'AI Systems', description: 'Code review, refactors, builds, PRs via Claude Code. Requires runtime (Flight Deck).', capabilities: ['code', 'pr', 'tests'] },
    { slug: 'pm-codex', name: 'Codex', role: 'Codex Engineer', team: 'AI Systems', description: 'OpenAI Codex execution. Requires runtime.', capabilities: ['code'] },
    { slug: 'pm-openclaw', name: 'OpenClaw', role: 'OpenClaw Automation', team: 'AI Systems', description: 'Swarm/browser automation. Requires OpenClaw runtime.', capabilities: ['swarm', 'automation'] },
    { slug: 'pm-opencode', name: 'Opencode', role: 'Opencode Runtime Agent', team: 'AI Systems', description: 'Opencode execution runtime. Requires runtime.', capabilities: ['code'] },
    { slug: 'pm-voiceops', name: 'VoiceOps Agent', role: 'VoiceOps — Voice Intake', team: 'AI Systems', description: 'Voice call logs, follow-ups, escalations. Requires VoiceOps + Twilio.', capabilities: ['call_log', 'follow_up', 'escalate'] },
    { slug: 'pm-visionops', name: 'VisionOps Agent', role: 'VisionOps — Inspection Analyst', team: 'AI Systems', description: 'Inspection media review + visual proof. Requires VisionOps.', capabilities: ['vision_analysis', 'visual_proof'] },
    { slug: 'pm-market-swarm', name: 'Market Swarm', role: 'Market Swarm Research', team: 'AI Systems', description: 'Market research swarm. Requires a research/browser runtime.', capabilities: ['web_search', 'synthesis'] },
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
      owner_persona: 'pm-visionops',
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
      owner_persona: 'pm-visionops',
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
      owner_persona: 'pm-visionops',
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
// Insurance Operations Workforce — second flagship.
//
// Positioning (Walt): "Mission Control helps insurance teams move claims,
// renewals, documents, and customer follow-ups through one supervised AI
// workforce."
//
// Demo data is intentionally fictional. Carrier integration is NOT claimed
// — every tool hint that would touch a real carrier system is marked
// `needs_connect`. PII never leaves the workspace.
// ───────────────────────────────────────────────────────────────────

const INSURANCE: WorkforceTemplate = {
  slug: 'insurance',
  vertical: 'Insurance',
  headline: 'Iris, Malcolm, and 4 more — ready to work claims the moment you install.',
  tagline:
    'A six-person AI workforce that triages new claims, chases documents, coordinates adjusters, and prepares renewals — with approval gates on every customer-facing message.',
  install_seconds: 60,
  status: 'ready',
  personas: [
    {
      slug: 'iris-bennett-claims-intake',
      name: 'Iris Bennett',
      role: 'Claims Intake Coordinator',
      description:
        'Takes new FNOL submissions, builds the intake packet, classifies severity, and routes to the right adjuster queue.',
      capabilities: ['fnol-intake', 'severity-triage', 'packet-build', 'adjuster-route'],
    },
    {
      slug: 'malcolm-price-adjuster-coord',
      name: 'Malcolm Price',
      role: 'Adjuster Coordination Lead',
      description:
        'Books inspections, syncs adjuster calendars, and tracks every open claim through its next action — surfaces stalled files before SLAs slip.',
      capabilities: ['adjuster-scheduling', 'sla-watch', 'file-status', 'reassignment'],
    },
    {
      slug: 'nina-flores-policyholder-followup',
      name: 'Nina Flores',
      role: 'Policyholder Follow-Up Specialist',
      description:
        'Drafts status updates, answers routine policyholder questions, and keeps customer expectations calibrated with the claims pipeline.',
      capabilities: ['policyholder-comm', 'status-update', 'expectation-mgmt', 'sentiment-flag'],
    },
    {
      slug: 'grant-mercer-compliance',
      name: 'Grant Mercer',
      role: 'Compliance Review Analyst',
      description:
        'Audits outgoing language for coverage interpretation, denial wording, and regulatory exposure before anything goes to the customer.',
      capabilities: ['compliance-review', 'coverage-language-audit', 'denial-language-audit', 'state-exposure-flag'],
    },
    {
      slug: 'sofia-lane-renewals',
      name: 'Sofia Lane',
      role: 'Renewal Operations Coordinator',
      description:
        'Runs the renewal cadence — preparation, producer follow-up, customer reminders — and queues pricing communication for approval.',
      capabilities: ['renewal-prep', 'producer-followup', 'reminder-cadence', 'pricing-comm-draft'],
    },
    {
      slug: 'theo-brooks-documents',
      name: 'Theo Brooks',
      role: 'Document Collection Specialist',
      description:
        'Builds document checklists per claim, requests missing items from policyholders + producers, and confirms completeness before the file advances.',
      capabilities: ['doc-checklist', 'doc-request', 'completeness-audit', 'loss-run-request'],
    },
  ],
  workflows: [
    {
      slug: 'ins-wf-new-claim-intake',
      title: 'New claim intake',
      description:
        'A new claim has been reported. Build the intake packet, classify severity, attach the policy summary, and route to the right adjuster queue.',
      owner_persona: 'iris-bennett-claims-intake',
      tool_hint: 'claims-cli',
      skill_hint: 'fnol-intake',
      approval_policy: 'medium',
      proof_expectation: 'intake_packet_id + severity classification + adjuster queue assignment',
      success_criteria: 'Claim file created, severity set, adjuster assigned within SLA.',
      initial_status: 'inbox',
      priority: 'high',
      demo_seed_count: 4,
    },
    {
      slug: 'ins-wf-fnol-triage',
      title: 'FNOL triage',
      description:
        'First Notice of Loss came in via email / phone log. Extract the loss summary, flag any urgent-care or fraud indicators, and route to intake.',
      owner_persona: 'iris-bennett-claims-intake',
      tool_hint: 'fnol-cli',
      skill_hint: 'fnol-triage',
      approval_policy: 'medium',
      proof_expectation: 'triage_note linked to FNOL record + urgent/fraud flag results',
      success_criteria: 'FNOL routed to claim intake within 30 minutes; any urgent indicator escalated.',
      initial_status: 'inbox',
      priority: 'high',
      demo_seed_count: 4,
    },
    {
      slug: 'ins-wf-doc-collection',
      title: 'Policyholder document collection',
      description:
        'Build the document checklist for this claim, request missing items from the policyholder, and confirm completeness before the file advances to coverage review.',
      owner_persona: 'theo-brooks-documents',
      tool_hint: 'resend',
      skill_hint: 'doc-collection',
      approval_policy: 'medium',
      proof_expectation: 'checklist_id + per-item upload status (received / outstanding)',
      success_criteria: 'All required docs received OR a clear list of outstanding items shared with the policyholder.',
      initial_status: 'inbox',
      priority: 'high',
      demo_seed_count: 5,
    },
    {
      slug: 'ins-wf-adjuster-scheduling',
      title: 'Adjuster scheduling',
      description:
        'Book an inspection for an open claim. Match adjuster availability, location, and severity, then send confirmations.',
      owner_persona: 'malcolm-price-adjuster-coord',
      tool_hint: 'calendar',
      skill_hint: 'adjuster-scheduling',
      approval_policy: 'medium',
      proof_expectation: 'calendar_event_id + adjuster confirmation + policyholder confirmation',
      success_criteria: 'Inspection scheduled within the urgency window; all parties confirmed.',
      initial_status: 'inbox',
      priority: 'medium',
      demo_seed_count: 3,
    },
    {
      slug: 'ins-wf-claim-status-followup',
      title: 'Claim status follow-up',
      description:
        'Send a policyholder-facing status update for an in-flight claim. Pull the latest claim state, draft the message, and queue for compliance approval.',
      owner_persona: 'nina-flores-policyholder-followup',
      tool_hint: 'resend',
      skill_hint: 'status-update',
      approval_policy: 'high',
      proof_expectation: 'message_id from Resend + claim_state snapshot at send time',
      success_criteria: 'Policyholder receives an accurate, compliant status update on cadence.',
      initial_status: 'inbox',
      priority: 'medium',
    },
    {
      slug: 'ins-wf-coverage-verification',
      title: 'Coverage verification',
      description:
        'Verify whether the reported loss is covered under the active policy. Compile coverage language, endorsements, and exclusions for adjuster review.',
      owner_persona: 'grant-mercer-compliance',
      tool_hint: 'policy-cli',
      skill_hint: 'coverage-verification',
      approval_policy: 'high',
      proof_expectation: 'coverage_memo with citations to policy + endorsements',
      success_criteria: 'Adjuster has a clear coverage position before drafting any customer-facing language.',
      priority: 'high',
    },
    {
      slug: 'ins-wf-renewal-prep',
      title: 'Renewal preparation',
      description:
        'Build the renewal packet for a policy approaching expiration: loss history, exposure changes, producer notes, suggested action.',
      owner_persona: 'sofia-lane-renewals',
      tool_hint: 'policy-cli',
      skill_hint: 'renewal-prep',
      approval_policy: 'medium',
      proof_expectation: 'renewal_packet_id + suggested next-step',
      success_criteria: 'Producer receives a complete renewal packet 60 days out.',
      initial_status: 'inbox',
      priority: 'medium',
      demo_seed_count: 4,
    },
    {
      slug: 'ins-wf-producer-followup',
      title: 'Producer follow-up queue',
      description:
        'Walk the producer follow-up queue — open quotes, pending endorsements, renewal nudges — and draft the day’s outbound messages.',
      owner_persona: 'sofia-lane-renewals',
      tool_hint: 'resend',
      skill_hint: 'producer-followup',
      approval_policy: 'medium',
      proof_expectation: 'queue snapshot + per-producer drafted action',
      success_criteria: 'No producer item waits longer than 48h without an action or escalation.',
      priority: 'medium',
    },
    {
      slug: 'ins-wf-compliance-exception',
      title: 'Compliance exception review',
      description:
        'A piece of outbound language tripped a compliance flag — denial wording, coverage interpretation, or state-specific exposure. Grant reviews and rewrites.',
      owner_persona: 'grant-mercer-compliance',
      tool_hint: 'compliance-cli',
      skill_hint: 'compliance-review',
      approval_policy: 'high',
      proof_expectation: 'before/after diff + cited reason for rewrite',
      success_criteria: 'Outbound language is compliant before it ships; audit trail saved.',
      initial_status: 'inbox',
      priority: 'high',
      demo_seed_count: 2,
    },
    {
      slug: 'ins-wf-loss-run-request',
      title: 'Loss-run request processing',
      description:
        'A producer or insured needs a loss-run report. Theo verifies authorization, pulls the run, and packages it for delivery.',
      owner_persona: 'theo-brooks-documents',
      tool_hint: 'policy-cli',
      skill_hint: 'loss-run-request',
      approval_policy: 'medium',
      proof_expectation: 'loss_run_id + delivery receipt (recipient + timestamp)',
      success_criteria: 'Authorized loss runs delivered within 1 business day.',
      priority: 'low',
    },
    {
      slug: 'ins-wf-coi-request',
      title: 'Certificate of insurance request',
      description:
        'A COI request came in from a third party. Validate authorization, draft the certificate, and route for issuance.',
      owner_persona: 'theo-brooks-documents',
      tool_hint: 'policy-cli',
      skill_hint: 'coi-issue',
      approval_policy: 'medium',
      proof_expectation: 'coi_document_id + delivery receipt',
      success_criteria: 'Authorized COI issued within 1 business day, audit trail intact.',
      priority: 'low',
    },
    {
      slug: 'ins-wf-escalated-complaint',
      title: 'Escalated complaint routing',
      description:
        'A policyholder complaint escalated past routine follow-up. Nina compiles the file, Grant reviews exposure, and the case routes to the right human owner.',
      owner_persona: 'nina-flores-policyholder-followup',
      tool_hint: 'resend',
      skill_hint: 'complaint-routing',
      approval_policy: 'high',
      proof_expectation: 'complaint_file_id + ownership assignment + planned next contact',
      success_criteria: 'Complaint has a named owner + next-action time within 1 business day.',
      initial_status: 'inbox',
      priority: 'critical',
      demo_seed_count: 1,
    },
  ],
  tools: [
    { cli_tool_id: 'mc', label: 'Mission Control CLI', description: 'Talk to your own supervision plane.', state: 'installed', default_risk: 'low' },
    { cli_tool_id: 'resend', label: 'Resend (transactional email)', description: 'Policyholder + producer communication.', state: 'installed', default_risk: 'high' },
    { cli_tool_id: 'calendar', label: 'Calendar integration', description: 'Adjuster scheduling + customer appointments.', state: 'needs_connect', default_risk: 'low' },
    { cli_tool_id: 'claims-cli', label: 'Claims system bridge', description: 'Connects to your claims platform (Guidewire / Duck Creek / Origami / in-house).', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'fnol-cli', label: 'FNOL intake CLI', description: 'Ingests First Notice of Loss from email / phone log feeds.', state: 'available', default_risk: 'medium' },
    { cli_tool_id: 'policy-cli', label: 'Policy administration bridge', description: 'Reads policy state, endorsements, loss runs, COIs.', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'compliance-cli', label: 'Compliance review CLI', description: 'Outbound language audit + state exposure flags.', state: 'available', default_risk: 'medium' },
  ],
  approval_summary: {
    auto: [
      'Status lookups, internal task updates, document checklist creation, calendar lookups',
    ],
    medium: [
      'Policyholder follow-up drafts, producer update drafts, adjuster coordination drafts, renewal reminder drafts',
    ],
    high: [
      'Claim denial language, coverage interpretation, compliance-sensitive responses, customer-facing claim updates, renewal pricing communication, escalated complaint responses',
    ],
    blocked: [
      'Unauthorized claim approval or denial, issuing binding coverage, changing policy terms, deleting customer records, exposing PII or secrets, financial transfers',
    ],
  },
}

// ───────────────────────────────────────────────────────────────────
// AI Product Launch Team — third flagship workforce.
//
// Positioning (Walt's exact phrasing):
//   "An AI-powered development team that helps you turn ideas into working
//    products. Describe what you want, and your AI team handles research,
//    planning, design, coding, testing, launch, marketing, SEO, Stripe,
//    GitHub sync, and growth."
//
// Truth rules Walt set verbatim (forbidden claims removed; the language
// here uses "helps / assists / drafts / supervises / tracks proof"):
//   · No "fully autonomous launch without review"
//   · No "guaranteed revenue / SEO ranking / no bugs / always works"
// Every customer-facing deploy / pricing / push step lives behind a HIGH
// approval gate.
// ───────────────────────────────────────────────────────────────────

const AI_PRODUCT_LAUNCH: WorkforceTemplate = {
  slug: 'ai-product-launch',
  vertical: 'AI Product Launch Team',
  headline: 'Priya, Miles, and 6 more — your AI team to build faster and win customers.',
  tagline:
    'An AI-powered development team that helps you turn ideas into working products. Describe what you want, and your AI team handles research, planning, design, coding, testing, launch, marketing, SEO, Stripe, GitHub sync, and growth.',
  install_seconds: 60,
  status: 'ready',
  personas: [
    {
      slug: 'priya-shah-product-manager',
      name: 'Priya Shah',
      role: 'Product Manager',
      description:
        'Owns requirements, scope, roadmap, and acceptance criteria. Drafts the brief, keeps the build honest against it, and surfaces scope creep before it hurts.',
      capabilities: ['product-brief', 'requirements', 'roadmap', 'acceptance-criteria', 'scope-guard'],
    },
    {
      slug: 'miles-carter-fullstack-engineer',
      name: 'Miles Carter',
      role: 'Full-Stack Engineer',
      description:
        'Builds features, fixes bugs, handles integrations. Scaffolds the app, wires auth + storage, lands API endpoints. Every change opens a draft PR for review.',
      capabilities: ['scaffold', 'feature-build', 'bugfix', 'integrations', 'api-endpoints'],
    },
    {
      slug: 'lena-brooks-ux-designer',
      name: 'Lena Brooks',
      role: 'UX / UI Designer',
      description:
        'Designs screens, layouts, flows, and product experience. Produces wireframes and copy drafts; the operator approves before production.',
      capabilities: ['wireframe', 'flow-mapping', 'ui-copy', 'usability-review'],
    },
    {
      slug: 'omar-reyes-qa-tester',
      name: 'Omar Reyes',
      role: 'QA Tester',
      description:
        'Tests flows, catches bugs, creates test plans. Surfaces regressions before they reach customers; never marks anything green it has not actually exercised.',
      capabilities: ['test-plan', 'bug-sweep', 'regression-catch', 'smoke-runs'],
    },
    {
      slug: 'dr-hana-kim-data-scientist',
      name: 'Dr. Hana Kim',
      role: 'Data Scientist',
      description:
        'Handles analytics, data modeling, metrics, dashboards. Defines the schema, builds the dashboards, and reports on what actually moved.',
      capabilities: ['schema-design', 'metrics', 'analytics', 'dashboards'],
    },
    {
      slug: 'theo-grant-devops',
      name: 'Theo Grant',
      role: 'DevOps / Deployment Engineer',
      description:
        'Handles GitHub, CI/CD, hosting, environments, deployment. Every production push waits for human approval; pre-deploy checks must pass first.',
      capabilities: ['ci-cd', 'env-setup', 'hosting', 'github-sync', 'preflight-checks'],
    },
    {
      slug: 'sasha-monroe-seo-growth',
      name: 'Sasha Monroe',
      role: 'SEO & Growth Strategist',
      description:
        'Drafts SEO landing pages, launch content, and growth campaigns. Reports on visibility and conversion signals — does not promise rankings or traffic.',
      capabilities: ['seo-landing-pages', 'metadata', 'launch-content', 'growth-campaigns'],
    },
    {
      slug: 'nina-cole-revenue-systems',
      name: 'Nina Cole',
      role: 'Revenue Systems Specialist',
      description:
        'Handles Stripe, pricing, checkout, billing, offers, and monetization. Pricing changes require operator approval; webhook fulfillment is verified end-to-end.',
      capabilities: ['stripe-checkout', 'pricing', 'offers', 'billing-ops', 'webhook-verify'],
    },
  ],
  workflows: [
    {
      slug: 'ipt-wf-idea-intake',
      title: 'Idea intake and product brief',
      description:
        'Capture a product idea from chat or notes, draft a one-page brief (problem, customer, success metric, scope), and surface it for operator approval.',
      owner_persona: 'priya-shah-product-manager',
      tool_hint: 'notion-q',
      skill_hint: 'product-brief',
      approval_policy: 'medium',
      proof_expectation: 'brief_id linked to source notes + operator sign-off line',
      success_criteria: 'A reviewed, owner-signed brief that the team can build against.',
      initial_status: 'inbox',
      priority: 'high',
      demo_seed_count: 5,
    },
    {
      slug: 'ipt-wf-market-research',
      title: 'Market research and competitor scan',
      description:
        'Research the space, list 5–10 direct competitors, summarise positioning, and flag risks. Outputs are drafts for the operator to keep / cut / iterate.',
      owner_persona: 'priya-shah-product-manager',
      tool_hint: 'firecrawl',
      skill_hint: 'market-scan',
      approval_policy: 'low',
      proof_expectation: 'research_report_id + cited source URLs',
      success_criteria: 'Operator has a defensible take on market + competition before scope is locked.',
      initial_status: 'inbox',
      priority: 'medium',
    },
    {
      slug: 'ipt-wf-requirements-scope',
      title: 'Requirements and scope definition',
      description:
        'Translate the approved brief into requirements, acceptance criteria, and a scope-cut list. Drafts go to the operator for sign-off before any build starts.',
      owner_persona: 'priya-shah-product-manager',
      tool_hint: 'mc',
      skill_hint: 'requirements-doc',
      approval_policy: 'medium',
      proof_expectation: 'requirements_doc_id + operator sign-off',
      success_criteria: 'Engineers and designers know exactly what is in and what is out for v1.',
      initial_status: 'inbox',
      priority: 'high',
    },
    {
      slug: 'ipt-wf-ux-wireframe',
      title: 'UX wireframe and user flow',
      description:
        'Sketch the user flow + low-fidelity wireframes for the v1 surface. Output is a draft for the operator to review — not a final design.',
      owner_persona: 'lena-brooks-ux-designer',
      tool_hint: 'drawio',
      skill_hint: 'wireframe',
      approval_policy: 'low',
      proof_expectation: 'wireframe_set_id + flow diagram link',
      success_criteria: 'Build team can scaffold against a concrete shape.',
      initial_status: 'inbox',
      priority: 'medium',
    },
    {
      slug: 'ipt-wf-fullstack-scaffold',
      title: 'Full-stack app scaffold',
      description:
        'Stand up a working app skeleton in a GitHub repo — routes, env config, base layout, deploy target wired but not yet pushed live.',
      owner_persona: 'miles-carter-fullstack-engineer',
      tool_hint: 'gh',
      skill_hint: 'app-scaffold',
      approval_policy: 'medium',
      proof_expectation: 'repo URL + commit SHA + draft-PR link',
      success_criteria: 'A runnable scaffold the operator can pull, run, and review.',
      initial_status: 'inbox',
      priority: 'high',
      demo_seed_count: 4,
    },
    {
      slug: 'ipt-wf-auth-accounts',
      title: 'Authentication and user accounts',
      description:
        'Add sign-up / sign-in / password reset, session management, and basic role gating. Producer notes any provider keys the operator must add to credentials.',
      owner_persona: 'miles-carter-fullstack-engineer',
      tool_hint: 'gh',
      skill_hint: 'auth-build',
      approval_policy: 'medium',
      proof_expectation: 'PR link + working auth happy-path screenshot in the proof folder',
      success_criteria: 'A real user can sign up, sign in, and reset password in dev.',
      initial_status: 'inbox',
      priority: 'high',
    },
    {
      slug: 'ipt-wf-database-schema',
      title: 'Database schema and storage setup',
      description:
        'Define the tables, indexes, and migrations for v1. Storage strategy is documented; secrets stay in the credentials manager.',
      owner_persona: 'dr-hana-kim-data-scientist',
      tool_hint: 'mc',
      skill_hint: 'schema-design',
      approval_policy: 'medium',
      proof_expectation: 'migration files in PR + ER diagram link',
      success_criteria: 'Schema is reviewed and lands cleanly on a fresh database.',
      initial_status: 'inbox',
      priority: 'medium',
    },
    {
      slug: 'ipt-wf-stripe-checkout',
      title: 'Stripe checkout and billing setup',
      description:
        'Wire Stripe checkout for the product or service. Pricing changes require operator approval before they land in production.',
      owner_persona: 'nina-cole-revenue-systems',
      tool_hint: 'mc',
      skill_hint: 'stripe-setup',
      approval_policy: 'high',
      proof_expectation: 'price IDs + webhook signing secret saved + test-mode checkout receipt',
      success_criteria: 'Checkout works in Stripe test mode; webhook fulfillment is verified.',
      initial_status: 'inbox',
      priority: 'high',
      demo_seed_count: 2,
    },
    {
      slug: 'ipt-wf-qa-test-sweep',
      title: 'QA test plan and bug sweep',
      description:
        'Author the test plan, run smoke + regression, and file findings with reproduction steps. Marks nothing green it has not actually exercised.',
      owner_persona: 'omar-reyes-qa-tester',
      tool_hint: 'mc',
      skill_hint: 'qa-sweep',
      approval_policy: 'low',
      proof_expectation: 'test_plan_id + per-finding repro steps',
      success_criteria: 'Known regressions are caught before a customer hits them.',
      initial_status: 'inbox',
      priority: 'high',
      demo_seed_count: 3,
    },
    {
      slug: 'ipt-wf-deployment-env',
      title: 'Deployment and environment setup',
      description:
        'Configure staging + production environments, ENV vars, secrets, and preflight checks. Production deploys wait for operator approval; never auto-pushed.',
      owner_persona: 'theo-grant-devops',
      tool_hint: 'gh',
      skill_hint: 'deploy-config',
      approval_policy: 'high',
      proof_expectation: 'environment URL + deploy log + preflight checklist',
      success_criteria: 'Operator can promote a build to production with one click after review.',
      initial_status: 'inbox',
      priority: 'high',
      demo_seed_count: 2,
    },
    {
      slug: 'ipt-wf-seo-landing',
      title: 'SEO landing pages and metadata',
      description:
        'Draft SEO landing pages + per-page metadata (title, description, OG tags) for launch. Reports on visibility signals; does not promise rankings.',
      owner_persona: 'sasha-monroe-seo-growth',
      tool_hint: 'serpapi',
      skill_hint: 'seo-landing',
      approval_policy: 'medium',
      proof_expectation: 'page URLs + draft metadata block + keyword opportunity list',
      success_criteria: 'Landing pages are live with reviewed metadata before launch.',
      initial_status: 'inbox',
      priority: 'medium',
      demo_seed_count: 3,
    },
    {
      slug: 'ipt-wf-github-export',
      title: 'GitHub export / sync and handoff',
      description:
        'Export the project to GitHub or sync existing changes. Pushes to main require operator approval; documentation handoff is included.',
      owner_persona: 'theo-grant-devops',
      tool_hint: 'gh',
      skill_hint: 'github-export',
      approval_policy: 'high',
      proof_expectation: 'GitHub repo URL + handoff doc link',
      success_criteria: 'Operator has a clean repo + handoff doc; can run locally or hand to another team.',
      initial_status: 'inbox',
      priority: 'medium',
      demo_seed_count: 2,
    },
  ],
  tools: [
    { cli_tool_id: 'mc', label: 'Mission Control CLI', description: 'Talk to your own supervision plane.', state: 'installed', default_risk: 'low' },
    { cli_tool_id: 'gh', label: 'GitHub CLI', description: 'Scaffold + PRs + repo sync.', state: 'installed', default_risk: 'medium' },
    { cli_tool_id: 'notion-q', label: 'Notion API shim', description: 'Product briefs + research docs.', state: 'installed', default_risk: 'medium' },
    { cli_tool_id: 'drawio', label: 'Draw.io diagrams', description: 'Wireframes and user-flow diagrams.', state: 'available', default_risk: 'low' },
    { cli_tool_id: 'firecrawl', label: 'Firecrawl', description: 'Market + competitor research scraping.', state: 'needs_connect', default_risk: 'medium' },
    { cli_tool_id: 'serpapi', label: 'SerpAPI', description: 'SEO keyword + SERP signals.', state: 'needs_connect', default_risk: 'medium' },
    { cli_tool_id: 'stripe-cli', label: 'Stripe CLI', description: 'Checkout setup + webhook verification.', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'vercel-cli', label: 'Vercel / hosting CLI', description: 'Deploy target for the scaffolded app.', state: 'needs_connect', default_risk: 'high' },
  ],
  approval_summary: {
    auto: [
      'Research drafts, internal notes, test plans, wireframe drafts, SEO keyword suggestions',
    ],
    medium: [
      'Landing page copy, UI copy, product roadmap suggestions, generated task plans, documentation drafts',
    ],
    high: [
      'Production deployment, Stripe pricing changes, GitHub push to main, domain or DNS changes, customer-facing launch, paid ad campaign launch',
    ],
    blocked: [
      'Deleting production database, exposing secrets, pushing without approval, charging customers without approval, changing billing rules without approval, destructive filesystem actions outside project scope',
    ],
  },
}

// ───────────────────────────────────────────────────────────────────
// Coming soon — exposed in the catalog but installation refuses.
// ───────────────────────────────────────────────────────────────────

// Phase 3 — Production Vertical Completion (2026-06-06):
// The previous empty `coming_soon` shells were replaced with eight full,
// installable verticals (see ./extended-verticals.ts). Per Walt's directive
// "full standard or hidden, no exceptions" — there are NO empty shells in the
// catalog anymore. Marketing Agency and AI Agency are separate verticals.
export const WORKFORCE_TEMPLATES: Record<string, WorkforceTemplate> = {
  'property-management': PROPERTY_MGMT,
  insurance: INSURANCE,
  'ai-product-launch': AI_PRODUCT_LAUNCH,
  ...EXTENDED_VERTICALS,
}

export function getTemplate(slug: string): WorkforceTemplate | null {
  return WORKFORCE_TEMPLATES[slug] ?? null
}

/** Every template in the catalog (used by admin/audit surfaces). */
export function listTemplates(): WorkforceTemplate[] {
  return Object.values(WORKFORCE_TEMPLATES)
}

/**
 * Production-ready templates ONLY — what the customer-facing selector and
 * landing page must use. Anything not at the full production bar (status !==
 * 'ready') is excluded, never shown as a disabled/coming-soon shell.
 */
export function listReadyTemplates(): WorkforceTemplate[] {
  return Object.values(WORKFORCE_TEMPLATES).filter((t) => t.status === 'ready')
}
