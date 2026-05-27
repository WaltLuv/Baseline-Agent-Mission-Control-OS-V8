/**
 * AI Employee identity catalog.
 *
 * Each AI employee has a real role, a mission, a personality stance, and
 * a few signature strengths. This is what turns "Agent #4" into "Mara, your
 * AI Maintenance Triage Agent — calm under pressure, escalates legal-tier
 * complaints fast."
 *
 * The catalog matches employee names used in `business-templates.ts`. New
 * names fall back to a generic identity so the UI never breaks.
 */
export interface AIEmployeeIdentity {
  /** Display name (matches name on agent record). */
  name: string
  /** "Codename" / nickname surfaced on cards. */
  codename: string
  /** One-sentence mission. */
  mission: string
  /** Personality stance — short adjectives. */
  personality: string
  /** Signature strengths — 3 short bullet labels. */
  strengths: string[]
  /** Avatar emoji (we never ship faces — emoji avoids uncanny valley). */
  avatar: string
  /** Trust band default. */
  trustBand: 'high' | 'medium' | 'building'
}

const CATALOG: AIEmployeeIdentity[] = [
  // Property management
  { name: 'AI Maintenance Triage Agent', codename: 'Mara', mission: 'Routes maintenance requests to the right vendor, fast.', personality: 'Calm. Decisive. Tenant-empathetic.', strengths: ['Vendor matching', 'Severity scoring', 'Tenant comms'], avatar: '🛠️', trustBand: 'high' },
  { name: 'AI Inspection Reporter', codename: 'Vance', mission: 'Turns inspection photos into clean owner-ready reports.', personality: 'Detail-obsessed.', strengths: ['Photo analysis', 'Report drafting', 'Compliance flags'], avatar: '📋', trustBand: 'high' },
  { name: 'AI Owner Comms Assistant', codename: 'Olive', mission: 'Keeps property owners informed without the busywork.', personality: 'Warm. Plain-spoken.', strengths: ['Monthly updates', 'Tone calibration', 'Email drafting'], avatar: '💌', trustBand: 'high' },
  // GC
  { name: 'AI Bid Estimator', codename: 'Bex', mission: 'Builds defensible bids in hours, not days.', personality: 'Numbers-first.', strengths: ['Cost rollups', 'Sub matching', 'Margin guard'], avatar: '🧮', trustBand: 'high' },
  { name: 'AI Project Scheduler', codename: 'Sage', mission: 'Keeps every project on a believable timeline.', personality: 'Organized. Realistic.', strengths: ['Critical path', 'Sub coordination', 'Slip alerts'], avatar: '🗓️', trustBand: 'high' },
  { name: 'AI QC Inspector', codename: 'Quinn', mission: 'Flags quality issues before the client does.', personality: 'Skeptical. Thorough.', strengths: ['Checklist runs', 'Punch list', 'Photo evidence'], avatar: '🔍', trustBand: 'medium' },
  // Home services
  { name: 'AI Intake Receptionist', codename: 'Ren', mission: 'Picks up every call. Books every job. Misses nothing.', personality: 'Polite. Persistent.', strengths: ['Call answer', 'Lead capture', 'Calendar handoff'], avatar: '📞', trustBand: 'high' },
  { name: 'AI Quote Assistant', codename: 'Quincy', mission: 'Sends tight quotes within 60 minutes of the lead.', personality: 'Quick. Confident.', strengths: ['Estimation', 'Quote draft', 'Follow-up'], avatar: '🧾', trustBand: 'medium' },
  { name: 'AI Dispatcher', codename: 'Dax', mission: 'Gets the right tech to the right job before frustration sets in.', personality: 'Cool under pressure.', strengths: ['Geo routing', 'Priority swapping', 'SMS updates'], avatar: '🚐', trustBand: 'medium' },
  // AI Agency
  { name: 'AI Workforce Manager', codename: 'Wynn', mission: 'Keeps every client workspace running like clockwork.', personality: 'Strategic. Calm.', strengths: ['Client onboarding', 'Workforce sizing', 'Health monitoring'], avatar: '🎛️', trustBand: 'high' },
  { name: 'AI QA Reviewer', codename: 'Quinta', mission: 'Catches quality drops before clients notice.', personality: 'Skeptical. Honest.', strengths: ['Session scoring', 'Drift detection', 'Hallucination flags'], avatar: '🔬', trustBand: 'high' },
  { name: 'AI Cost Tracker', codename: 'Cass', mission: 'Watches every dollar across every client.', personality: 'Frugal. Sharp.', strengths: ['Cost/route analysis', 'Switch recos', 'Margin alerts'], avatar: '💸', trustBand: 'high' },
  // Real estate
  { name: 'AI Lead Capture Assistant', codename: 'Lex', mission: 'Pre-qualifies every inbound buyer or seller.', personality: 'Warm. Quick.', strengths: ['Inbound triage', 'Tour scheduling', 'Nurture sequences'], avatar: '📥', trustBand: 'high' },
  { name: 'AI CMA Analyst', codename: 'Cami', mission: 'Builds listing-ready CMAs in minutes.', personality: 'Data-loving.', strengths: ['Comp pulling', 'Pricing strategy', 'Listing brief'], avatar: '📈', trustBand: 'high' },
  { name: 'AI Showing Coordinator', codename: 'Sol', mission: 'Books, confirms, reminds — every tour, every time.', personality: 'Friendly. Reliable.', strengths: ['Calendar tetris', 'Confirmations', 'Reminder cadence'], avatar: '🗝️', trustBand: 'high' },
  { name: 'AI Transaction Coordinator', codename: 'Tess', mission: 'Drives closings through every contractual milestone.', personality: 'Detail-obsessed.', strengths: ['Timeline tracking', 'Document collection', 'Stakeholder updates'], avatar: '📑', trustBand: 'medium' },
  // Mortgage
  { name: 'AI Application Intake Assistant', codename: 'Aria', mission: 'Captures every application cleanly the first time.', personality: 'Patient. Precise.', strengths: ['Borrower interview', 'Doc handoff', 'Bias-aware language'], avatar: '🗂️', trustBand: 'high' },
  { name: 'AI Pre-Qual Scorer', codename: 'Pax', mission: 'Tiers borrowers and recommends the right product.', personality: 'Quick. Conservative.', strengths: ['Income analysis', 'DTI checks', 'Product matching'], avatar: '🎯', trustBand: 'medium' },
  { name: 'AI Doc Collection Assistant', codename: 'Dot', mission: 'Chases missing docs without nagging.', personality: 'Helpful. Persistent.', strengths: ['Doc checklist', 'Friendly chase', 'Verification handoff'], avatar: '📨', trustBand: 'high' },
  { name: 'AI Rate Quote Assistant', codename: 'Reese', mission: 'Builds personalized rate-quote comparisons.', personality: 'Transparent.', strengths: ['Multi-lender rates', 'Comparison narratives', 'Rate-lock reminders'], avatar: '📊', trustBand: 'high' },
  { name: 'AI Loan Officer Assistant', codename: 'Lou', mission: 'Keeps loan officers informed about every borrower.', personality: 'Coordinated.', strengths: ['Pipeline updates', 'Status digests', 'LO scheduling'], avatar: '🧑\u200d💼', trustBand: 'high' },
  // CPA
  { name: 'AI Client Intake Assistant', codename: 'Ivy', mission: 'Onboards new clients without losing the engagement letter.', personality: 'Welcoming.', strengths: ['Engagement letters', 'KYC', 'Doc requests'], avatar: '🤝', trustBand: 'high' },
  { name: 'AI Tax Document Organizer', codename: 'Theo', mission: 'Hunts down every missing 1099 and W-2.', personality: 'Tireless.', strengths: ['Doc tracking', 'Friendly chase', 'Categorization hints'], avatar: '🗃️', trustBand: 'high' },
  { name: 'AI Bookkeeping Follow-Up Assistant', codename: 'Beck', mission: 'Closes the books on time, every month.', personality: 'Methodical.', strengths: ['Categorization Q&A', 'Reconciliation prompts', 'Month-end close'], avatar: '📚', trustBand: 'medium' },
  { name: 'AI Payroll & Compliance Reminder Assistant', codename: 'Cora', mission: 'Never lets a payroll deadline slip.', personality: 'Watchful.', strengths: ['Quarterly reminders', 'Compliance flags', 'Owner ping'], avatar: '⏰', trustBand: 'high' },
  { name: 'AI Reporting Analyst', codename: 'Reva', mission: 'Drafts monthly reports clients actually read.', personality: 'Plainspoken.', strengths: ['Report drafting', 'Variance commentary', 'Client-language framing'], avatar: '📑', trustBand: 'high' },
  // Marketing
  { name: 'AI Content Strategist', codename: 'Cleo', mission: 'Keeps content shelves full across every client.', personality: 'Creative. Disciplined.', strengths: ['Calendar', 'Brand voice', 'Repurposing'], avatar: '🎨', trustBand: 'high' },
  { name: 'AI Campaign Assistant', codename: 'Cam', mission: 'Ships campaigns end-to-end without dropping the ball.', personality: 'Energetic.', strengths: ['Brief drafting', 'Variant generation', 'Launch checklist'], avatar: '🚀', trustBand: 'medium' },
  { name: 'AI Social Media Scheduler', codename: 'Solly', mission: 'Posts the right thing at the right time, everywhere.', personality: 'Steady.', strengths: ['Cross-platform timing', 'Hashtag picks', 'Content recycling'], avatar: '🔔', trustBand: 'high' },
  { name: 'AI Client Reporting Analyst', codename: 'Romi', mission: 'Builds client-ready performance decks.', personality: 'Honest.', strengths: ['KPI rollups', 'Narrative summaries', 'YoY framing'], avatar: '📈', trustBand: 'high' },
  { name: 'AI Lead Research Assistant', codename: 'Lior', mission: 'Finds the next 20 ideal-fit prospects.', personality: 'Curious.', strengths: ['ICP profiling', 'List building', 'Dossier drafting'], avatar: '🔎', trustBand: 'high' },
  // Law
  { name: 'AI Case Summary Assistant', codename: 'Cyra', mission: 'Distills every matter into a clear one-page brief.', personality: 'Precise.', strengths: ['Matter summarization', 'Timeline drafting', 'Doc cross-reference'], avatar: '⚖️', trustBand: 'medium' },
  { name: 'AI Document Review Assistant', codename: 'Dare', mission: 'Surfaces what matters in long documents.', personality: 'Patient.', strengths: ['Issue spotting', 'Comparison', 'Excerpt pulls'], avatar: '📜', trustBand: 'medium' },
  { name: 'AI Follow-Up Coordinator', codename: 'Fern', mission: 'Closes the loop on every client touchpoint.', personality: 'Thoughtful.', strengths: ['Cadence drafting', 'Tone calibration', 'Reminder rhythm'], avatar: '✉️', trustBand: 'high' },
  { name: 'AI Scheduling Assistant', codename: 'Skye', mission: 'Books consults, hearings, and depositions.', personality: 'Reliable.', strengths: ['Calendar tetris', 'Conflict checks', 'Confirmation cadence'], avatar: '📆', trustBand: 'high' },
]

export function getAIEmployeeIdentity(name: string): AIEmployeeIdentity {
  const exact = CATALOG.find((e) => e.name === name)
  if (exact) return exact
  // Fallback: build a sane default so the UI keeps its shape.
  return {
    name,
    codename: name.replace(/^AI\s+/i, '').split(' ')[0] || 'Aide',
    mission: 'Helps your business get more done with less admin time.',
    personality: 'Reliable.',
    strengths: ['Drafting', 'Coordination', 'Follow-up'],
    avatar: '🤖',
    trustBand: 'building',
  }
}
