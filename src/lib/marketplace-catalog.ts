/**
 * Mission Control — Marketplace Catalog (operator-facing)
 *
 * Source of truth for:
 *   - 49 Skills (one-time installable capabilities)
 *   - 23 AI Employees (monthly workforce subscriptions)
 *   - 7 Bundles (preset teams / skill packs)
 *
 * Customer-facing strings live here. Slugs are internal. Prices follow the
 * spec exactly — do not invent new ones.
 *
 * Used by:
 *   - /api/marketplace/catalog  (GET — read-only list)
 *   - /marketplace               (page UI)
 *   - scripts/seed-demo-workspace.ts (sample installs per demo persona)
 */

export type Difficulty = 'Easy' | 'Standard' | 'Moderate' | 'Advanced' | 'Expert'

export interface SkillProduct {
  type: 'skill'
  slug: string
  name: string
  category: 'Property Management' | 'Pipeline Workflows' | 'AI Agents' | 'AI Intelligence' | 'Home Services'
  priceUsd: number               // one-time
  billing: 'one-time'
  difficulty: Difficulty
  outcome: string                // what the operator gets
  forWhom: string                // who it's built for
  improvesWorkflow: string       // what workflow it improves
  timeSaved: string              // human-readable estimate
  integrations?: string[]
  relatedSlugs?: string[]
}

export interface EmployeeProduct {
  type: 'employee'
  slug: string
  name: string
  division: 'Leadership & Orchestration' | 'PM Division' | 'Mortgage Division' | 'Real Estate Division' | 'Tax & Finance' | 'Specialist Leads'
  role: string
  monthlyUsd: number
  billing: 'monthly'
  outcome: string
  forWhom: string
  reportsTo?: string
  manages?: string[]
}

export interface Bundle {
  slug: string
  name: string
  tagline: string
  category: 'Business Team' | 'Industry Pack'
  monthlyUsd: number             // sum of included employee monthlies
  oneTimeUsd: number             // sum of included skill prices
  estimatedHoursSavedPerMonth: number
  employeeSlugs: string[]
  skillSlugs: string[]
  linkedDemoTemplate?: string    // demo workspace it powers
  icon: string
}

// ---------- SKILLS (49 total) ----------

export const SKILLS: SkillProduct[] = [
  // Property Management (11)
  { type: 'skill', slug: 'owner-approval', name: 'Smart Owner Approval', category: 'Property Management', priceUsd: 50, billing: 'one-time', difficulty: 'Easy', outcome: 'Route owner decisions to the right inbox automatically.', forWhom: 'Property managers handling 50+ doors.', improvesWorkflow: 'Owner approvals', timeSaved: '~3 hr/week' },
  { type: 'skill', slug: 'owner-reporting', name: 'Owner Report Generator', category: 'Property Management', priceUsd: 50, billing: 'one-time', difficulty: 'Easy', outcome: 'Auto-generated monthly owner statements with photos.', forWhom: 'Property managers.', improvesWorkflow: 'Monthly owner reporting', timeSaved: '~6 hr/month' },
  { type: 'skill', slug: 'pm-lead-qualification', name: 'Lead Qualification Agent', category: 'Property Management', priceUsd: 75, billing: 'one-time', difficulty: 'Standard', outcome: 'Score and pre-qualify rental inquiries before a human sees them.', forWhom: 'Leasing teams.', improvesWorkflow: 'Inbound lead pipeline', timeSaved: '~8 hr/week' },
  { type: 'skill', slug: 'tenant-intake', name: 'Tenant Communications', category: 'Property Management', priceUsd: 75, billing: 'one-time', difficulty: 'Moderate', outcome: 'First-touch tenant replies, on-brand, 24/7.', forWhom: 'PM front-desk teams.', improvesWorkflow: 'Tenant comms', timeSaved: '~10 hr/week' },
  { type: 'skill', slug: 'pm-maintenance-triage', name: 'Maintenance Triage Agent', category: 'Property Management', priceUsd: 75, billing: 'one-time', difficulty: 'Standard', outcome: 'Diagnose severity, route to the right vendor, schedule.', forWhom: 'Maintenance coordinators.', improvesWorkflow: 'Work-order triage', timeSaved: '~12 hr/week' },
  { type: 'skill', slug: 'pm-tenant-onboarding', name: 'Tenant Onboarding Workflow', category: 'Property Management', priceUsd: 100, billing: 'one-time', difficulty: 'Moderate', outcome: 'Move-in packets, utility setup, key handoffs — done.', forWhom: 'Leasing & ops.', improvesWorkflow: 'New tenant onboarding', timeSaved: '~5 hr per move-in' },
  { type: 'skill', slug: 'compliance-audit', name: 'Compliance Audit Engine', category: 'Property Management', priceUsd: 125, billing: 'one-time', difficulty: 'Advanced', outcome: 'Continuous compliance checks against state & federal rules.', forWhom: 'Multi-state operators.', improvesWorkflow: 'Compliance', timeSaved: '~15 hr/month' },
  { type: 'skill', slug: 'lease-management', name: 'Lease Management', category: 'Property Management', priceUsd: 125, billing: 'one-time', difficulty: 'Advanced', outcome: 'Lease abstraction, key dates, renewal reminders, e-sign chase.', forWhom: 'PM operators.', improvesWorkflow: 'Lease lifecycle', timeSaved: '~10 hr/month' },
  { type: 'skill', slug: 'pipeline-unit-turn', name: 'Unit Turn Workflow', category: 'Property Management', priceUsd: 125, billing: 'one-time', difficulty: 'Advanced', outcome: 'Punchlist → vendors → re-list, with daily standup.', forWhom: 'Maintenance + leasing.', improvesWorkflow: 'Unit turns', timeSaved: '~2 days per turn' },
  { type: 'skill', slug: 'pm-lease-renewal', name: 'Lease Renewal Agent', category: 'Property Management', priceUsd: 125, billing: 'one-time', difficulty: 'Advanced', outcome: 'Predict renewal risk, write the outreach, close it.', forWhom: 'PM operators.', improvesWorkflow: 'Renewal retention', timeSaved: '~1 hr per renewal' },
  { type: 'skill', slug: 'turn-lifecycle', name: 'Unit Turn / Make-Ready', category: 'Property Management', priceUsd: 150, billing: 'one-time', difficulty: 'Expert', outcome: 'End-to-end turn orchestration with vendor SLAs.', forWhom: 'Mid-to-large PMs.', improvesWorkflow: 'Make-ready', timeSaved: 'cuts turn time ~30%' },

  // Pipeline Workflows (11)
  { type: 'skill', slug: 'pipeline-review-response', name: 'Review Response Agent', category: 'Pipeline Workflows', priceUsd: 50, billing: 'one-time', difficulty: 'Easy', outcome: 'Drafts on-brand responses to every Google/Yelp/Trustpilot review.', forWhom: 'Local service businesses.', improvesWorkflow: 'Online reputation', timeSaved: '~4 hr/week' },
  { type: 'skill', slug: 'severity-triage', name: 'Severity Triage & Routing', category: 'Pipeline Workflows', priceUsd: 50, billing: 'one-time', difficulty: 'Moderate', outcome: 'Reads incoming tickets, assigns severity, routes.', forWhom: 'Support / ops.', improvesWorkflow: 'Ticket triage', timeSaved: '~6 hr/week' },
  { type: 'skill', slug: 'pipeline-cold-email', name: 'Cold Email Sequencer', category: 'Pipeline Workflows', priceUsd: 75, billing: 'one-time', difficulty: 'Moderate', outcome: 'Multi-step outreach with reply detection.', forWhom: 'Sales teams.', improvesWorkflow: 'Outbound sales', timeSaved: '~10 hr/week per rep' },
  { type: 'skill', slug: 'ai-feedback-loop', name: 'Feedback Loop Analyzer', category: 'Pipeline Workflows', priceUsd: 75, billing: 'one-time', difficulty: 'Standard', outcome: 'Surfaces top customer complaints from tickets & reviews.', forWhom: 'Product + ops.', improvesWorkflow: 'Voice of customer', timeSaved: '~8 hr/month' },
  { type: 'skill', slug: 'qc-closeout', name: 'QC & Closeout Review', category: 'Pipeline Workflows', priceUsd: 75, billing: 'one-time', difficulty: 'Standard', outcome: 'Photo + checklist QC before invoicing the customer.', forWhom: 'Field-service ops.', improvesWorkflow: 'Job closeout', timeSaved: '~5 hr/week' },
  { type: 'skill', slug: 'pipeline-lead-scoring', name: 'Lead Scoring Pipeline', category: 'Pipeline Workflows', priceUsd: 75, billing: 'one-time', difficulty: 'Moderate', outcome: 'Ranks inbound leads by close probability.', forWhom: 'Sales teams.', improvesWorkflow: 'Lead routing', timeSaved: '~7 hr/week' },
  { type: 'skill', slug: 'pipeline-invoice-chase', name: 'Invoice Chase & AR', category: 'Pipeline Workflows', priceUsd: 75, billing: 'one-time', difficulty: 'Standard', outcome: 'Polite-but-firm AR follow-up sequences.', forWhom: 'Finance.', improvesWorkflow: 'AR collection', timeSaved: '~12 hr/month' },
  { type: 'skill', slug: 'maintenance-intake', name: 'Maintenance Intake Classification', category: 'Pipeline Workflows', priceUsd: 75, billing: 'one-time', difficulty: 'Moderate', outcome: 'Classify maintenance requests into trades & priorities.', forWhom: 'Facilities + PM.', improvesWorkflow: 'Intake triage', timeSaved: '~6 hr/week' },
  { type: 'skill', slug: 'vendor-dispatch', name: 'Vendor Auto-Dispatch', category: 'Pipeline Workflows', priceUsd: 100, billing: 'one-time', difficulty: 'Advanced', outcome: 'Pick the best vendor, send the job, confirm acceptance.', forWhom: 'Service ops.', improvesWorkflow: 'Dispatch', timeSaved: '~15 hr/week' },
  { type: 'skill', slug: 'inspection-proof', name: 'Inspection Proof Documentation', category: 'Pipeline Workflows', priceUsd: 125, billing: 'one-time', difficulty: 'Advanced', outcome: 'Photo + GPS + timestamp evidence packets for every job.', forWhom: 'Field service.', improvesWorkflow: 'Compliance & dispute prevention', timeSaved: '~3 hr per dispute avoided' },
  { type: 'skill', slug: 'pipeline-seo-audit', name: 'SEO Audit Workflow', category: 'Pipeline Workflows', priceUsd: 125, billing: 'one-time', difficulty: 'Advanced', outcome: 'Weekly SEO audit with prioritized fixes.', forWhom: 'Marketing teams.', improvesWorkflow: 'Organic growth', timeSaved: '~5 hr/week' },

  // AI Agents (14)
  { type: 'skill', slug: 'pdf-generation', name: 'PDF Document Generation', category: 'AI Agents', priceUsd: 25, billing: 'one-time', difficulty: 'Easy', outcome: 'Branded PDFs (proposals, invoices, statements) on demand.', forWhom: 'Everyone.', improvesWorkflow: 'Document output', timeSaved: '~2 hr/week' },
  { type: 'skill', slug: 'revenue-standup', name: 'Daily Revenue Standup', category: 'AI Agents', priceUsd: 25, billing: 'one-time', difficulty: 'Easy', outcome: '60-second daily revenue snapshot delivered to Slack.', forWhom: 'Founders & CFOs.', improvesWorkflow: 'Daily reporting', timeSaved: '~15 min/day' },
  { type: 'skill', slug: 'cron-automation', name: 'Cron Automation Engine', category: 'AI Agents', priceUsd: 50, billing: 'one-time', difficulty: 'Easy', outcome: 'Schedule any AI employee to run on a cadence.', forWhom: 'Ops teams.', improvesWorkflow: 'Recurring jobs', timeSaved: '~hours of forgotten work' },
  { type: 'skill', slug: 'quote-tracker', name: 'Quote Response Tracker', category: 'AI Agents', priceUsd: 50, billing: 'one-time', difficulty: 'Moderate', outcome: 'Tracks quotes sent vs accepted; nudges silent leads.', forWhom: 'Service sales.', improvesWorkflow: 'Quote follow-up', timeSaved: '~5 hr/week' },
  { type: 'skill', slug: 'market-intel', name: 'Market Intelligence', category: 'AI Agents', priceUsd: 75, billing: 'one-time', difficulty: 'Moderate', outcome: 'Daily competitor & market signal scan.', forWhom: 'Founders.', improvesWorkflow: 'Strategy intel', timeSaved: '~3 hr/week' },
  { type: 'skill', slug: 'ai-proposal-gen', name: 'Proposal Generator', category: 'AI Agents', priceUsd: 75, billing: 'one-time', difficulty: 'Standard', outcome: 'Personalized proposals from a 3-line brief.', forWhom: 'Sales.', improvesWorkflow: 'Proposals', timeSaved: '~45 min per proposal' },
  { type: 'skill', slug: 'lead-pipeline', name: 'Lead Pipeline Scraper', category: 'AI Agents', priceUsd: 75, billing: 'one-time', difficulty: 'Moderate', outcome: 'Net-new lead lists from public sources.', forWhom: 'Outbound sales.', improvesWorkflow: 'Sourcing', timeSaved: '~6 hr/week' },
  { type: 'skill', slug: 'ai-social-calendar', name: 'Social Content Calendar', category: 'AI Agents', priceUsd: 100, billing: 'one-time', difficulty: 'Moderate', outcome: '30-day content calendar in your voice.', forWhom: 'Marketing.', improvesWorkflow: 'Content ops', timeSaved: '~8 hr/month' },
  { type: 'skill', slug: 'ai-vendor-bid-compare', name: 'Vendor Bid Comparison Agent', category: 'AI Agents', priceUsd: 100, billing: 'one-time', difficulty: 'Advanced', outcome: 'Side-by-side bid analysis with risk flags.', forWhom: 'Construction & PM.', improvesWorkflow: 'Procurement', timeSaved: '~3 hr per project' },
  { type: 'skill', slug: 'ai-competitor-scout', name: 'Competitor Scout', category: 'AI Agents', priceUsd: 100, billing: 'one-time', difficulty: 'Advanced', outcome: 'Weekly digest of competitor moves.', forWhom: 'Strategy.', improvesWorkflow: 'Competitive intel', timeSaved: '~4 hr/week' },
  { type: 'skill', slug: 'cpa-agent-team', name: 'CPA Agent Team', category: 'AI Agents', priceUsd: 125, billing: 'one-time', difficulty: 'Expert', outcome: 'Senior CPA + research + intake working together.', forWhom: 'Tax practices.', improvesWorkflow: 'Tax prep', timeSaved: '~20 hr per return' },
  { type: 'skill', slug: 'ai-bookkeeper', name: 'Bookkeeper Reconciler', category: 'AI Agents', priceUsd: 125, billing: 'one-time', difficulty: 'Advanced', outcome: 'Daily transaction categorization & reconciliation.', forWhom: 'Bookkeepers / CFOs.', improvesWorkflow: 'Bookkeeping', timeSaved: '~10 hr/week' },
  { type: 'skill', slug: 'dispatch-engine', name: 'Dispatch Engine', category: 'AI Agents', priceUsd: 125, billing: 'one-time', difficulty: 'Advanced', outcome: 'Smart job-to-tech routing with windowing.', forWhom: 'Field service.', improvesWorkflow: 'Dispatch ops', timeSaved: '~20 hr/week' },
  { type: 'skill', slug: 'workflow-builder', name: 'Workflow Builder', category: 'AI Agents', priceUsd: 150, billing: 'one-time', difficulty: 'Expert', outcome: 'Drag-and-drop builder to compose AI workflows.', forWhom: 'Ops leaders.', improvesWorkflow: 'Process design', timeSaved: 'compounding' },

  // AI Intelligence (7)
  { type: 'skill', slug: 'evidence-ledger', name: 'Evidence Ledger', category: 'AI Intelligence', priceUsd: 75, billing: 'one-time', difficulty: 'Standard', outcome: 'Tamper-evident log of every AI decision.', forWhom: 'Regulated industries.', improvesWorkflow: 'Audit trail', timeSaved: 'reduces audit pain' },
  { type: 'skill', slug: 'ai-route-planner', name: 'Route Optimization Planner', category: 'AI Intelligence', priceUsd: 100, billing: 'one-time', difficulty: 'Advanced', outcome: 'Optimal daily routes for field teams.', forWhom: 'Field-service ops.', improvesWorkflow: 'Routing', timeSaved: '~1 hr/tech/day' },
  { type: 'skill', slug: 'voice-notifications', name: 'Voice Notification Pipeline', category: 'AI Intelligence', priceUsd: 100, billing: 'one-time', difficulty: 'Standard', outcome: 'Voice calls for high-priority events.', forWhom: 'On-call teams.', improvesWorkflow: 'Critical alerts', timeSaved: 'cuts response by ~70%' },
  { type: 'skill', slug: 'ai-price-optimizer', name: 'Price Optimizer', category: 'AI Intelligence', priceUsd: 125, billing: 'one-time', difficulty: 'Advanced', outcome: 'Dynamic pricing per market + competitor signal.', forWhom: 'Revenue teams.', improvesWorkflow: 'Pricing', timeSaved: '~3-7% margin lift' },
  { type: 'skill', slug: 'ai-owner-reporting', name: 'Owner Report Agent', category: 'AI Intelligence', priceUsd: 150, billing: 'one-time', difficulty: 'Expert', outcome: 'Personalized owner reports with narrative summary.', forWhom: 'PM operators.', improvesWorkflow: 'Owner relations', timeSaved: '~8 hr/month' },
  { type: 'skill', slug: 'business-memory', name: 'Business Memory Layer', category: 'AI Intelligence', priceUsd: 150, billing: 'one-time', difficulty: 'Expert', outcome: 'Long-term semantic memory across every AI employee.', forWhom: 'Whole workforce.', improvesWorkflow: 'Continuity', timeSaved: 'compounding' },
  { type: 'skill', slug: 'ai-compliance-copilot', name: 'Compliance Copilot', category: 'AI Intelligence', priceUsd: 150, billing: 'one-time', difficulty: 'Expert', outcome: 'Always-on compliance partner for regulated work.', forWhom: 'Regulated ops.', improvesWorkflow: 'Compliance', timeSaved: '~20 hr/month' },

  // Home Services (6)
  { type: 'skill', slug: 'home-hvac-dispatch', name: 'HVAC Dispatch Scheduler', category: 'Home Services', priceUsd: 75, billing: 'one-time', difficulty: 'Standard', outcome: 'Optimized HVAC service scheduling.', forWhom: 'HVAC operators.', improvesWorkflow: 'Service dispatch', timeSaved: '~10 hr/week' },
  { type: 'skill', slug: 'home-asphalt-estimator', name: 'Asphalt Estimator', category: 'Home Services', priceUsd: 100, billing: 'one-time', difficulty: 'Advanced', outcome: 'Photo-based asphalt repair estimates.', forWhom: 'Paving contractors.', improvesWorkflow: 'Estimating', timeSaved: '~30 min per quote' },
  { type: 'skill', slug: 'home-landscape-estimator', name: 'Landscape Estimator', category: 'Home Services', priceUsd: 100, billing: 'one-time', difficulty: 'Advanced', outcome: 'Photo + satellite landscape quote in 60s.', forWhom: 'Landscape contractors.', improvesWorkflow: 'Estimating', timeSaved: '~25 min per quote' },
  { type: 'skill', slug: 'cost-estimator', name: 'AI Cost Estimator', category: 'Home Services', priceUsd: 100, billing: 'one-time', difficulty: 'Standard', outcome: 'Generic cost estimator for any service line.', forWhom: 'Field service.', improvesWorkflow: 'Quoting', timeSaved: '~30 min per quote' },
  { type: 'skill', slug: 'home-roof-triage', name: 'Roof Repair vs Replace', category: 'Home Services', priceUsd: 125, billing: 'one-time', difficulty: 'Expert', outcome: 'Photo-based repair vs replace recommendation.', forWhom: 'Roofers.', improvesWorkflow: 'Estimating', timeSaved: '~1 hr per inspection' },
  { type: 'skill', slug: 'ai-scoping', name: 'AI Scope Generation', category: 'Home Services', priceUsd: 150, billing: 'one-time', difficulty: 'Expert', outcome: 'Full scope-of-work documents from a site visit.', forWhom: 'General contractors.', improvesWorkflow: 'Scope writing', timeSaved: '~2 hr per project' },
]

// ---------- AI EMPLOYEES (23 total) ----------

export const EMPLOYEES: EmployeeProduct[] = [
  // Leadership & Orchestration (2)
  { type: 'employee', slug: 'agent-michael', name: 'Michael', division: 'Leadership & Orchestration', role: 'CEO', monthlyUsd: 750, billing: 'monthly', outcome: 'Sets the strategic agenda, prioritizes the workforce, escalates only what truly needs you.', forWhom: 'Operators who want a strategic layer above the doers.' },
  { type: 'employee', slug: 'agent-vito', name: 'Vito', division: 'Leadership & Orchestration', role: 'Operations Director', monthlyUsd: 600, billing: 'monthly', outcome: 'Runs the daily operational tempo across every division.', forWhom: 'Multi-division operators.', reportsTo: 'agent-michael' },

  // PM Division (6)
  { type: 'employee', slug: 'agent-phil', name: 'Phil', division: 'PM Division', role: 'PM Division Chief', monthlyUsd: 600, billing: 'monthly', outcome: 'Owns property management outcomes end-to-end.', forWhom: 'PM owner-operators.' },
  { type: 'employee', slug: 'emp-pm-cfo', name: 'PM Financial Intelligence', division: 'PM Division', role: 'Financial Intelligence Agent', monthlyUsd: 600, billing: 'monthly', outcome: 'Variance, NOI, owner statements, and rolling cash forecast.', forWhom: 'PMs with multi-owner portfolios.' },
  { type: 'employee', slug: 'emp-pm-dispatcher', name: 'PM Operations & Dispatch', division: 'PM Division', role: 'Operations & Vendor Dispatch Agent', monthlyUsd: 500, billing: 'monthly', outcome: 'Triage, dispatch, confirm, close — every work order.', forWhom: 'Maintenance ops.' },
  { type: 'employee', slug: 'emp-pm-compliance', name: 'PM Compliance Officer', division: 'PM Division', role: 'Risk & Regulatory Compliance Agent', monthlyUsd: 450, billing: 'monthly', outcome: 'State, federal, fair-housing compliance — continuously.', forWhom: 'Multi-state PMs.' },
  { type: 'employee', slug: 'emp-pm-account-manager', name: 'PM Account Manager', division: 'PM Division', role: 'Client Retention & Growth Agent', monthlyUsd: 400, billing: 'monthly', outcome: 'Owner relationships, renewals, growth conversations.', forWhom: 'Owner-facing teams.' },
  { type: 'employee', slug: 'emp-pm-receptionist', name: 'PM Front-Door Triage', division: 'PM Division', role: 'Front-Door Triage Agent', monthlyUsd: 300, billing: 'monthly', outcome: 'First touch for every inbound call/text/email.', forWhom: 'PM front office.' },

  // Mortgage Division (5)
  { type: 'employee', slug: 'emp-mo-cfo', name: 'Mortgage Pipeline CFO', division: 'Mortgage Division', role: 'LOS Management & Pipeline Analytics Agent', monthlyUsd: 600, billing: 'monthly', outcome: 'Pipeline KPIs, pull-through, capacity planning.', forWhom: 'Mortgage brokers & lenders.' },
  { type: 'employee', slug: 'emp-mo-dispatcher', name: 'Mortgage Document Coordinator', division: 'Mortgage Division', role: 'Document Collection & Process Agent', monthlyUsd: 500, billing: 'monthly', outcome: 'Chases every missing doc; clears stips.', forWhom: 'Processors.' },
  { type: 'employee', slug: 'emp-mo-compliance', name: 'Mortgage Compliance Officer', division: 'Mortgage Division', role: 'Regulatory Compliance & Rate Monitoring Agent', monthlyUsd: 450, billing: 'monthly', outcome: 'TRID/RESPA + rate sheet vigilance.', forWhom: 'Lenders.' },
  { type: 'employee', slug: 'emp-mo-account-manager', name: 'Mortgage Account Manager', division: 'Mortgage Division', role: 'Referral Generation & Client Management Agent', monthlyUsd: 400, billing: 'monthly', outcome: 'Past-client nurture & referral generation.', forWhom: 'LOs.' },
  { type: 'employee', slug: 'emp-mo-receptionist', name: 'Mortgage Pre-Qualifier', division: 'Mortgage Division', role: 'Pre-Qualification & Intake Agent', monthlyUsd: 300, billing: 'monthly', outcome: 'Pre-quals every new lead within minutes.', forWhom: 'Front office.' },

  // Real Estate Division (4)
  { type: 'employee', slug: 'emp-re-cfo', name: 'Real Estate Deal Analyst', division: 'Real Estate Division', role: 'Deal Pipeline & Commission Agent', monthlyUsd: 500, billing: 'monthly', outcome: 'Track deals, project commissions, surface stalls.', forWhom: 'Brokerages.' },
  { type: 'employee', slug: 'emp-re-dispatcher', name: 'Real Estate Transaction Coordinator', division: 'Real Estate Division', role: 'Showing & Transaction Coordinator Agent', monthlyUsd: 500, billing: 'monthly', outcome: 'Schedules showings, manages timeline to close.', forWhom: 'Agents & TCs.' },
  { type: 'employee', slug: 'emp-re-account-manager', name: 'Real Estate Client Nurture', division: 'Real Estate Division', role: 'Client Nurturing & Referral Agent', monthlyUsd: 400, billing: 'monthly', outcome: 'Past-client database, anniversaries, referrals.', forWhom: 'Agents.' },
  { type: 'employee', slug: 'emp-re-receptionist', name: 'Real Estate Lead Capture', division: 'Real Estate Division', role: 'Lead Capture & Qualification Agent', monthlyUsd: 300, billing: 'monthly', outcome: 'Inbound lead capture + qualify + book.', forWhom: 'Agents & teams.' },

  // Tax & Finance (3)
  { type: 'employee', slug: 'lead-cpa-agent', name: 'Senior CPA', division: 'Tax & Finance', role: 'Senior Certified Public Accountant', monthlyUsd: 499, billing: 'monthly', outcome: 'Reviews returns, signs the work, runs the team.', forWhom: 'Tax practices.' },
  { type: 'employee', slug: 'tax-research-agent', name: 'Tax Research Specialist', division: 'Tax & Finance', role: 'Tax Code Specialist', monthlyUsd: 199, billing: 'monthly', outcome: 'Deep tax-code research with citations.', forWhom: 'CPAs.', reportsTo: 'lead-cpa-agent' },
  { type: 'employee', slug: 'document-intake-agent', name: 'Tax Document Intake', division: 'Tax & Finance', role: 'Tax Document Processor', monthlyUsd: 99, billing: 'monthly', outcome: 'Collects, classifies, OCRs every client doc.', forWhom: 'CPA front office.', reportsTo: 'lead-cpa-agent' },

  // Specialist Leads (3)
  { type: 'employee', slug: 'agent-lester', name: 'Lester', division: 'Specialist Leads', role: 'VisionOps Lead', monthlyUsd: 650, billing: 'monthly', outcome: 'Vision-based inspection, estimating, QC.', forWhom: 'Field-service operators with photo workflows.' },
  { type: 'employee', slug: 'agent-hermes', name: 'Hermes', division: 'Specialist Leads', role: 'VoiceOps & Execution', monthlyUsd: 550, billing: 'monthly', outcome: 'Voice-first task execution & live escalation.', forWhom: 'Phone-heavy ops.' },
  { type: 'employee', slug: 'agent-beth', name: 'Beth', division: 'Specialist Leads', role: 'Revenue & Pricing Lead', monthlyUsd: 500, billing: 'monthly', outcome: 'Pricing experiments + margin defense.', forWhom: 'Revenue teams.' },
]

// ---------- BUNDLES (7) ----------

const sumEmp = (slugs: string[]) =>
  slugs.reduce((s, slug) => s + (EMPLOYEES.find((e) => e.slug === slug)?.monthlyUsd ?? 0), 0)
const sumSkill = (slugs: string[]) =>
  slugs.reduce((s, slug) => s + (SKILLS.find((sk) => sk.slug === slug)?.priceUsd ?? 0), 0)

export const BUNDLES: Bundle[] = [
  {
    slug: 'pm-operations-team',
    name: 'PM Operations Team',
    tagline: 'Run a property management business with 6 AI employees and the skills they need.',
    category: 'Business Team',
    icon: '🏘️',
    employeeSlugs: ['agent-phil', 'emp-pm-cfo', 'emp-pm-dispatcher', 'emp-pm-compliance', 'emp-pm-account-manager', 'emp-pm-receptionist'],
    skillSlugs: ['pm-maintenance-triage', 'pm-lease-renewal', 'owner-reporting', 'tenant-intake'],
    monthlyUsd: sumEmp(['agent-phil', 'emp-pm-cfo', 'emp-pm-dispatcher', 'emp-pm-compliance', 'emp-pm-account-manager', 'emp-pm-receptionist']),
    oneTimeUsd: sumSkill(['pm-maintenance-triage', 'pm-lease-renewal', 'owner-reporting', 'tenant-intake']),
    estimatedHoursSavedPerMonth: 220,
    linkedDemoTemplate: 'property-management',
  },
  {
    slug: 'mortgage-ops-team',
    name: 'Mortgage Ops Team',
    tagline: 'Pipeline, processing, compliance, and intake — all running.',
    category: 'Business Team',
    icon: '🏦',
    employeeSlugs: ['emp-mo-cfo', 'emp-mo-dispatcher', 'emp-mo-compliance', 'emp-mo-account-manager', 'emp-mo-receptionist'],
    skillSlugs: ['pipeline-lead-scoring', 'pipeline-invoice-chase', 'pdf-generation'],
    monthlyUsd: sumEmp(['emp-mo-cfo', 'emp-mo-dispatcher', 'emp-mo-compliance', 'emp-mo-account-manager', 'emp-mo-receptionist']),
    oneTimeUsd: sumSkill(['pipeline-lead-scoring', 'pipeline-invoice-chase', 'pdf-generation']),
    estimatedHoursSavedPerMonth: 180,
    linkedDemoTemplate: 'mortgage',
  },
  {
    slug: 'real-estate-sales-team',
    name: 'Real Estate Sales Team',
    tagline: 'Lead capture → nurture → transaction coordination.',
    category: 'Business Team',
    icon: '🏡',
    employeeSlugs: ['emp-re-cfo', 'emp-re-dispatcher', 'emp-re-account-manager', 'emp-re-receptionist'],
    skillSlugs: ['ai-proposal-gen', 'ai-social-calendar', 'pipeline-cold-email'],
    monthlyUsd: sumEmp(['emp-re-cfo', 'emp-re-dispatcher', 'emp-re-account-manager', 'emp-re-receptionist']),
    oneTimeUsd: sumSkill(['ai-proposal-gen', 'ai-social-calendar', 'pipeline-cold-email']),
    estimatedHoursSavedPerMonth: 140,
    linkedDemoTemplate: 'real-estate',
  },
  {
    slug: 'cpa-tax-team',
    name: 'CPA Tax Team',
    tagline: 'Senior CPA + research + intake — a complete tax practice.',
    category: 'Business Team',
    icon: '🧾',
    employeeSlugs: ['lead-cpa-agent', 'tax-research-agent', 'document-intake-agent'],
    skillSlugs: ['cpa-agent-team', 'ai-bookkeeper', 'pdf-generation'],
    monthlyUsd: sumEmp(['lead-cpa-agent', 'tax-research-agent', 'document-intake-agent']),
    oneTimeUsd: sumSkill(['cpa-agent-team', 'ai-bookkeeper', 'pdf-generation']),
    estimatedHoursSavedPerMonth: 160,
    linkedDemoTemplate: 'cpa',
  },
  {
    slug: 'home-services-estimator-pack',
    name: 'Home Services Estimator Pack',
    tagline: 'Photo-in, estimate-out — for roofing, paving, landscape, HVAC.',
    category: 'Industry Pack',
    icon: '🛠️',
    employeeSlugs: ['agent-lester', 'agent-beth'],
    skillSlugs: ['home-roof-triage', 'home-asphalt-estimator', 'home-landscape-estimator', 'home-hvac-dispatch', 'cost-estimator', 'ai-scoping'],
    monthlyUsd: sumEmp(['agent-lester', 'agent-beth']),
    oneTimeUsd: sumSkill(['home-roof-triage', 'home-asphalt-estimator', 'home-landscape-estimator', 'home-hvac-dispatch', 'cost-estimator', 'ai-scoping']),
    estimatedHoursSavedPerMonth: 110,
  },
  {
    slug: 'ai-agency-starter',
    name: 'AI Agency Starter Pack',
    tagline: 'Marketing-agency ready: content, SEO, leads, proposals.',
    category: 'Industry Pack',
    icon: '🎯',
    employeeSlugs: ['agent-michael', 'agent-vito', 'agent-beth'],
    skillSlugs: ['ai-social-calendar', 'pipeline-seo-audit', 'ai-proposal-gen', 'pipeline-cold-email', 'pipeline-lead-scoring'],
    monthlyUsd: sumEmp(['agent-michael', 'agent-vito', 'agent-beth']),
    oneTimeUsd: sumSkill(['ai-social-calendar', 'pipeline-seo-audit', 'ai-proposal-gen', 'pipeline-cold-email', 'pipeline-lead-scoring']),
    estimatedHoursSavedPerMonth: 130,
    linkedDemoTemplate: 'marketing',
  },
  {
    slug: 'vision-voice-specialist',
    name: 'VisionOps / VoiceOps Specialist Pack',
    tagline: 'For ops teams that live on photos and the phone.',
    category: 'Industry Pack',
    icon: '👁️',
    employeeSlugs: ['agent-lester', 'agent-hermes'],
    skillSlugs: ['inspection-proof', 'voice-notifications', 'ai-route-planner'],
    monthlyUsd: sumEmp(['agent-lester', 'agent-hermes']),
    oneTimeUsd: sumSkill(['inspection-proof', 'voice-notifications', 'ai-route-planner']),
    estimatedHoursSavedPerMonth: 90,
  },
]

// ---------- LOOKUP HELPERS ----------

export const SKILL_CATEGORIES = [
  'Property Management',
  'Pipeline Workflows',
  'AI Agents',
  'AI Intelligence',
  'Home Services',
] as const

export const EMPLOYEE_DIVISIONS = [
  'Leadership & Orchestration',
  'PM Division',
  'Mortgage Division',
  'Real Estate Division',
  'Tax & Finance',
  'Specialist Leads',
] as const

export function getSkillBySlug(slug: string): SkillProduct | undefined {
  return SKILLS.find((s) => s.slug === slug)
}

export function getEmployeeBySlug(slug: string): EmployeeProduct | undefined {
  return EMPLOYEES.find((e) => e.slug === slug)
}

export function getBundleBySlug(slug: string): Bundle | undefined {
  return BUNDLES.find((b) => b.slug === slug)
}

export const CATALOG_COUNTS = {
  skills: SKILLS.length,        // expected 49
  employees: EMPLOYEES.length,  // expected 23
  bundles: BUNDLES.length,      // expected 7
} as const
