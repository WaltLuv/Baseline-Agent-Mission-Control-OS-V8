/**
 * Extended production verticals (Phase 3 — Production Vertical Completion).
 *
 * Eight full, installable workforce templates built to the production bar Walt
 * set: 6+ personas, 10+ workflows, an approval matrix, required/optional tool
 * credentials, demo data (realistic task descriptions), seeded tasks (one task
 * per workflow at install — idempotent), proof expectations per workflow, and
 * Daily-Brief + ROI compatibility (both read the installed tasks/activity).
 *
 * Marketing Agency and AI Agency are SEPARATE verticals per Walt's directive —
 * not collapsed into a generic "agency".
 *
 * Demo data is intentionally fictional. Any tool that would touch a real
 * external system (MLS, LOS, tax software, case management, field apps, ad
 * platforms) is marked `needs_connect` — never a fake "installed" state.
 */
import type { WorkforceTemplate } from './catalog'

// Shared tool hints reused across verticals (always-on Baseline tools).
const CORE_TOOLS = [
  { cli_tool_id: 'mc', label: 'Mission Control CLI', description: 'Talk to your own supervision plane.', state: 'installed' as const, default_risk: 'low' as const },
  { cli_tool_id: 'notion-q', label: 'Notion API shim', description: 'Client records + report pages.', state: 'installed' as const, default_risk: 'medium' as const },
  { cli_tool_id: 'resend', label: 'Resend (transactional email)', description: 'Client / lead communication.', state: 'installed' as const, default_risk: 'high' as const },
  { cli_tool_id: 'calendar', label: 'Calendar integration', description: 'Scheduling + reminders.', state: 'needs_connect' as const, default_risk: 'low' as const },
]

// ───────────────────────────────────────────────────────────────────
// Real Estate
// ───────────────────────────────────────────────────────────────────
const REAL_ESTATE: WorkforceTemplate = {
  slug: 'real-estate',
  vertical: 'Real Estate',
  headline: 'A six-person real-estate ops team — intake to closing, supervised.',
  tagline: 'Listing prep, lead follow-up, transaction coordination, and post-close nurture without dropping a deal.',
  install_seconds: 60,
  status: 'ready',
  personas: [
    { slug: 're-deal-intake-analyst', name: 'Dana Cole', role: 'Deal Intake Analyst', description: 'Qualifies inbound leads and new deals, scores fit, and routes to the right pipeline.', capabilities: ['lead-qualification', 'deal-scoring', 'crm-intake'] },
    { slug: 're-lead-followup', name: 'Liam Brooks', role: 'Lead Follow-Up Coordinator', description: 'Runs seller and buyer follow-up cadences so no lead goes cold.', capabilities: ['followup-cadence', 'drip-drafts', 'no-show-recovery'] },
    { slug: 're-listing-prep', name: 'Priya Nair', role: 'Listing Prep Manager', description: 'Assembles listing packets: copy, photo shotlist, pricing inputs, and syndication checklist.', capabilities: ['listing-copy', 'cma-inputs', 'syndication-checklist'] },
    { slug: 're-buyer-pipeline', name: 'Marco Ruiz', role: 'Buyer Pipeline Assistant', description: 'Tracks buyer needs, sends matches, and coordinates showings.', capabilities: ['buyer-matching', 'showing-coord', 'pipeline-track'] },
    { slug: 're-transaction-coord', name: 'Sofia Adler', role: 'Transaction Coordinator', description: 'Owns the contract-to-close milestone timeline and document chase.', capabilities: ['milestone-track', 'doc-chase', 'closing-coord'] },
    { slug: 're-investor-analyst', name: 'Theo Grant', role: 'Investor Deal Analyst', description: 'Underwrites investor deals: cap rate, cash-on-cash, rehab and rent assumptions.', capabilities: ['deal-underwriting', 'roi-model', 'comps-analysis'] },
  ],
  workflows: [
    { slug: 're-wf-new-lead-intake', title: 'New lead intake', description: 'A buyer lead came in from the Zillow form for a 3BR in Maple Grove under $450k. Qualify, score, and route.', owner_persona: 're-deal-intake-analyst', tool_hint: 'crm-cli', skill_hint: 'lead-qualification', approval_policy: 'low', proof_expectation: 'CRM lead record id + qualification score', success_criteria: 'Lead qualified, scored, and assigned within 1 business hour.', priority: 'high', demo_seed_count: 2 },
    { slug: 're-wf-seller-followup', title: 'Seller follow-up', description: 'Draft the 3-touch seller follow-up for a homeowner who requested a valuation last week.', owner_persona: 're-lead-followup', tool_hint: 'resend', skill_hint: 'followup-cadence', approval_policy: 'medium', proof_expectation: 'Resend message_id per touch', success_criteria: 'Seller re-engaged or marked not-now with reason.', priority: 'medium' },
    { slug: 're-wf-buyer-followup', title: 'Buyer follow-up', description: 'Send fresh matches and a check-in to a buyer who toured two homes but has gone quiet.', owner_persona: 're-buyer-pipeline', tool_hint: 'resend', skill_hint: 'buyer-matching', approval_policy: 'medium', proof_expectation: 'match list + Resend message_id', success_criteria: 'Buyer replies or a showing is booked.', priority: 'medium' },
    { slug: 're-wf-cma-prep', title: 'CMA preparation', description: 'Build a comparative market analysis packet for 88 Birch Lane using recent comps and pricing bands.', owner_persona: 're-listing-prep', tool_hint: 'mls-cli', skill_hint: 'cma-inputs', approval_policy: 'medium', proof_expectation: 'CMA PDF link + comp set', success_criteria: 'Pricing recommendation delivered with comp support.', priority: 'medium' },
    { slug: 're-wf-listing-launch', title: 'Listing launch checklist', description: 'Run the full listing-launch checklist for a new exclusive: copy, photos, pricing, disclosures, syndication.', owner_persona: 're-listing-prep', tool_hint: 'listing-feed', skill_hint: 'syndication-checklist', approval_policy: 'high', proof_expectation: 'live listing URLs across portals', success_criteria: 'Listing live on all portals within 24h of signed agreement.', priority: 'high' },
    { slug: 're-wf-showing-coord', title: 'Showing coordination', description: 'Coordinate three showing requests this weekend; avoid conflicts and confirm with sellers.', owner_persona: 're-buyer-pipeline', tool_hint: 'calendar', skill_hint: 'showing-coord', approval_policy: 'low', proof_expectation: 'calendar event ids + confirmations', success_criteria: 'All showings booked, confirmed, no double-bookings.', priority: 'medium' },
    { slug: 're-wf-offer-packet', title: 'Offer packet prep', description: 'Assemble an offer packet for a buyer on 12 Cedar Ct: contract, pre-approval, proof of funds, terms summary.', owner_persona: 're-transaction-coord', tool_hint: 'docusign-cli', skill_hint: 'offer-packet', approval_policy: 'high', proof_expectation: 'assembled packet URL + checklist of included docs', success_criteria: 'Complete, accurate offer packet ready for agent review.', priority: 'high' },
    { slug: 're-wf-milestone-track', title: 'Transaction milestone tracking', description: 'Track contract-to-close milestones for 3 active deals: inspection, appraisal, financing, walkthrough.', owner_persona: 're-transaction-coord', tool_hint: 'crm-cli', skill_hint: 'milestone-track', approval_policy: 'medium', proof_expectation: 'milestone tracker with dates per deal', success_criteria: 'No milestone missed; risks flagged 48h ahead.', priority: 'high', demo_seed_count: 2 },
    { slug: 're-wf-inspection-followup', title: 'Inspection follow-up', description: 'Draft the inspection-response plan for items found at 12 Cedar Ct and coordinate repair credits.', owner_persona: 're-transaction-coord', tool_hint: 'docusign-cli', skill_hint: 'inspection-response', approval_policy: 'high', proof_expectation: 'repair addendum draft + negotiation notes', success_criteria: 'Inspection items resolved or credited with sign-off.', priority: 'medium' },
    { slug: 're-wf-closing-checklist', title: 'Closing checklist', description: 'Run the closing checklist for a deal closing Friday: title, funds, final walkthrough, key handoff.', owner_persona: 're-transaction-coord', tool_hint: 'crm-cli', skill_hint: 'closing-coord', approval_policy: 'high', proof_expectation: 'completed closing checklist + closing confirmation', success_criteria: 'Deal closes on time with all items cleared.', priority: 'high' },
  ],
  tools: [
    ...CORE_TOOLS,
    { cli_tool_id: 'crm-cli', label: 'CRM connector', description: 'Follow Up Boss / kvCORE / Sierra.', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'mls-cli', label: 'MLS / comps connector', description: 'Pull comps + listing data (needs your MLS access).', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'listing-feed', label: 'Listing syndication feed', description: 'Push to Zillow / Realtor.com / Redfin.', state: 'needs_connect', default_risk: 'medium' },
    { cli_tool_id: 'docusign-cli', label: 'DocuSign CLI', description: 'Offers, addenda, disclosures.', state: 'needs_connect', default_risk: 'high' },
  ],
  approval_summary: {
    auto: ['Lead scoring, showing scheduling, internal pipeline updates'],
    medium: ['Seller/buyer follow-up drafts, CMA packets, inspection-response drafts'],
    high: ['Listing launch, offer packets, addenda/disclosures, closing actions'],
    blocked: ['Sending contracts without agent sign-off, deleting client records, exposing client financials'],
  },
}

// ───────────────────────────────────────────────────────────────────
// Mortgage
// ───────────────────────────────────────────────────────────────────
const MORTGAGE: WorkforceTemplate = {
  slug: 'mortgage',
  vertical: 'Mortgage',
  headline: 'A loan-ops team that keeps every borrower moving to the clear-to-close.',
  tagline: 'Inquiry triage, doc collection, condition tracking, and LO follow-up — supervised, compliant, fast.',
  install_seconds: 60,
  status: 'ready',
  personas: [
    { slug: 'mtg-loan-intake', name: 'Rosa Méndez', role: 'Loan Intake Specialist', description: 'Triages new loan inquiries, captures the 1003 basics, and routes to the right LO.', capabilities: ['inquiry-triage', '1003-intake', 'lead-routing'] },
    { slug: 'mtg-doc-collection', name: 'Aaron Webb', role: 'Document Collection Coordinator', description: 'Chases borrower documents against the needs list until the file is complete.', capabilities: ['doc-chase', 'needs-list', 'borrower-portal'] },
    { slug: 'mtg-preapproval', name: 'Hana Kim', role: 'Pre-Approval Assistant', description: 'Runs the pre-approval checklist and drafts the pre-approval letter for LO review.', capabilities: ['preapproval-checklist', 'letter-draft', 'dti-check'] },
    { slug: 'mtg-processor-support', name: 'Devin Pratt', role: 'Processor Support Agent', description: 'Preps clean handoffs to processing and tracks underwriting conditions.', capabilities: ['processor-handoff', 'condition-track', 'file-qa'] },
    { slug: 'mtg-rate-analyst', name: 'Carmen Diaz', role: 'Rate Scenario Analyst', description: 'Builds rate/payment scenarios and break-even comparisons for borrowers.', capabilities: ['rate-scenarios', 'payment-calc', 'breakeven-analysis'] },
    { slug: 'mtg-borrower-followup', name: 'Owen Frost', role: 'Borrower Follow-Up Specialist', description: 'Keeps borrowers warm with status updates and post-close referral nurture.', capabilities: ['status-updates', 'referral-nurture', 'cadence-drafts'] },
  ],
  workflows: [
    { slug: 'mtg-wf-new-inquiry', title: 'New loan inquiry', description: 'A purchase borrower submitted an inquiry for a $520k home, ~10% down. Triage and capture 1003 basics.', owner_persona: 'mtg-loan-intake', tool_hint: 'los-cli', skill_hint: 'inquiry-triage', approval_policy: 'low', proof_expectation: 'LOS loan record id + intake summary', success_criteria: 'Inquiry triaged and routed to an LO within 1 hour.', priority: 'high', demo_seed_count: 2 },
    { slug: 'mtg-wf-preapproval', title: 'Pre-approval checklist', description: 'Run the pre-approval checklist for a borrower with W-2 income and one auto loan; draft the letter.', owner_persona: 'mtg-preapproval', tool_hint: 'los-cli', skill_hint: 'preapproval-checklist', approval_policy: 'high', proof_expectation: 'pre-approval letter draft + DTI worksheet', success_criteria: 'Accurate pre-approval letter ready for LO sign-off.', priority: 'high' },
    { slug: 'mtg-wf-doc-collection', title: 'Borrower document collection', description: 'Chase missing docs: 2 paystubs, 2 months bank statements, and the gift letter.', owner_persona: 'mtg-doc-collection', tool_hint: 'borrower-portal-cli', skill_hint: 'doc-chase', approval_policy: 'medium', proof_expectation: 'updated needs-list with received/missing per item', success_criteria: 'File complete against the needs list.', priority: 'high', demo_seed_count: 2 },
    { slug: 'mtg-wf-condition-track', title: 'Credit/asset condition tracking', description: 'Track credit and asset conditions for a file in setup; flag anything aging past 48h.', owner_persona: 'mtg-processor-support', tool_hint: 'los-cli', skill_hint: 'condition-track', approval_policy: 'medium', proof_expectation: 'condition tracker with status + age per item', success_criteria: 'No condition stalls; aging items escalated.', priority: 'medium' },
    { slug: 'mtg-wf-rate-scenario', title: 'Rate scenario prep', description: 'Build three rate/payment scenarios (30yr, 15yr, 7/6 ARM) for a refinance borrower.', owner_persona: 'mtg-rate-analyst', tool_hint: 'rate-cli', skill_hint: 'rate-scenarios', approval_policy: 'medium', proof_expectation: 'scenario comparison sheet + break-even', success_criteria: 'Clear scenario comparison delivered for LO review.', priority: 'medium' },
    { slug: 'mtg-wf-lo-followup', title: 'LO follow-up queue', description: 'Draft the daily LO follow-up queue for borrowers awaiting decisions or docs.', owner_persona: 'mtg-borrower-followup', tool_hint: 'resend', skill_hint: 'cadence-drafts', approval_policy: 'medium', proof_expectation: 'follow-up queue + Resend message_ids', success_criteria: 'Every waiting borrower contacted same day.', priority: 'medium' },
    { slug: 'mtg-wf-processor-handoff', title: 'Processor handoff', description: 'Prepare a clean submission package and handoff notes for processing on a ready file.', owner_persona: 'mtg-processor-support', tool_hint: 'los-cli', skill_hint: 'processor-handoff', approval_policy: 'medium', proof_expectation: 'submission checklist + handoff notes', success_criteria: 'Processing accepts the file with zero rejections.', priority: 'high' },
    { slug: 'mtg-wf-uw-conditions', title: 'Underwriting condition tracker', description: 'Track and route underwriting conditions on a conditionally-approved loan.', owner_persona: 'mtg-processor-support', tool_hint: 'los-cli', skill_hint: 'condition-track', approval_policy: 'high', proof_expectation: 'UW condition tracker with cleared/outstanding', success_criteria: 'All conditions cleared to reach clear-to-close.', priority: 'high' },
    { slug: 'mtg-wf-cd-reminder', title: 'Closing disclosure reminder', description: 'Ensure the CD is acknowledged within the TRID window for a loan closing next week.', owner_persona: 'mtg-borrower-followup', tool_hint: 'resend', skill_hint: 'compliance-reminder', approval_policy: 'high', proof_expectation: 'CD acknowledgment timestamp', success_criteria: 'CD acknowledged inside the required waiting period.', priority: 'high' },
    { slug: 'mtg-wf-postclose-referral', title: 'Post-close referral follow-up', description: 'Send the post-close thank-you and referral ask to a borrower who closed last month.', owner_persona: 'mtg-borrower-followup', tool_hint: 'resend', skill_hint: 'referral-nurture', approval_policy: 'medium', proof_expectation: 'Resend message_id + referral capture', success_criteria: 'Borrower thanked; referral path opened.', priority: 'low' },
  ],
  tools: [
    ...CORE_TOOLS,
    { cli_tool_id: 'los-cli', label: 'LOS connector', description: 'Encompass / Byte / LendingPad (needs your LOS access).', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'borrower-portal-cli', label: 'Borrower portal', description: 'Secure document collection portal.', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'rate-cli', label: 'Pricing engine', description: 'Rate/payment scenarios (needs PPE access).', state: 'needs_connect', default_risk: 'medium' },
  ],
  approval_summary: {
    auto: ['Inquiry triage, internal condition tracking, scenario math'],
    medium: ['Doc-chase messages, follow-up drafts, processor handoff prep'],
    high: ['Pre-approval letters, UW condition clearing, CD/TRID actions, anything compliance-sensitive'],
    blocked: ['Sending pre-approval/CD without LO sign-off, exposing borrower PII, altering credit data'],
  },
}

// ───────────────────────────────────────────────────────────────────
// CPA Firms
// ───────────────────────────────────────────────────────────────────
const CPA: WorkforceTemplate = {
  slug: 'cpa',
  vertical: 'CPA Firms',
  headline: 'A tax + bookkeeping ops team that never misses a deadline or a document.',
  tagline: 'Client intake, document chase, bookkeeping QA, advisory prep, and deadline compliance — supervised.',
  install_seconds: 60,
  status: 'ready',
  personas: [
    { slug: 'cpa-client-intake', name: 'Grace Lin', role: 'Client Intake Coordinator', description: 'Onboards new clients, captures engagement scope, and sets up the file.', capabilities: ['client-onboarding', 'engagement-scope', 'file-setup'] },
    { slug: 'cpa-doc-collection', name: 'Sam Ortiz', role: 'Document Collection Specialist', description: 'Runs the tax-document checklist and chases missing items.', capabilities: ['doc-checklist', 'doc-chase', 'client-portal'] },
    { slug: 'cpa-tax-workflow', name: 'Nadia Hassan', role: 'Tax Workflow Manager', description: 'Routes returns through prep/review/file and tracks status per client.', capabilities: ['workflow-routing', 'status-track', 'review-queue'] },
    { slug: 'cpa-bookkeeping-qa', name: 'Eli Tran', role: 'Bookkeeping QA Analyst', description: 'Reviews monthly books for reconciliation gaps and miscategorizations.', capabilities: ['recon-check', 'categorization-qa', 'anomaly-flag'] },
    { slug: 'cpa-advisory-prep', name: 'Maya Cohen', role: 'Advisory Prep Assistant', description: 'Assembles advisory and planning report drafts from client financials.', capabilities: ['advisory-draft', 'planning-prep', 'financial-summary'] },
    { slug: 'cpa-deadline-monitor', name: 'Victor Salas', role: 'Deadline Compliance Monitor', description: 'Watches every filing deadline and extension window across the book.', capabilities: ['deadline-watch', 'extension-track', 'compliance-alert'] },
  ],
  workflows: [
    { slug: 'cpa-wf-new-intake', title: 'New client intake', description: 'A new S-corp client signed an engagement letter. Set up the file and capture scope and prior-year data.', owner_persona: 'cpa-client-intake', tool_hint: 'tax-cli', skill_hint: 'client-onboarding', approval_policy: 'low', proof_expectation: 'client file id + engagement scope summary', success_criteria: 'Client file set up with scope and prior-year basics captured.', priority: 'medium', demo_seed_count: 2 },
    { slug: 'cpa-wf-tax-doc-checklist', title: 'Tax document checklist', description: 'Generate the personalized tax-document checklist for an individual return with rental income.', owner_persona: 'cpa-doc-collection', tool_hint: 'client-portal-cli', skill_hint: 'doc-checklist', approval_policy: 'low', proof_expectation: 'checklist sent + portal link', success_criteria: 'Client receives a tailored, complete checklist.', priority: 'high' },
    { slug: 'cpa-wf-missing-doc-followup', title: 'Missing document follow-up', description: 'Chase the three missing items (1099-B, mortgage interest, K-1) for a return due in 10 days.', owner_persona: 'cpa-doc-collection', tool_hint: 'resend', skill_hint: 'doc-chase', approval_policy: 'medium', proof_expectation: 'Resend message_id + updated checklist', success_criteria: 'Missing docs received or escalated before deadline.', priority: 'high', demo_seed_count: 2 },
    { slug: 'cpa-wf-monthly-bookkeeping', title: 'Monthly bookkeeping review', description: 'QA last month\'s books for a client: bank/CC reconciliation and uncategorized transactions.', owner_persona: 'cpa-bookkeeping-qa', tool_hint: 'bookkeeping-cli', skill_hint: 'recon-check', approval_policy: 'medium', proof_expectation: 'reconciliation report + flagged entries', success_criteria: 'Books reconciled; exceptions flagged for client.', priority: 'medium' },
    { slug: 'cpa-wf-client-question', title: 'Client question triage', description: 'A client asked whether they can deduct a home office. Draft a careful, caveated response for CPA review.', owner_persona: 'cpa-tax-workflow', tool_hint: 'resend', skill_hint: 'question-triage', approval_policy: 'high', proof_expectation: 'drafted response + sources', success_criteria: 'Accurate, caveated answer ready for CPA sign-off.', priority: 'medium' },
    { slug: 'cpa-wf-entity-compliance', title: 'Entity compliance reminder', description: 'Flag upcoming entity compliance items: annual report, S-corp reasonable comp, quarterly estimates.', owner_persona: 'cpa-deadline-monitor', tool_hint: 'calendar', skill_hint: 'compliance-alert', approval_policy: 'low', proof_expectation: 'compliance calendar entries', success_criteria: 'All entity obligations scheduled with reminders.', priority: 'medium' },
    { slug: 'cpa-wf-advisory-report', title: 'Advisory report prep', description: 'Draft a mid-year tax-planning advisory for a client with a large capital gain expected.', owner_persona: 'cpa-advisory-prep', tool_hint: 'bookkeeping-cli', skill_hint: 'advisory-draft', approval_policy: 'high', proof_expectation: 'advisory draft PDF + assumptions', success_criteria: 'Planning report ready for CPA review and client meeting.', priority: 'medium' },
    { slug: 'cpa-wf-deadline-tracker', title: 'Tax deadline tracker', description: 'Maintain the firm deadline tracker across all clients through the next filing window.', owner_persona: 'cpa-deadline-monitor', tool_hint: 'tax-cli', skill_hint: 'deadline-watch', approval_policy: 'medium', proof_expectation: 'deadline tracker with status per client', success_criteria: 'No client deadline at risk without an extension plan.', priority: 'high', demo_seed_count: 2 },
    { slug: 'cpa-wf-invoice-followup', title: 'Invoice follow-up', description: 'Draft AR follow-ups for three clients with invoices 30+ days past due.', owner_persona: 'cpa-client-intake', tool_hint: 'resend', skill_hint: 'ar-followup', approval_policy: 'medium', proof_expectation: 'follow-up drafts + Resend message_ids', success_criteria: 'Past-due invoices addressed; payment plans where needed.', priority: 'low' },
    { slug: 'cpa-wf-yearend-planning', title: 'Year-end planning checklist', description: 'Run the year-end planning checklist for a small-business client before December 31.', owner_persona: 'cpa-advisory-prep', tool_hint: 'bookkeeping-cli', skill_hint: 'planning-prep', approval_policy: 'high', proof_expectation: 'year-end checklist + recommended actions', success_criteria: 'Client has a prioritized year-end action list with deadlines.', priority: 'medium' },
  ],
  tools: [
    ...CORE_TOOLS,
    { cli_tool_id: 'tax-cli', label: 'Tax software connector', description: 'UltraTax / Lacerte / Drake (needs your access).', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'bookkeeping-cli', label: 'Bookkeeping connector', description: 'QuickBooks / Xero ledger access.', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'client-portal-cli', label: 'Secure client portal', description: 'Document intake with PII handling.', state: 'needs_connect', default_risk: 'high' },
  ],
  approval_summary: {
    auto: ['Checklist generation, deadline tracking, internal status updates'],
    medium: ['Document follow-ups, bookkeeping QA, invoice follow-ups'],
    high: ['Tax advice responses, advisory/planning reports, year-end recommendations — all need CPA sign-off'],
    blocked: ['Giving tax/legal advice without CPA review, exposing client PII, filing without authorization'],
  },
}

// ───────────────────────────────────────────────────────────────────
// Law Firms
// ───────────────────────────────────────────────────────────────────
const LAW_FIRM: WorkforceTemplate = {
  slug: 'law-firm',
  vertical: 'Law Firms',
  headline: 'A legal-ops team that guards every deadline and keeps matters moving.',
  tagline: 'Matter intake, conflict checks, discovery tracking, docket watch, and client updates — supervised.',
  install_seconds: 60,
  status: 'ready',
  personas: [
    { slug: 'law-client-intake', name: 'Renee Park', role: 'Client Intake Assistant', description: 'Captures new matter intake, screens fit, and preps the conflict check.', capabilities: ['matter-intake', 'intake-screening', 'conflict-prep'] },
    { slug: 'law-case-coord', name: 'Darnell Hughes', role: 'Case File Coordinator', description: 'Organizes case files, indexes documents, and tracks matter status.', capabilities: ['file-organization', 'doc-index', 'status-track'] },
    { slug: 'law-docket-monitor', name: 'Ingrid Olsen', role: 'Deadline / Docket Monitor', description: 'Watches court deadlines and docket entries; nothing slips.', capabilities: ['docket-watch', 'deadline-calc', 'court-rules'] },
    { slug: 'law-drafting', name: 'Caleb Moss', role: 'Document Drafting Assistant', description: 'Drafts engagement letters and routine documents for attorney review.', capabilities: ['doc-drafting', 'engagement-letter', 'template-fill'] },
    { slug: 'law-discovery', name: 'Tara Nguyen', role: 'Discovery Tracker', description: 'Tracks discovery requests, responses, and production deadlines.', capabilities: ['discovery-track', 'production-log', 'request-followup'] },
    { slug: 'law-client-followup', name: 'Brad Whitaker', role: 'Client Follow-Up Specialist', description: 'Drafts client status updates and keeps communication current.', capabilities: ['status-drafts', 'client-comms', 'update-cadence'] },
  ],
  workflows: [
    { slug: 'law-wf-new-matter', title: 'New matter intake', description: 'A prospective client wants representation in a contract dispute. Capture matter intake and screen fit.', owner_persona: 'law-client-intake', tool_hint: 'case-cli', skill_hint: 'matter-intake', approval_policy: 'low', proof_expectation: 'matter intake record + screening notes', success_criteria: 'Matter intake captured and routed for conflict check.', priority: 'high', demo_seed_count: 2 },
    { slug: 'law-wf-conflict-check', title: 'Conflict check prep', description: 'Prepare the conflict-check search for new parties on an incoming matter.', owner_persona: 'law-client-intake', tool_hint: 'case-cli', skill_hint: 'conflict-prep', approval_policy: 'high', proof_expectation: 'conflict search results for attorney review', success_criteria: 'Conflict check completed before engagement.', priority: 'high' },
    { slug: 'law-wf-engagement-letter', title: 'Engagement letter draft', description: 'Draft an engagement letter for a cleared new matter using the firm template.', owner_persona: 'law-drafting', tool_hint: 'docusign-cli', skill_hint: 'engagement-letter', approval_policy: 'high', proof_expectation: 'engagement letter draft for attorney sign-off', success_criteria: 'Accurate engagement letter ready to send after review.', priority: 'medium' },
    { slug: 'law-wf-doc-request', title: 'Document request follow-up', description: 'Chase outstanding client documents needed for an active matter.', owner_persona: 'law-case-coord', tool_hint: 'resend', skill_hint: 'doc-chase', approval_policy: 'medium', proof_expectation: 'follow-up draft + Resend message_id', success_criteria: 'Requested documents received or escalated.', priority: 'medium' },
    { slug: 'law-wf-discovery-tracker', title: 'Discovery tracker', description: 'Track discovery requests and responses on a litigation matter; flag the production due in 7 days.', owner_persona: 'law-discovery', tool_hint: 'case-cli', skill_hint: 'discovery-track', approval_policy: 'high', proof_expectation: 'discovery log with status + due dates', success_criteria: 'No discovery deadline missed; production prepared on time.', priority: 'high', demo_seed_count: 2 },
    { slug: 'law-wf-court-deadline', title: 'Court / deadline reminder', description: 'Calculate and calendar deadlines from a new scheduling order, with attorney verification flags.', owner_persona: 'law-docket-monitor', tool_hint: 'calendar', skill_hint: 'deadline-calc', approval_policy: 'high', proof_expectation: 'calendared deadlines + rule citations', success_criteria: 'All deadlines calendared and verified by an attorney.', priority: 'critical' },
    { slug: 'law-wf-client-status', title: 'Client status update draft', description: 'Draft a status update for a client on a matter that just cleared a key milestone.', owner_persona: 'law-client-followup', tool_hint: 'resend', skill_hint: 'status-drafts', approval_policy: 'medium', proof_expectation: 'status update draft for attorney review', success_criteria: 'Client kept informed with attorney-approved update.', priority: 'medium' },
    { slug: 'law-wf-case-summary', title: 'Case summary prep', description: 'Prepare a current case summary and chronology for an upcoming attorney strategy session.', owner_persona: 'law-case-coord', tool_hint: 'case-cli', skill_hint: 'case-summary', approval_policy: 'medium', proof_expectation: 'case summary + chronology document', success_criteria: 'Attorney has an accurate, current case summary.', priority: 'medium' },
    { slug: 'law-wf-billing-followup', title: 'Billing follow-up', description: 'Draft follow-ups for outstanding legal invoices on two matters.', owner_persona: 'law-client-followup', tool_hint: 'resend', skill_hint: 'ar-followup', approval_policy: 'medium', proof_expectation: 'billing follow-up drafts + message_ids', success_criteria: 'Outstanding balances addressed appropriately.', priority: 'low' },
    { slug: 'law-wf-closing-file', title: 'Closing file checklist', description: 'Run the matter-closing checklist: final docs, retention, client letter, file archive.', owner_persona: 'law-case-coord', tool_hint: 'case-cli', skill_hint: 'file-closeout', approval_policy: 'medium', proof_expectation: 'completed closing checklist + archive confirmation', success_criteria: 'Matter closed and archived per retention policy.', priority: 'low' },
  ],
  tools: [
    ...CORE_TOOLS,
    { cli_tool_id: 'case-cli', label: 'Case management connector', description: 'Clio / MyCase / Filevine (needs your access).', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'docusign-cli', label: 'DocuSign CLI', description: 'Engagement letters + signatures.', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'court-cli', label: 'Court / docket connector', description: 'PACER / state e-filing docket monitoring.', state: 'needs_connect', default_risk: 'high' },
  ],
  approval_summary: {
    auto: ['Internal file organization, case-summary prep, status drafts (pre-review)'],
    medium: ['Document-request follow-ups, billing follow-ups, closing checklists'],
    high: ['Conflict checks, engagement letters, discovery deadlines, court deadlines, any client-facing send'],
    blocked: ['Giving legal advice without attorney review, missing/altering a court deadline, exposing privileged material'],
  },
}

// ───────────────────────────────────────────────────────────────────
// General Contractors
// ───────────────────────────────────────────────────────────────────
const GENERAL_CONTRACTOR: WorkforceTemplate = {
  slug: 'general-contractor',
  vertical: 'General Contractors',
  headline: 'A construction-ops team from bid to closeout — estimates, subs, schedule, change orders.',
  tagline: 'Bid intake, estimating support, sub coordination, scheduling, and change-order tracking — supervised.',
  install_seconds: 60,
  status: 'ready',
  personas: [
    { slug: 'gc-bid-intake', name: 'Hector Ramos', role: 'Bid Intake Coordinator', description: 'Logs new bid opportunities, captures scope, and routes for estimating.', capabilities: ['bid-intake', 'scope-capture', 'opportunity-log'] },
    { slug: 'gc-estimating', name: 'Lana Pierce', role: 'Estimating Assistant', description: 'Assembles estimate checklists and chases material/labor quotes.', capabilities: ['estimate-checklist', 'quote-chase', 'takeoff-support'] },
    { slug: 'gc-sub-coord', name: 'Desmond Clark', role: 'Subcontractor Coordinator', description: 'Sends sub bid requests, tracks responses, and verifies COIs.', capabilities: ['sub-bid-request', 'coi-verify', 'sub-followup'] },
    { slug: 'gc-schedule', name: 'Bianca Lowe', role: 'Project Schedule Manager', description: 'Builds and maintains project schedules and milestone sequencing.', capabilities: ['schedule-setup', 'milestone-sequence', 'lookahead'] },
    { slug: 'gc-change-order', name: 'Roy Bennett', role: 'Change Order Tracker', description: 'Drafts and tracks change orders and their cost/schedule impact.', capabilities: ['change-order-draft', 'impact-track', 'approval-log'] },
    { slug: 'gc-client-update', name: 'Mara Iverson', role: 'Client Update Specialist', description: 'Drafts client progress updates and daily field-report summaries.', capabilities: ['progress-update', 'field-report', 'client-comms'] },
  ],
  workflows: [
    { slug: 'gc-wf-new-bid', title: 'New bid intake', description: 'A GC bid invite came in for a 4,000 sq ft tenant improvement. Log scope and route to estimating.', owner_persona: 'gc-bid-intake', tool_hint: 'pm-cli', skill_hint: 'bid-intake', approval_policy: 'low', proof_expectation: 'bid opportunity record + scope summary', success_criteria: 'Bid logged with scope and due date; estimating notified.', priority: 'high', demo_seed_count: 2 },
    { slug: 'gc-wf-scope-clarification', title: 'Scope clarification request', description: 'Draft RFI-style scope clarification questions for an ambiguous bid set.', owner_persona: 'gc-bid-intake', tool_hint: 'resend', skill_hint: 'rfi-draft', approval_policy: 'medium', proof_expectation: 'clarification request + recipient', success_criteria: 'Scope ambiguities resolved before pricing.', priority: 'medium' },
    { slug: 'gc-wf-estimate-checklist', title: 'Estimate checklist', description: 'Run the estimate checklist for the TI bid: divisions, allowances, exclusions, contingencies.', owner_persona: 'gc-estimating', tool_hint: 'estimating-cli', skill_hint: 'estimate-checklist', approval_policy: 'medium', proof_expectation: 'estimate checklist with coverage per division', success_criteria: 'Estimate complete with no missing scope divisions.', priority: 'high' },
    { slug: 'gc-wf-sub-bid-request', title: 'Subcontractor bid request', description: 'Send bid requests to three electrical subs and track responses for the TI project.', owner_persona: 'gc-sub-coord', tool_hint: 'resend', skill_hint: 'sub-bid-request', approval_policy: 'medium', proof_expectation: 'bid requests sent + response tracker', success_criteria: 'At least 2 competitive sub bids received by due date.', priority: 'medium', demo_seed_count: 2 },
    { slug: 'gc-wf-material-quotes', title: 'Material quote tracker', description: 'Chase and compare material quotes for long-lead items (HVAC units, switchgear).', owner_persona: 'gc-estimating', tool_hint: 'estimating-cli', skill_hint: 'quote-chase', approval_policy: 'medium', proof_expectation: 'quote comparison sheet + lead times', success_criteria: 'Best-value quotes secured with lead times noted.', priority: 'medium' },
    { slug: 'gc-wf-schedule-setup', title: 'Project schedule setup', description: 'Build the baseline schedule for an awarded project with milestone sequencing.', owner_persona: 'gc-schedule', tool_hint: 'pm-cli', skill_hint: 'schedule-setup', approval_policy: 'medium', proof_expectation: 'baseline schedule with milestones', success_criteria: 'Schedule built; critical path identified.', priority: 'high' },
    { slug: 'gc-wf-change-order', title: 'Change order draft', description: 'Draft a change order for an owner-requested scope addition with cost and schedule impact.', owner_persona: 'gc-change-order', tool_hint: 'docusign-cli', skill_hint: 'change-order-draft', approval_policy: 'high', proof_expectation: 'change order draft + impact analysis', success_criteria: 'Accurate change order ready for owner sign-off.', priority: 'high' },
    { slug: 'gc-wf-daily-field-report', title: 'Daily field report', description: 'Summarize today\'s field report into a clean log: crews, progress, delays, safety notes.', owner_persona: 'gc-client-update', tool_hint: 'pm-cli', skill_hint: 'field-report', approval_policy: 'low', proof_expectation: 'daily report log entry', success_criteria: 'Daily report captured and filed.', priority: 'medium', demo_seed_count: 2 },
    { slug: 'gc-wf-client-progress', title: 'Client progress update', description: 'Draft a weekly client progress update with photos, milestones hit, and upcoming work.', owner_persona: 'gc-client-update', tool_hint: 'resend', skill_hint: 'progress-update', approval_policy: 'medium', proof_expectation: 'progress update draft + Resend message_id', success_criteria: 'Client receives an accurate, on-time update.', priority: 'medium' },
    { slug: 'gc-wf-closeout-punchlist', title: 'Closeout punch list', description: 'Compile the punch list and closeout checklist for a project nearing substantial completion.', owner_persona: 'gc-change-order', tool_hint: 'pm-cli', skill_hint: 'punch-list', approval_policy: 'medium', proof_expectation: 'punch list + closeout checklist', success_criteria: 'All punch items tracked to completion; closeout docs ready.', priority: 'medium' },
  ],
  tools: [
    ...CORE_TOOLS,
    { cli_tool_id: 'pm-cli', label: 'Construction PM connector', description: 'Procore / Buildertrend (needs your access).', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'estimating-cli', label: 'Estimating connector', description: 'Takeoff + estimating data.', state: 'needs_connect', default_risk: 'medium' },
    { cli_tool_id: 'docusign-cli', label: 'DocuSign CLI', description: 'Change orders + contracts.', state: 'needs_connect', default_risk: 'high' },
  ],
  approval_summary: {
    auto: ['Bid logging, field-report capture, internal schedule updates'],
    medium: ['Scope clarifications, sub bid requests, material-quote comparisons, progress updates'],
    high: ['Change orders, contract/owner-facing financial commitments'],
    blocked: ['Committing to pricing/contracts without owner sign-off, working subs with expired COIs, deleting project records'],
  },
}

// ───────────────────────────────────────────────────────────────────
// Home Services
// ───────────────────────────────────────────────────────────────────
const HOME_SERVICES: WorkforceTemplate = {
  slug: 'home-services',
  vertical: 'Home Services',
  headline: 'A dispatch + customer team that books, routes, and retains — supervised.',
  tagline: 'Service intake, technician scheduling, estimate follow-up, reviews, and warranty callbacks.',
  install_seconds: 60,
  status: 'ready',
  personas: [
    { slug: 'hs-intake-dispatch', name: 'Gabe Foster', role: 'Service Intake Dispatcher', description: 'Captures service requests, triages urgency, and routes to scheduling.', capabilities: ['service-intake', 'urgency-triage', 'dispatch-routing'] },
    { slug: 'hs-tech-scheduler', name: 'Lucia Romano', role: 'Technician Scheduler', description: 'Books and routes technicians efficiently across the day.', capabilities: ['tech-scheduling', 'route-optimize', 'reschedule'] },
    { slug: 'hs-estimate-followup', name: 'Trent Boyd', role: 'Estimate Follow-Up Assistant', description: 'Follows up on open estimates to win the job.', capabilities: ['estimate-followup', 'quote-nurture', 'objection-handling'] },
    { slug: 'hs-review-coord', name: 'Asha Patel', role: 'Customer Review Coordinator', description: 'Requests reviews after completed jobs and routes feedback.', capabilities: ['review-request', 'feedback-routing', 'reputation'] },
    { slug: 'hs-parts-tracker', name: 'Carl Jensen', role: 'Parts / Inventory Tracker', description: 'Tracks parts orders and flags items needed for upcoming jobs.', capabilities: ['parts-order', 'inventory-track', 'backorder-flag'] },
    { slug: 'hs-warranty-followup', name: 'Nora Quinn', role: 'Warranty Follow-Up Specialist', description: 'Handles warranty callbacks and reactivates repeat customers.', capabilities: ['warranty-callback', 'reactivation', 'maintenance-reminder'] },
  ],
  workflows: [
    { slug: 'hs-wf-new-request', title: 'New service request', description: 'A homeowner requested an AC tune-up. Capture details, triage urgency, and route to scheduling.', owner_persona: 'hs-intake-dispatch', tool_hint: 'fsm-cli', skill_hint: 'service-intake', approval_policy: 'low', proof_expectation: 'service request id + triage notes', success_criteria: 'Request captured and queued for scheduling within minutes.', priority: 'high', demo_seed_count: 3 },
    { slug: 'hs-wf-emergency-triage', title: 'Emergency triage', description: 'An after-hours call reports no heat with an infant in the home. Triage as emergency and dispatch on-call.', owner_persona: 'hs-intake-dispatch', tool_hint: 'fsm-cli', skill_hint: 'emergency-dispatch', approval_policy: 'high', proof_expectation: 'on-call dispatch confirmation timestamp', success_criteria: 'Emergency dispatched within 15 minutes.', priority: 'critical' },
    { slug: 'hs-wf-tech-dispatch', title: 'Technician dispatch', description: 'Assign and route three morning jobs to the two available techs with minimal drive time.', owner_persona: 'hs-tech-scheduler', tool_hint: 'fsm-cli', skill_hint: 'route-optimize', approval_policy: 'low', proof_expectation: 'dispatch board with assignments + ETAs', success_criteria: 'All jobs assigned with efficient routing.', priority: 'high' },
    { slug: 'hs-wf-estimate-followup', title: 'Estimate follow-up', description: 'Follow up on a $4,200 furnace-replacement estimate sent three days ago.', owner_persona: 'hs-estimate-followup', tool_hint: 'resend', skill_hint: 'estimate-followup', approval_policy: 'medium', proof_expectation: 'follow-up draft + Resend message_id', success_criteria: 'Estimate decision obtained or next touch scheduled.', priority: 'medium', demo_seed_count: 2 },
    { slug: 'hs-wf-appointment-reminder', title: 'Appointment reminder', description: 'Send day-before reminders for tomorrow\'s booked appointments to cut no-shows.', owner_persona: 'hs-tech-scheduler', tool_hint: 'resend', skill_hint: 'reminder-cadence', approval_policy: 'low', proof_expectation: 'reminder send log', success_criteria: 'All next-day customers reminded and confirmed.', priority: 'medium' },
    { slug: 'hs-wf-parts-order', title: 'Parts order tracker', description: 'Track the compressor part needed for Thursday\'s job; flag if it will not arrive in time.', owner_persona: 'hs-parts-tracker', tool_hint: 'fsm-cli', skill_hint: 'parts-order', approval_policy: 'medium', proof_expectation: 'parts order status + ETA', success_criteria: 'Part confirmed in time or job rescheduled proactively.', priority: 'medium' },
    { slug: 'hs-wf-warranty-callback', title: 'Warranty callback', description: 'A customer reports the same issue two weeks after service. Schedule a warranty callback at no charge.', owner_persona: 'hs-warranty-followup', tool_hint: 'fsm-cli', skill_hint: 'warranty-callback', approval_policy: 'medium', proof_expectation: 'warranty work order + scheduling confirmation', success_criteria: 'Callback scheduled promptly under warranty terms.', priority: 'high' },
    { slug: 'hs-wf-review-request', title: 'Review request', description: 'Request a review from a customer whose job was completed and paid today.', owner_persona: 'hs-review-coord', tool_hint: 'resend', skill_hint: 'review-request', approval_policy: 'low', proof_expectation: 'review request send log', success_criteria: 'Review requested; negative feedback routed privately.', priority: 'low', demo_seed_count: 2 },
    { slug: 'hs-wf-missed-call', title: 'Missed call follow-up', description: 'Follow up on three missed calls from this morning before the leads go elsewhere.', owner_persona: 'hs-intake-dispatch', tool_hint: 'resend', skill_hint: 'missed-call-recovery', approval_policy: 'medium', proof_expectation: 'callback/text log per missed call', success_criteria: 'Every missed call followed up within the hour.', priority: 'high' },
    { slug: 'hs-wf-reactivation', title: 'Repeat customer reactivation', description: 'Reactivate customers due for annual maintenance who haven\'t booked in 12+ months.', owner_persona: 'hs-warranty-followup', tool_hint: 'resend', skill_hint: 'reactivation', approval_policy: 'medium', proof_expectation: 'reactivation campaign list + sends', success_criteria: 'Lapsed customers re-engaged; bookings created.', priority: 'low' },
  ],
  tools: [
    ...CORE_TOOLS,
    { cli_tool_id: 'fsm-cli', label: 'Field service connector', description: 'ServiceTitan / Housecall Pro / Jobber (needs your access).', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'reviews-cli', label: 'Reviews connector', description: 'Google / Yelp review requests.', state: 'needs_connect', default_risk: 'medium' },
  ],
  approval_summary: {
    auto: ['Service intake, dispatch routing, appointment reminders, review requests'],
    medium: ['Estimate follow-ups, parts tracking, warranty callbacks, reactivation, missed-call recovery'],
    high: ['Emergency dispatch, anything authorizing paid work or warranty terms'],
    blocked: ['Booking unlicensed work, exposing customer data, charging without authorization'],
  },
}

// ───────────────────────────────────────────────────────────────────
// Marketing Agencies
// ───────────────────────────────────────────────────────────────────
const MARKETING_AGENCY: WorkforceTemplate = {
  slug: 'marketing-agency',
  vertical: 'Marketing Agencies',
  headline: 'A campaign-to-reporting agency team that ships content and proves ROI.',
  tagline: 'Client onboarding, campaign briefs, content calendars, SEO, and performance reporting — supervised.',
  install_seconds: 60,
  status: 'ready',
  personas: [
    { slug: 'mktg-intake-strategist', name: 'Elena Voss', role: 'Client Intake Strategist', description: 'Onboards clients, captures goals, audience, and brand voice.', capabilities: ['client-onboarding', 'brand-discovery', 'goal-capture'] },
    { slug: 'mktg-campaign-planner', name: 'Jordan Webb', role: 'Campaign Planner', description: 'Turns goals into campaign briefs with channels, budget, and KPIs.', capabilities: ['campaign-brief', 'channel-plan', 'kpi-define'] },
    { slug: 'mktg-content-calendar', name: 'Priscilla Ngata', role: 'Content Calendar Manager', description: 'Builds and maintains the content calendar across channels.', capabilities: ['content-calendar', 'editorial-plan', 'scheduling'] },
    { slug: 'mktg-copywriter', name: 'Sean Daly', role: 'Copywriter Assistant', description: 'Drafts ad copy, landing pages, and social posts for review.', capabilities: ['ad-copy', 'landing-copy', 'social-copy'] },
    { slug: 'mktg-seo-analyst', name: 'Aïsha Bello', role: 'SEO Analyst', description: 'Runs keyword research and on-page recommendations.', capabilities: ['keyword-research', 'onpage-audit', 'serp-analysis'] },
    { slug: 'mktg-reporting', name: 'Cole Harper', role: 'Reporting Coordinator', description: 'Assembles weekly performance reports and renewal/upsell prep.', capabilities: ['performance-report', 'roi-rollup', 'renewal-prep'] },
  ],
  workflows: [
    { slug: 'mktg-wf-client-onboarding', title: 'New client onboarding', description: 'A new SaaS client signed. Capture goals, audience, brand voice, and access checklist.', owner_persona: 'mktg-intake-strategist', tool_hint: 'pm-cli', skill_hint: 'client-onboarding', approval_policy: 'low', proof_expectation: 'onboarding brief + access checklist', success_criteria: 'Client brief complete; kickoff scheduled.', priority: 'high', demo_seed_count: 2 },
    { slug: 'mktg-wf-campaign-brief', title: 'Campaign brief', description: 'Draft a Q3 demand-gen campaign brief: objective, channels, budget split, and KPIs.', owner_persona: 'mktg-campaign-planner', tool_hint: 'notion-q', skill_hint: 'campaign-brief', approval_policy: 'medium', proof_expectation: 'campaign brief document', success_criteria: 'Brief approved with clear KPIs and budget.', priority: 'high' },
    { slug: 'mktg-wf-content-calendar', title: 'Content calendar build', description: 'Build next month\'s content calendar across blog, email, and social for the SaaS client.', owner_persona: 'mktg-content-calendar', tool_hint: 'notion-q', skill_hint: 'content-calendar', approval_policy: 'medium', proof_expectation: 'content calendar with dates + owners', success_criteria: 'Calendar populated and approved for the month.', priority: 'medium' },
    { slug: 'mktg-wf-seo-research', title: 'SEO keyword research', description: 'Run keyword research for a new product page; deliver target terms and on-page recs.', owner_persona: 'mktg-seo-analyst', tool_hint: 'seo-cli', skill_hint: 'keyword-research', approval_policy: 'low', proof_expectation: 'keyword set + on-page recommendations', success_criteria: 'Prioritized keyword targets with difficulty/volume.', priority: 'medium' },
    { slug: 'mktg-wf-landing-page', title: 'Landing page draft', description: 'Draft landing-page copy for a webinar campaign aligned to the brief.', owner_persona: 'mktg-copywriter', tool_hint: 'notion-q', skill_hint: 'landing-copy', approval_policy: 'medium', proof_expectation: 'landing page copy draft', success_criteria: 'On-brand landing copy ready for design + review.', priority: 'medium' },
    { slug: 'mktg-wf-ad-creative', title: 'Ad creative request', description: 'Draft ad copy variants and a creative brief for a paid social test.', owner_persona: 'mktg-copywriter', tool_hint: 'ads-cli', skill_hint: 'ad-copy', approval_policy: 'medium', proof_expectation: 'ad copy variants + creative brief', success_criteria: 'Variants ready for design and trafficking.', priority: 'medium', demo_seed_count: 2 },
    { slug: 'mktg-wf-social-batch', title: 'Social post batch', description: 'Draft a two-week batch of social posts across LinkedIn and X for the client.', owner_persona: 'mktg-content-calendar', tool_hint: 'social-cli', skill_hint: 'social-copy', approval_policy: 'medium', proof_expectation: 'social post batch draft', success_criteria: 'Batch drafted and scheduled after approval.', priority: 'low' },
    { slug: 'mktg-wf-weekly-report', title: 'Weekly performance report', description: 'Assemble the weekly performance report: traffic, leads, spend, CPL, and notable wins.', owner_persona: 'mktg-reporting', tool_hint: 'analytics-cli', skill_hint: 'performance-report', approval_policy: 'medium', proof_expectation: 'weekly report with KPIs vs targets', success_criteria: 'Report delivered with insights, not just numbers.', priority: 'high', demo_seed_count: 2 },
    { slug: 'mktg-wf-approval-queue', title: 'Client approval queue', description: 'Route this week\'s deliverables through the client approval queue and chase sign-offs.', owner_persona: 'mktg-reporting', tool_hint: 'resend', skill_hint: 'approval-routing', approval_policy: 'medium', proof_expectation: 'approval status per deliverable', success_criteria: 'All deliverables approved or revised before publish.', priority: 'medium' },
    { slug: 'mktg-wf-renewal-prep', title: 'Renewal / upsell prep', description: 'Prep the renewal case for a client at month 11: results vs goals and an upsell proposal.', owner_persona: 'mktg-reporting', tool_hint: 'notion-q', skill_hint: 'renewal-prep', approval_policy: 'high', proof_expectation: 'renewal deck + upsell proposal draft', success_criteria: 'Renewal case ready with ROI proof and upsell path.', priority: 'medium' },
  ],
  tools: [
    ...CORE_TOOLS,
    { cli_tool_id: 'pm-cli', label: 'Agency PM connector', description: 'Asana / ClickUp / Monday.', state: 'needs_connect', default_risk: 'medium' },
    { cli_tool_id: 'analytics-cli', label: 'Analytics connector', description: 'GA4 / Search Console (needs your access).', state: 'needs_connect', default_risk: 'medium' },
    { cli_tool_id: 'ads-cli', label: 'Ads connector', description: 'Google / Meta Ads (read for reporting).', state: 'needs_connect', default_risk: 'high' },
    { cli_tool_id: 'seo-cli', label: 'SEO connector', description: 'Keyword + rank data.', state: 'needs_connect', default_risk: 'low' },
    { cli_tool_id: 'social-cli', label: 'Social scheduler', description: 'Buffer / Hootsuite scheduling.', state: 'needs_connect', default_risk: 'medium' },
  ],
  approval_summary: {
    auto: ['Keyword research, internal briefs, calendar drafts'],
    medium: ['Copy drafts, ad creative, social batches, reports, approval routing'],
    high: ['Renewal/upsell proposals, paid-spend changes, anything published or sent to the client'],
    blocked: ['Publishing without client approval, changing ad spend over budget, exposing client account credentials'],
  },
}

// ───────────────────────────────────────────────────────────────────
// AI Agencies
// ───────────────────────────────────────────────────────────────────
const AI_AGENCY: WorkforceTemplate = {
  slug: 'ai-agency',
  vertical: 'AI Agencies',
  headline: 'An AI-transformation delivery team: discovery, blueprint, build, and ROI.',
  tagline: 'Opportunity audits, automation blueprints, agent design, build requests, and implementation QA — supervised.',
  install_seconds: 60,
  status: 'ready',
  personas: [
    { slug: 'ai-solutions-consultant', name: 'Dr. Maya Iyer', role: 'AI Solutions Consultant', description: 'Runs client AI opportunity audits and frames the transformation roadmap.', capabilities: ['opportunity-audit', 'roadmap-framing', 'value-mapping'] },
    { slug: 'ai-discovery-analyst', name: 'Felix Norton', role: 'Workflow Discovery Analyst', description: 'Documents current-state workflows and identifies automation candidates.', capabilities: ['workflow-discovery', 'process-mapping', 'automation-scoring'] },
    { slug: 'ai-automation-architect', name: 'Hana Sato', role: 'Automation Architect', description: 'Designs automation blueprints and integration architectures.', capabilities: ['automation-blueprint', 'integration-design', 'data-flow'] },
    { slug: 'ai-prompt-builder', name: 'Omar Haddad', role: 'Prompt / Skill Builder', description: 'Designs agent personas, prompts, and reusable skills/workflows.', capabilities: ['persona-design', 'prompt-engineering', 'skill-build'] },
    { slug: 'ai-client-success', name: 'Tess Calloway', role: 'Client Success Operator', description: 'Manages rollout, adoption, and client communication.', capabilities: ['rollout-mgmt', 'adoption-track', 'client-comms'] },
    { slug: 'ai-impl-qa', name: 'Raj Kapoor', role: 'Implementation QA Specialist', description: 'Validates automations against acceptance criteria before go-live.', capabilities: ['impl-qa', 'acceptance-testing', 'regression-check'] },
  ],
  workflows: [
    { slug: 'ai-wf-opportunity-audit', title: 'Client AI opportunity audit', description: 'A mid-size logistics client wants AI. Audit their workflows and rank top automation opportunities by ROI.', owner_persona: 'ai-solutions-consultant', tool_hint: 'notion-q', skill_hint: 'opportunity-audit', approval_policy: 'medium', proof_expectation: 'opportunity audit doc with ranked ROI', success_criteria: 'Top 5 opportunities identified with effort/ROI estimates.', priority: 'high', demo_seed_count: 2 },
    { slug: 'ai-wf-discovery-notes', title: 'Workflow discovery call notes', description: 'Turn a discovery-call transcript into structured current-state workflow notes and automation candidates.', owner_persona: 'ai-discovery-analyst', tool_hint: 'notion-q', skill_hint: 'workflow-discovery', approval_policy: 'low', proof_expectation: 'structured discovery notes + candidate list', success_criteria: 'Discovery captured with clear automation candidates.', priority: 'medium' },
    { slug: 'ai-wf-automation-blueprint', title: 'Automation blueprint', description: 'Design the blueprint for automating the client\'s invoice-processing workflow end to end.', owner_persona: 'ai-automation-architect', tool_hint: 'gh', skill_hint: 'automation-blueprint', approval_policy: 'medium', proof_expectation: 'blueprint diagram + integration list', success_criteria: 'Blueprint covers triggers, steps, integrations, and guardrails.', priority: 'high' },
    { slug: 'ai-wf-agent-design', title: 'Agent persona design', description: 'Design the agent personas and responsibilities for the invoice automation.', owner_persona: 'ai-prompt-builder', tool_hint: 'mc', skill_hint: 'persona-design', approval_policy: 'medium', proof_expectation: 'persona spec + responsibility matrix', success_criteria: 'Personas defined with clear scope and approval gates.', priority: 'medium' },
    { slug: 'ai-wf-skill-build-request', title: 'Skill/workflow build request', description: 'Draft a build request for the prompts/skills needed for the invoice agents.', owner_persona: 'ai-prompt-builder', tool_hint: 'gh', skill_hint: 'skill-build', approval_policy: 'medium', proof_expectation: 'build request with acceptance criteria', success_criteria: 'Build request actionable with testable acceptance criteria.', priority: 'medium', demo_seed_count: 2 },
    { slug: 'ai-wf-integration-checklist', title: 'Integration checklist', description: 'Run the integration checklist for connecting the client\'s ERP and email to the automation.', owner_persona: 'ai-automation-architect', tool_hint: 'gh', skill_hint: 'integration-checklist', approval_policy: 'high', proof_expectation: 'integration checklist with auth/security items', success_criteria: 'Integrations validated with security review complete.', priority: 'high' },
    { slug: 'ai-wf-demo-prep', title: 'Demo prep', description: 'Prepare the client demo: script, sample data, and a walkthrough of the automation.', owner_persona: 'ai-client-success', tool_hint: 'notion-q', skill_hint: 'demo-prep', approval_policy: 'medium', proof_expectation: 'demo script + sample dataset', success_criteria: 'Demo rehearsed and ready with realistic data.', priority: 'medium' },
    { slug: 'ai-wf-client-approval', title: 'Client approval workflow', description: 'Route the blueprint and build plan through client approval before implementation.', owner_persona: 'ai-client-success', tool_hint: 'resend', skill_hint: 'approval-routing', approval_policy: 'high', proof_expectation: 'signed approval / written go-ahead', success_criteria: 'Client approves scope and plan in writing before build.', priority: 'high' },
    { slug: 'ai-wf-impl-qa', title: 'Implementation QA', description: 'QA the deployed invoice automation against acceptance criteria before go-live.', owner_persona: 'ai-impl-qa', tool_hint: 'gh', skill_hint: 'impl-qa', approval_policy: 'high', proof_expectation: 'QA report with pass/fail per criterion', success_criteria: 'All acceptance criteria pass; no critical defects open.', priority: 'high', demo_seed_count: 2 },
    { slug: 'ai-wf-roi-report', title: 'ROI report', description: 'Build the 30-day ROI report for the live automation: time saved, error reduction, cost.', owner_persona: 'ai-solutions-consultant', tool_hint: 'notion-q', skill_hint: 'roi-report', approval_policy: 'medium', proof_expectation: 'ROI report with before/after metrics', success_criteria: 'Client sees measurable ROI with clear methodology.', priority: 'medium' },
  ],
  tools: [
    ...CORE_TOOLS,
    { cli_tool_id: 'gh', label: 'GitHub CLI', description: 'Build requests, integration code, QA.', state: 'installed', default_risk: 'medium' },
    { cli_tool_id: 'integration-cli', label: 'Integration connector', description: 'Client ERP/CRM/email integration (needs client access).', state: 'needs_connect', default_risk: 'high' },
  ],
  approval_summary: {
    auto: ['Discovery notes, internal blueprints, opportunity scoring'],
    medium: ['Opportunity audits, agent design, build requests, demo prep, ROI reports'],
    high: ['Integration checklists/security, client approvals, implementation QA, go-live'],
    blocked: ['Connecting client systems without authorization, going live without client sign-off, exposing client data/secrets'],
  },
}

/** All eight Phase-3 verticals, keyed by slug. */
export const EXTENDED_VERTICALS: Record<string, WorkforceTemplate> = {
  'real-estate': REAL_ESTATE,
  mortgage: MORTGAGE,
  cpa: CPA,
  'law-firm': LAW_FIRM,
  'general-contractor': GENERAL_CONTRACTOR,
  'home-services': HOME_SERVICES,
  'marketing-agency': MARKETING_AGENCY,
  'ai-agency': AI_AGENCY,
}
