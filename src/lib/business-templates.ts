/**
 * Onboarding Business Templates
 *
 * Mission Control v3 is positioned as the operating system for an AI workforce.
 * Each template represents a real business archetype and provisions:
 *   - AI employees (named like real roles, not "agents")
 *   - Skills (concrete capabilities)
 *   - Workflows (named processes)
 *   - A starter task that's actionable in 5 minutes
 *   - An ROI line that the business owner immediately understands
 *
 * Templates are the source of truth for the onboarding wizard and the sample
 * task seeding that follows workspace creation.
 */
export interface BusinessTemplate {
  id: string
  name: string
  icon: string
  /** Short business-owner-facing tagline shown on the picker card. */
  tagline: string
  /** AI employee roles (real job titles, not agent ids). */
  aiEmployees: string[]
  /** Skills installed for this workspace. */
  skills: string[]
  /** Named, repeatable workflows. */
  workflows: string[]
  /** Title of the very first task seeded in the workspace ("first 5-minute task"). */
  starterTaskTitle: string
  /**
   * Optional detailed description for the starter task. Plain language —
   * customer-friendly, no AI jargon, no legal/tax advice claims.
   */
  starterTaskDescription: string
  /** ROI line. Short, customer-friendly, never technical. */
  roiMessage: string
  /**
   * Estimated hours per month freed up. Used for runway / ROI projections.
   * Conservative defaults — business owner will likely beat them.
   */
  estimatedHoursSavedPerMonth: number
  /** Recommended starting credit balance for typical first month of activity. */
  recommendedStarterCredits: number
  /**
   * Optional compliance footer. Critical for regulated industries (legal,
   * tax) where the product must not claim to give advice.
   */
  complianceNote?: string
}

export const BUSINESS_TEMPLATES: BusinessTemplate[] = [
  {
    id: 'pm',
    name: 'Property Manager',
    icon: '🏢',
    tagline: 'AI workforce for residential & commercial property operations',
    aiEmployees: ['AI Maintenance Triage Agent', 'AI Inspection Reporter', 'AI Owner Comms Assistant'],
    skills: ['maintenance-triage', 'visionops-inspection', 'owner-reporting', 'vendor-dispatch'],
    workflows: [
      'Inspection → Scope → Approval',
      'Maintenance Intake Pipeline',
      'Monthly Owner Reporting',
    ],
    starterTaskTitle: 'Draft a monthly owner update for one property',
    starterTaskDescription:
      'Pull recent maintenance activity, occupancy, and outstanding items for one property and assemble a one-page owner update ready for your review.',
    roiMessage:
      'Cut owner-communication and maintenance-coordination admin time so your team can focus on doors, not desks.',
    estimatedHoursSavedPerMonth: 28,
    recommendedStarterCredits: 1000,
  },
  {
    id: 'gc',
    name: 'General Contractor',
    icon: '🔨',
    tagline: 'AI workforce for bids, schedules, and project oversight',
    aiEmployees: ['AI Bid Estimator', 'AI Project Scheduler', 'AI QC Inspector'],
    skills: ['cost-estimation', 'project-scheduling', 'quality-inspection', 'subcontractor-matching'],
    workflows: ['Estimate → Bid → Award', 'Project Progress Tracking', 'Punch List Workflow'],
    starterTaskTitle: 'Generate a punch-list summary for an active project',
    starterTaskDescription:
      'Compile open items, photos, and sub-contractor assignments into a clean punch list ready to share with the client.',
    roiMessage:
      'Spend less time chasing subs and punch lists and more time on jobs that close.',
    estimatedHoursSavedPerMonth: 22,
    recommendedStarterCredits: 1000,
  },
  {
    id: 'home-services',
    name: 'Home Services',
    icon: '🔧',
    tagline: 'AI workforce for HVAC, plumbing, electrical, landscaping ops',
    aiEmployees: ['AI Intake Receptionist', 'AI Quote Assistant', 'AI Dispatcher'],
    skills: ['lead-intake', 'estimation', 'scheduling', 'customer-notifications'],
    workflows: ['Lead → Quote → Book', 'Emergency Dispatch', 'Job Completion Follow-up'],
    starterTaskTitle: 'Send a "thanks for the job" follow-up to a recent customer',
    starterTaskDescription:
      'Draft a friendly post-service follow-up, ask for a review, and offer a maintenance reminder for next quarter.',
    roiMessage:
      'Capture more leads, book more jobs, and stop losing customers between the phone and the dispatch board.',
    estimatedHoursSavedPerMonth: 24,
    recommendedStarterCredits: 1000,
  },
  {
    id: 'ai-agency',
    name: 'AI Agency / Operator',
    icon: '🤖',
    tagline: 'Manage and resell AI workforce across multiple clients',
    aiEmployees: ['AI Workforce Manager', 'AI QA Reviewer', 'AI Cost Tracker'],
    skills: ['agent-orchestration', 'qa-gates', 'cost-tracking', 'security-scan'],
    workflows: [
      'Agent Deployment Pipeline',
      'Quality Assurance Review',
      'Cost Optimization Loop',
    ],
    starterTaskTitle: 'Generate a client-ready ROI summary',
    starterTaskDescription:
      'Pull last week\'s AI workforce activity, time saved, and credits used into a one-page client summary.',
    roiMessage:
      'Run more clients with the same headcount by letting Mission Control track utilization, quality, and cost.',
    estimatedHoursSavedPerMonth: 30,
    recommendedStarterCredits: 2500,
  },
  {
    id: 'real-estate',
    name: 'Real Estate Sales Agent',
    icon: '🏡',
    tagline: 'AI workforce for lead capture, CMA, and transactions',
    aiEmployees: [
      'AI Lead Capture Assistant',
      'AI CMA Analyst',
      'AI Showing Coordinator',
      'AI Transaction Coordinator',
    ],
    skills: [
      'lead-capture',
      'buyer-seller-intake',
      'cma-report-generator',
      'showing-scheduling',
      'offer-follow-up',
      'transaction-coordination',
      'post-close-nurture',
    ],
    workflows: [
      'New Lead → Qualify → Schedule Tour',
      'Listing Prep → CMA → Pricing Strategy',
      'Offer → Negotiation → Acceptance',
      'Under Contract → Transaction Coordinator Handoff',
      'Post-Close 30 / 60 / 90-Day Nurture',
    ],
    starterTaskTitle: 'Build a CMA-ready listing prep brief for a new seller',
    starterTaskDescription:
      'Pull recent comps, draft a pricing recommendation range, and prepare a one-page brief for the listing appointment.',
    roiMessage:
      'Close more deals by spending less time on intake, scheduling, and paperwork.',
    estimatedHoursSavedPerMonth: 26,
    recommendedStarterCredits: 1000,
  },
  {
    id: 'mortgage',
    name: 'Mortgage Broker',
    icon: '💰',
    tagline: 'AI workforce for applications, pre-qual, and underwriting flow',
    aiEmployees: [
      'AI Application Intake Assistant',
      'AI Pre-Qual Scorer',
      'AI Doc Collection Assistant',
      'AI Rate Quote Assistant',
      'AI Loan Officer Assistant',
    ],
    skills: [
      'application-intake',
      'pre-qualification-scoring',
      'document-collection-request',
      'rate-quote-comparison',
      'underwriting-status-tracker',
      'loan-officer-dashboard',
      'closing-checklist',
    ],
    workflows: [
      'Inbound Inquiry → Application Intake',
      'Pre-Qualification Score → Borrower Tier',
      'Document Collection → Verification',
      'Rate Quote Generation & Comparison',
      'Underwriting Status Updates',
      'Closing Checklist & Funding',
    ],
    starterTaskTitle: 'Send a personalized document checklist to a new borrower',
    starterTaskDescription:
      'Based on the loan type, draft a friendly email with the exact documents needed and a clear deadline.',
    roiMessage:
      'Move borrowers from application to closing faster with fewer back-and-forth emails.',
    estimatedHoursSavedPerMonth: 32,
    recommendedStarterCredits: 1000,
    complianceNote:
      'AI assistants handle intake, document collection, scheduling, and follow-up only. They do not provide regulated lending advice.',
  },
  {
    id: 'cpa',
    name: 'CPA / Accounting Firm',
    icon: '📊',
    tagline: 'AI workforce for tax season, bookkeeping, and client follow-up',
    aiEmployees: [
      'AI Client Intake Assistant',
      'AI Tax Document Organizer',
      'AI Bookkeeping Follow-Up Assistant',
      'AI Payroll & Compliance Reminder Assistant',
      'AI Reporting Analyst',
    ],
    skills: [
      'client-intake',
      'document-checklist-generation',
      'tax-season-follow-up',
      'missing-document-reminders',
      'bookkeeping-categorization-support',
      'monthly-report-drafting',
      'appointment-scheduling',
      'client-email-drafting',
      'deadline-reminders',
    ],
    workflows: [
      'New Client Onboarding',
      'Tax Document Collection',
      'Monthly Bookkeeping Follow-Up',
      'Payroll & Compliance Reminders',
      'Client Report Generation',
      'Missing Document Chase-Down',
    ],
    starterTaskTitle: 'Create a missing-document checklist and follow-up email for a tax client',
    starterTaskDescription:
      'Pull the engagement letter, list every document still outstanding, and draft a friendly follow-up email with a clear deadline.',
    roiMessage:
      'Reduce admin follow-up during tax season and free staff from repetitive document chasing.',
    estimatedHoursSavedPerMonth: 40,
    recommendedStarterCredits: 1500,
    complianceNote:
      'AI assistants help with intake, organization, reminders, and drafting. They do not give tax advice or sign returns.',
  },
  {
    id: 'marketing-agency',
    name: 'Marketing Agency',
    icon: '📣',
    tagline: 'AI workforce for content, campaigns, and client reporting',
    aiEmployees: [
      'AI Content Strategist',
      'AI Campaign Assistant',
      'AI Social Media Scheduler',
      'AI Client Reporting Analyst',
      'AI Lead Research Assistant',
    ],
    skills: [
      'content-calendar-creation',
      'campaign-brief-drafting',
      'ad-copy-generation',
      'social-post-repurposing',
      'lead-research',
      'competitor-research',
      'client-report-drafting',
      'performance-summary-writing',
      'email-campaign-drafting',
    ],
    workflows: [
      'New Campaign Launch',
      'Weekly Content Calendar',
      'Client Performance Reporting',
      'Lead List Research',
      'Social Media Repurposing',
      'Ad Creative Ideation',
    ],
    starterTaskTitle: 'Create a 7-day content calendar for a client campaign',
    starterTaskDescription:
      'Pick a client, build a Monday–Sunday content calendar across the channels they use, and include hook + caption ideas for each post.',
    roiMessage:
      'Produce campaign assets and client reports faster without adding more account managers.',
    estimatedHoursSavedPerMonth: 35,
    recommendedStarterCredits: 1500,
  },
  {
    id: 'law-firm',
    name: 'Law Firm',
    icon: '⚖️',
    tagline: 'AI workforce for intake, scheduling, and matter follow-up',
    aiEmployees: [
      'AI Client Intake Assistant',
      'AI Case Summary Assistant',
      'AI Document Review Assistant',
      'AI Follow-Up Coordinator',
      'AI Scheduling Assistant',
    ],
    skills: [
      'client-intake-summary',
      'consultation-prep',
      'case-timeline-drafting',
      'document-checklist-creation',
      'follow-up-email-drafting',
      'appointment-scheduling',
      'call-summary',
      'matter-status-reporting',
      'deadline-reminder-support',
    ],
    workflows: [
      'New Lead Intake',
      'Consultation Scheduling',
      'Case Document Collection',
      'Matter Status Update',
      'Client Follow-Up',
      'Weekly Case Summary',
    ],
    starterTaskTitle: 'Summarize a new client intake and draft a consultation follow-up email',
    starterTaskDescription:
      'Take a recent intake, produce a one-paragraph matter summary, and draft a follow-up email confirming the consultation time.',
    roiMessage:
      'Reduce intake bottlenecks, speed up client communication, and keep matters organized.',
    estimatedHoursSavedPerMonth: 30,
    recommendedStarterCredits: 1500,
    complianceNote:
      'AI assistants handle intake, document organization, scheduling, summarization, follow-up drafting, and internal workflow support only. They do not provide legal advice or represent the firm to clients.',
  },
]

export function getBusinessTemplate(id: string): BusinessTemplate | undefined {
  return BUSINESS_TEMPLATES.find((t) => t.id === id)
}
