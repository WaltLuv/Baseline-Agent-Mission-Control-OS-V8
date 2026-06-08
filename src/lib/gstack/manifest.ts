/**
 * GStack skills import — the first-25 growth-stack skill manifest + importer.
 *
 * This bundles a ready-to-import manifest of 25 GStack/YC-growth-stack skills
 * (classified, priced, approval-tiered) so the Skills Library / Marketplace has
 * a real first-25 import path that does NOT block on Walt. It also exposes a
 * validator + import-preview so an arbitrary manifest file can be uploaded.
 *
 * TRUTH-FIRST: importing here registers the skill *definition* (catalog row).
 * Skills that need credentials are flagged `requiredCredentials` and stay in an
 * honest setup-needed state until those providers are connected.
 */

export type GStackCategory =
  | 'Growth'
  | 'Sales'
  | 'SEO'
  | 'Content'
  | 'Ops'
  | 'Data'
  | 'Product'
  | 'Support'

export type ApprovalTier = 'auto' | 'review' | 'walt-only'

export interface GStackSkill {
  slug: string
  name: string
  category: GStackCategory
  summary: string
  pricing: 'free' | 'paid'
  priceUsd: number
  approvalTier: ApprovalTier
  /** Provider ids (from credentials catalog) this skill needs to execute live. */
  requiredCredentials: string[]
  /** What a successful run must produce as proof. */
  proofExpectations: string
}

/** The bundled first-25 GStack manifest. */
export const GSTACK_MANIFEST: GStackSkill[] = [
  { slug: 'cold-email-sequencer', name: 'Cold Email Sequencer', category: 'Sales', summary: 'Draft + schedule a multi-touch cold email sequence with personalization tokens.', pricing: 'free', priceUsd: 0, approvalTier: 'review', requiredCredentials: ['resend'], proofExpectations: 'Sequence draft + send schedule + per-step copy (no auto-send without approval).' },
  { slug: 'icp-builder', name: 'ICP Builder', category: 'Growth', summary: 'Build an ideal-customer-profile from a product description and signals.', pricing: 'free', priceUsd: 0, approvalTier: 'auto', requiredCredentials: [], proofExpectations: 'ICP doc with firmographics, pains, triggers, and disqualifiers.' },
  { slug: 'lead-enrichment', name: 'Lead Enrichment', category: 'Data', summary: 'Enrich a lead list with firmographic + contact data.', pricing: 'paid', priceUsd: 40, approvalTier: 'review', requiredCredentials: ['serpapi'], proofExpectations: 'Enriched CSV + source attribution per field.' },
  { slug: 'landing-page-copy', name: 'Landing Page Copy', category: 'Content', summary: 'Write conversion-focused landing-page copy from a brief.', pricing: 'free', priceUsd: 0, approvalTier: 'auto', requiredCredentials: [], proofExpectations: 'Hero + sections + CTA variants + meta description.' },
  { slug: 'seo-keyword-cluster', name: 'SEO Keyword Cluster', category: 'SEO', summary: 'Cluster keywords into topic groups with intent + difficulty.', pricing: 'free', priceUsd: 0, approvalTier: 'auto', requiredCredentials: ['serpapi'], proofExpectations: 'Cluster map + priority order + intent labels.' },
  { slug: 'programmatic-seo-planner', name: 'Programmatic SEO Planner', category: 'SEO', summary: 'Plan a programmatic SEO page template + data source.', pricing: 'paid', priceUsd: 60, approvalTier: 'review', requiredCredentials: [], proofExpectations: 'Template spec + variable schema + sample rendered page.' },
  { slug: 'content-calendar', name: 'Content Calendar', category: 'Content', summary: 'Generate a dated content calendar from pillars + cadence.', pricing: 'free', priceUsd: 0, approvalTier: 'auto', requiredCredentials: [], proofExpectations: 'Calendar table with dates, formats, channels, owners.' },
  { slug: 'twitter-thread-writer', name: 'Twitter/X Thread Writer', category: 'Content', summary: 'Turn a long-form idea into a hook-driven thread.', pricing: 'free', priceUsd: 0, approvalTier: 'auto', requiredCredentials: [], proofExpectations: 'Thread draft + hook variants (no auto-post).' },
  { slug: 'linkedin-outreach', name: 'LinkedIn Outreach', category: 'Sales', summary: 'Personalized connection + follow-up messages.', pricing: 'free', priceUsd: 0, approvalTier: 'review', requiredCredentials: [], proofExpectations: 'Message set + personalization notes (no auto-send).' },
  { slug: 'competitor-teardown', name: 'Competitor Teardown', category: 'Growth', summary: 'Teardown a competitor’s funnel, pricing, and positioning.', pricing: 'paid', priceUsd: 50, approvalTier: 'auto', requiredCredentials: ['firecrawl'], proofExpectations: 'Teardown report + screenshots + SWOT.' },
  { slug: 'pricing-experiment', name: 'Pricing Experiment Designer', category: 'Product', summary: 'Design a pricing A/B with hypotheses + metrics.', pricing: 'paid', priceUsd: 50, approvalTier: 'review', requiredCredentials: [], proofExpectations: 'Experiment doc + guardrail metrics + rollback plan.' },
  { slug: 'onboarding-flow', name: 'Onboarding Flow Designer', category: 'Product', summary: 'Design an activation-focused onboarding flow.', pricing: 'free', priceUsd: 0, approvalTier: 'auto', requiredCredentials: [], proofExpectations: 'Step map + aha-moment + activation metric.' },
  { slug: 'churn-saver', name: 'Churn Saver', category: 'Support', summary: 'Draft win-back + cancellation-deflection sequences.', pricing: 'paid', priceUsd: 40, approvalTier: 'review', requiredCredentials: ['resend'], proofExpectations: 'Win-back sequence + offer tiers (no auto-send).' },
  { slug: 'support-macros', name: 'Support Macro Library', category: 'Support', summary: 'Generate a support macro library from common tickets.', pricing: 'free', priceUsd: 0, approvalTier: 'auto', requiredCredentials: [], proofExpectations: 'Macro set keyed by intent + tone guide.' },
  { slug: 'analytics-dashboard-spec', name: 'Analytics Dashboard Spec', category: 'Data', summary: 'Spec a North-Star + supporting metrics dashboard.', pricing: 'free', priceUsd: 0, approvalTier: 'auto', requiredCredentials: [], proofExpectations: 'Metric tree + dashboard layout + query notes.' },
  { slug: 'ab-test-analyzer', name: 'A/B Test Analyzer', category: 'Data', summary: 'Analyze experiment results for significance + lift.', pricing: 'paid', priceUsd: 45, approvalTier: 'auto', requiredCredentials: [], proofExpectations: 'Significance verdict + lift + confidence + caveats.' },
  { slug: 'referral-program', name: 'Referral Program Designer', category: 'Growth', summary: 'Design a two-sided referral program with incentives.', pricing: 'paid', priceUsd: 50, approvalTier: 'review', requiredCredentials: [], proofExpectations: 'Program spec + incentive math + abuse guardrails.' },
  { slug: 'ad-copy-generator', name: 'Ad Copy Generator', category: 'Content', summary: 'Generate ad copy variants for search + social.', pricing: 'free', priceUsd: 0, approvalTier: 'auto', requiredCredentials: [], proofExpectations: 'Variant set by platform + character-limit compliance.' },
  { slug: 'webinar-funnel', name: 'Webinar Funnel Builder', category: 'Growth', summary: 'Build a webinar registration → nurture → offer funnel.', pricing: 'paid', priceUsd: 55, approvalTier: 'review', requiredCredentials: ['resend'], proofExpectations: 'Funnel map + email sequence + slide outline.' },
  { slug: 'case-study-writer', name: 'Case Study Writer', category: 'Content', summary: 'Turn customer results into a structured case study.', pricing: 'free', priceUsd: 0, approvalTier: 'auto', requiredCredentials: [], proofExpectations: 'Case study draft (challenge/solution/results) + pull-quotes.' },
  { slug: 'sales-call-prep', name: 'Sales Call Prep', category: 'Sales', summary: 'Prep dossiers + discovery questions before a call.', pricing: 'free', priceUsd: 0, approvalTier: 'auto', requiredCredentials: ['firecrawl'], proofExpectations: 'Account dossier + tailored discovery questions.' },
  { slug: 'newsletter-engine', name: 'Newsletter Engine', category: 'Content', summary: 'Plan + draft a recurring newsletter from sources.', pricing: 'paid', priceUsd: 40, approvalTier: 'review', requiredCredentials: ['resend'], proofExpectations: 'Issue draft + subject-line variants (no auto-send).' },
  { slug: 'kpi-weekly-report', name: 'KPI Weekly Report', category: 'Ops', summary: 'Assemble a weekly KPI report with commentary.', pricing: 'free', priceUsd: 0, approvalTier: 'auto', requiredCredentials: [], proofExpectations: 'Report with trends, deltas, and called-out risks.' },
  { slug: 'feature-launch-kit', name: 'Feature Launch Kit', category: 'Product', summary: 'Produce a launch kit: copy, email, changelog, social.', pricing: 'paid', priceUsd: 60, approvalTier: 'review', requiredCredentials: [], proofExpectations: 'Launch kit bundle + channel-ready assets.' },
  { slug: 'investor-update', name: 'Investor Update Drafter', category: 'Ops', summary: 'Draft a monthly investor update from metrics + asks.', pricing: 'paid', priceUsd: 50, approvalTier: 'walt-only', requiredCredentials: [], proofExpectations: 'Update draft (metrics/highlights/lowlights/asks) — owner approval required before send.' },
]

export interface ManifestValidation {
  ok: boolean
  count: number
  errors: string[]
  skills: GStackSkill[]
}

const CATEGORIES: GStackCategory[] = ['Growth', 'Sales', 'SEO', 'Content', 'Ops', 'Data', 'Product', 'Support']
const TIERS: ApprovalTier[] = ['auto', 'review', 'walt-only']

/** Validate an arbitrary uploaded manifest (array of skill objects). */
export function validateGStackManifest(input: unknown): ManifestValidation {
  const errors: string[] = []
  if (!Array.isArray(input)) {
    return { ok: false, count: 0, errors: ['Manifest must be a JSON array of skills.'], skills: [] }
  }
  const seen = new Set<string>()
  const skills: GStackSkill[] = []
  input.forEach((raw, i) => {
    const r = raw as Partial<GStackSkill>
    const where = `entry ${i + 1}`
    if (!r || typeof r !== 'object') { errors.push(`${where}: not an object`); return }
    if (!r.slug || typeof r.slug !== 'string') errors.push(`${where}: missing slug`)
    else if (seen.has(r.slug)) errors.push(`${where}: duplicate slug "${r.slug}"`)
    else seen.add(r.slug)
    if (!r.name) errors.push(`${where}: missing name`)
    if (!r.category || !CATEGORIES.includes(r.category)) errors.push(`${where}: invalid category`)
    if (r.pricing !== 'free' && r.pricing !== 'paid') errors.push(`${where}: pricing must be free|paid`)
    if (typeof r.priceUsd !== 'number') errors.push(`${where}: priceUsd must be a number`)
    if (!r.approvalTier || !TIERS.includes(r.approvalTier)) errors.push(`${where}: invalid approvalTier`)
    if (!Array.isArray(r.requiredCredentials)) errors.push(`${where}: requiredCredentials must be an array`)
    if (!r.proofExpectations) errors.push(`${where}: missing proofExpectations`)
    if (errors.length === 0 || (r.slug && r.name && r.category)) {
      skills.push(r as GStackSkill)
    }
  })
  return { ok: errors.length === 0, count: skills.length, errors, skills }
}

/** Classify the bundled manifest by category (for the import preview). */
export function classifyManifest(skills: GStackSkill[] = GSTACK_MANIFEST): Record<GStackCategory, GStackSkill[]> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, [] as GStackSkill[]])) as Record<GStackCategory, GStackSkill[]>
  for (const s of skills) out[s.category].push(s)
  return out
}

export const GSTACK_FIRST_25_COUNT = GSTACK_MANIFEST.length
