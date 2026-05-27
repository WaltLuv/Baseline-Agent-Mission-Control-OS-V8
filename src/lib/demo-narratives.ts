/**
 * Demo Mode — lets a visitor view Mission Control as if they ran one of the
 * nine business templates. Persists via cookie + URL query string so sales
 * links like `?demo=cpa` survive page reloads.
 *
 * This is intentionally lightweight: in demo mode we OVERLAY a curated story
 * (executive briefing, recent wins, attention items, value created) on the
 * existing UI. It does not mutate the live workspace database. The real
 * demo workspaces seeded by `scripts/seed-demo-workspace.ts` back the data
 * when the operator actually clicks through.
 */
import { BUSINESS_TEMPLATES, type BusinessTemplate } from './business-templates'

export interface DemoNarrative {
  template: BusinessTemplate
  /** Headline that opens the Morning Briefing. */
  briefingHeadline: string
  /** Three "what happened today" wins. */
  dailyWins: { title: string; impact: string; valueUsd: number }[]
  /** What needs attention — surfaces in the Attention Required panel. */
  attentionItems: { title: string; severity: 'low' | 'medium' | 'high'; reason: string }[]
  /** Cumulative value-created counter (USD this month so far). */
  valueCreatedMonthUsd: number
  /** Hours saved this month (approximate). */
  hoursSavedMonth: number
  /** "What you should do next" — single primary action. */
  nextAction: { label: string; href: string }
  /** Star AI employee of the day. */
  topEmployee: { name: string; impact: string }
}

const NARRATIVES: Record<string, Omit<DemoNarrative, 'template'>> = {
  pm: {
    briefingHeadline: 'Quiet morning, two doors making noise.',
    dailyWins: [
      { title: 'Auto-dispatched 4 maintenance tickets', impact: '7 hours saved', valueUsd: 245 },
      { title: 'Sent monthly owner update for 14 properties', impact: '5 hours saved', valueUsd: 175 },
      { title: 'Caught a late rent payment before it cascaded', impact: '$280 recovered', valueUsd: 280 },
    ],
    attentionItems: [
      { title: 'Tenant complaint at 142 Elm escalated', severity: 'high', reason: 'AI flagged: tone analysis suggests legal-tier complaint.' },
      { title: 'Vendor at 88 Birch missed scheduled inspection', severity: 'medium', reason: 'No-show 2× this month.' },
    ],
    valueCreatedMonthUsd: 8420,
    hoursSavedMonth: 92,
    nextAction: { label: 'Review tenant escalation', href: '/app/tasks' },
    topEmployee: { name: 'AI Maintenance Triage Agent', impact: '38 tickets resolved this week without your team touching them.' },
  },
  gc: {
    briefingHeadline: 'Two bids signed overnight. One conflict needs you.',
    dailyWins: [
      { title: 'Awarded Madison St rebuild', impact: '$48k contract', valueUsd: 4800 },
      { title: 'Closed Highland Ave punch list', impact: 'Final payment unlocked', valueUsd: 1200 },
      { title: 'Built bid for Edgewater kitchen', impact: '6 hours saved', valueUsd: 210 },
    ],
    attentionItems: [
      { title: 'Edgewater bid: change-order conflict', severity: 'high', reason: '$4.2k scope overlap between two subs.' },
    ],
    valueCreatedMonthUsd: 17_200,
    hoursSavedMonth: 64,
    nextAction: { label: 'Resolve change-order conflict', href: '/app/tasks' },
    topEmployee: { name: 'AI Bid Estimator', impact: '11 estimates this week — your team would have done 4.' },
  },
  'home-services': {
    briefingHeadline: 'Booked 17 calls overnight. One emergency.',
    dailyWins: [
      { title: 'Booked 17 service calls', impact: '$12k pipeline', valueUsd: 1200 },
      { title: 'Recovered 4 abandoned quotes', impact: '$3.1k recovered', valueUsd: 3100 },
      { title: 'Sent 23 post-service follow-ups', impact: '8 reviews coming', valueUsd: 400 },
    ],
    attentionItems: [
      { title: 'Gas leak reported — no tech in 5-mile radius', severity: 'high', reason: 'AI Dispatcher escalated. Manual override required.' },
    ],
    valueCreatedMonthUsd: 14_300,
    hoursSavedMonth: 88,
    nextAction: { label: 'Resolve emergency dispatch', href: '/app/tasks' },
    topEmployee: { name: 'AI Intake Receptionist', impact: '116 calls answered this month. Zero missed.' },
  },
  'ai-agency': {
    briefingHeadline: 'Client Alpha had a banner week.',
    dailyWins: [
      { title: 'Delivered ROI deck to Client Alpha', impact: '47h saved · $4.1k labor value', valueUsd: 4100 },
      { title: 'Switched Client Bravo routes to gemini-flash', impact: '$320/mo savings', valueUsd: 320 },
      { title: 'Onboarded Client Charlie', impact: 'New MRR online', valueUsd: 1800 },
    ],
    attentionItems: [
      { title: 'Client Bravo: quality score dipped 14%', severity: 'medium', reason: '3 sessions flagged for human review.' },
    ],
    valueCreatedMonthUsd: 22_400,
    hoursSavedMonth: 142,
    nextAction: { label: 'Review flagged sessions', href: '/app/security-audit' },
    topEmployee: { name: 'AI Workforce Manager', impact: 'Coordinated 3 client onboardings this week.' },
  },
  'real-estate': {
    briefingHeadline: '18 Westwood under contract. Two listings need pricing strategy.',
    dailyWins: [
      { title: '18 Westwood: offer accepted', impact: '$615k sale price', valueUsd: 18_450 },
      { title: 'Qualified 12 inbound buyer leads', impact: '4 hot, 8 nurture', valueUsd: 1200 },
      { title: 'Sent 31 post-close nurture emails', impact: '7 referrals pending', valueUsd: 800 },
    ],
    attentionItems: [
      { title: 'Counter-offer terms unclear on 18 Westwood', severity: 'high', reason: 'AI Transaction Coordinator wants your call before responding.' },
    ],
    valueCreatedMonthUsd: 28_600,
    hoursSavedMonth: 71,
    nextAction: { label: 'Approve counter-offer response', href: '/app/tasks' },
    topEmployee: { name: 'AI Lead Capture Assistant', impact: '12 leads qualified · zero touched by a human first.' },
  },
  mortgage: {
    briefingHeadline: 'Six loans funded this month. One appraisal came in low.',
    dailyWins: [
      { title: 'Funded 6 loans this month', impact: '$1.8M closed volume', valueUsd: 18_000 },
      { title: 'Sent rate quotes to 22 borrowers', impact: '3 ready to sign', valueUsd: 900 },
      { title: 'Cleared underwriting for #4377', impact: 'On track for Friday close', valueUsd: 600 },
    ],
    attentionItems: [
      { title: 'Borrower #4421: appraisal came in $14k under contract', severity: 'high', reason: 'Loan officer needs to call before automated email goes out.' },
    ],
    valueCreatedMonthUsd: 24_900,
    hoursSavedMonth: 96,
    nextAction: { label: 'Call borrower #4421', href: '/app/tasks' },
    topEmployee: { name: 'AI Doc Collection Assistant', impact: '94% of borrowers have all docs in within 7 days.' },
  },
  cpa: {
    briefingHeadline: 'Tax season pressure is dropping. One reconciliation needs you.',
    dailyWins: [
      { title: 'Filed extensions for 9 clients', impact: '12 hours saved', valueUsd: 540 },
      { title: 'Closed monthly books for 11 clients', impact: 'On time for the first quarter ever', valueUsd: 2400 },
      { title: 'Sent payroll reminders to 24 clients', impact: '0 late filings', valueUsd: 800 },
    ],
    attentionItems: [
      { title: 'Client #88 — 1099 reconciliation discrepancy ($3,200)', severity: 'high', reason: 'AI flagged. Needs partner review before filing.' },
    ],
    valueCreatedMonthUsd: 11_900,
    hoursSavedMonth: 124,
    nextAction: { label: 'Review #88 reconciliation', href: '/app/tasks' },
    topEmployee: { name: 'AI Tax Document Organizer', impact: 'Chased 47 missing W-2s this week with zero staff time.' },
  },
  'marketing-agency': {
    briefingHeadline: 'Orion campaign live. One ad blocked.',
    dailyWins: [
      { title: 'Launched Orion paid-social campaign', impact: '12 ad variants live', valueUsd: 1800 },
      { title: 'Delivered Q1 reports for 8 clients', impact: '34 hours saved', valueUsd: 1400 },
      { title: 'Repurposed 4 posts into 28 social pieces', impact: 'Content shelf full', valueUsd: 600 },
    ],
    attentionItems: [
      { title: 'Client Orion ad blocked by platform policy', severity: 'medium', reason: 'Needs creative revision before relaunch.' },
    ],
    valueCreatedMonthUsd: 18_700,
    hoursSavedMonth: 108,
    nextAction: { label: 'Revise blocked creative', href: '/app/tasks' },
    topEmployee: { name: 'AI Content Strategist', impact: 'Published 28 client pieces this week.' },
  },
  'law-firm': {
    briefingHeadline: 'Four intakes overnight. One may be a conflict.',
    dailyWins: [
      { title: 'Closed 4 client intakes', impact: 'Consults booked', valueUsd: 1200 },
      { title: 'Sent matter updates to 14 clients', impact: 'Zero client chase emails today', valueUsd: 700 },
      { title: 'Cleared 3 document collections', impact: 'Filing-ready', valueUsd: 800 },
    ],
    attentionItems: [
      { title: 'New intake: potential conflict of interest detected', severity: 'high', reason: 'AI flagged via similar-matter check. Attorney must clear before consult.' },
    ],
    valueCreatedMonthUsd: 14_200,
    hoursSavedMonth: 88,
    nextAction: { label: 'Clear conflict check', href: '/app/tasks' },
    topEmployee: { name: 'AI Case Summary Assistant', impact: 'Drafted 22 matter summaries this week.' },
  },
}

export function getDemoNarrative(templateId: string): DemoNarrative | null {
  const tpl = BUSINESS_TEMPLATES.find((t) => t.id === templateId)
  if (!tpl) return null
  const n = NARRATIVES[templateId]
  if (!n) return null
  return { template: tpl, ...n }
}

export const DEMO_TEMPLATE_IDS = Object.keys(NARRATIVES)
