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
import type { AIEmployeeLifeSignal } from './ai-employee-life-signals'

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
  /** AI Employee life signals — workforce-in-motion roster for the overview. */
  lifeSignals?: AIEmployeeLifeSignal[]
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
    lifeSignals: [
      {
        agentSlug: 'maintenance-triage',
        agentName: 'AI Maintenance Triage Agent',
        presence: 'working',
        currentlyWorkingOn: 'Triaging burst pipe report at 142 Elm',
        confidence: 'high',
        workloadPressure: 'heavy',
        responseSpeedMin: 2,
        collaborators: ['AI Vendor Dispatch', 'AI Owner Updates'],
        escalation: { title: 'Tenant complaint at 142 Elm escalated', severity: 'high' },
        memoryUsed: { source: 'Obsidian', snippet: 'Any vendor quote > $400 → owner ping with photos before dispatch.' },
        skillsActive: ['priority-triage', 'photo-evidence', 'tenant-comms'],
        activeWorkflow: 'Emergency Response',
        recentWin: '38 tickets resolved this week without your team touching them',
        currentBlocker: null,
      },
      {
        agentSlug: 'vendor-dispatch',
        agentName: 'AI Vendor Dispatch',
        presence: 'waiting-for-approval',
        currentlyWorkingOn: 'Quote $620 for water cleanup — held for owner ping',
        confidence: 'medium',
        workloadPressure: 'balanced',
        responseSpeedMin: 5,
        collaborators: ['AI Maintenance Triage Agent', 'AI Owner Updates'],
        escalation: null,
        memoryUsed: { source: 'Obsidian', snippet: 'Q1 Doctrine: vendor quote > $400 requires owner photos approval.' },
        skillsActive: ['vendor-routing', 'cost-validation'],
        activeWorkflow: 'Vendor Dispatch',
        recentWin: 'Auto-dispatched 4 maintenance tickets this morning',
        currentBlocker: 'Awaiting owner photo approval for 142 Elm cleanup',
      },
      {
        agentSlug: 'owner-updates',
        agentName: 'AI Owner Updates',
        presence: 'working',
        currentlyWorkingOn: 'Composing monthly owner statements for 14 properties',
        confidence: 'high',
        workloadPressure: 'balanced',
        responseSpeedMin: 4,
        collaborators: [],
        escalation: null,
        memoryUsed: { source: 'Notion', snippet: 'Owner copy: plain-spoken, warm, never legalese.' },
        skillsActive: ['statement-generation', 'photo-attach'],
        activeWorkflow: 'Monthly Owner Update',
        recentWin: 'Caught a late rent payment before it cascaded — $280 recovered',
        currentBlocker: null,
      },
      {
        agentSlug: 'leasing-assistant',
        agentName: 'AI Leasing Assistant',
        presence: 'idle',
        currentlyWorkingOn: null,
        confidence: 'high',
        workloadPressure: 'light',
        responseSpeedMin: 8,
        collaborators: [],
        escalation: null,
        memoryUsed: null,
        skillsActive: ['tour-scheduling', 'application-review'],
        activeWorkflow: null,
        recentWin: 'Booked 6 tours overnight',
        currentBlocker: null,
      },
    ],
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
    lifeSignals: [
      {
        agentSlug: 'tax-doc-organizer',
        agentName: 'AI Tax Document Organizer',
        presence: 'working',
        currentlyWorkingOn: 'Chasing missing W-2 from client #211',
        confidence: 'high',
        workloadPressure: 'heavy',
        responseSpeedMin: 3,
        collaborators: ['AI Senior CPA', 'AI Bookkeeper'],
        escalation: null,
        memoryUsed: { source: 'Obsidian', snippet: 'SOP — outreach cadence: T+0 → T+72h → T+7d phone.' },
        skillsActive: ['document-chase', 'sms-outbound', 'email-followup'],
        activeWorkflow: 'Q1 W-2 Collection',
        recentWin: 'Closed W-2 collection for 47 clients this week',
        currentBlocker: null,
      },
      {
        agentSlug: 'senior-cpa',
        agentName: 'AI Senior CPA',
        presence: 'waiting-for-approval',
        currentlyWorkingOn: 'Client #88 reconciliation — held for partner review',
        confidence: 'medium',
        workloadPressure: 'balanced',
        responseSpeedMin: 7,
        collaborators: ['AI Tax Document Organizer'],
        escalation: { title: 'Client #88 reconciliation discrepancy ($3,200)', severity: 'high' },
        memoryUsed: { source: 'Obsidian', snippet: 'Q1 Doctrine: never file where 1099 totals do not reconcile. Escalate to operator with delta first.' },
        skillsActive: ['reconciliation', 'partner-escalation'],
        activeWorkflow: 'Q1 Filing Pipeline',
        recentWin: 'Closed monthly books for 11 clients ahead of schedule',
        currentBlocker: 'Awaiting partner sign-off on client #88',
      },
      {
        agentSlug: 'bookkeeper',
        agentName: 'AI Bookkeeper',
        presence: 'working',
        currentlyWorkingOn: 'Posting March transactions for 6 clients',
        confidence: 'high',
        workloadPressure: 'balanced',
        responseSpeedMin: 2,
        collaborators: ['AI Senior CPA'],
        escalation: null,
        memoryUsed: null,
        skillsActive: ['bank-feed-sync', 'category-mapping'],
        activeWorkflow: 'Daily Close',
        recentWin: 'Posted 312 transactions today, 0 manual review needed',
        currentBlocker: null,
      },
      {
        agentSlug: 'client-success',
        agentName: 'AI Client Success Manager',
        presence: 'idle',
        currentlyWorkingOn: null,
        confidence: 'high',
        workloadPressure: 'light',
        responseSpeedMin: 9,
        collaborators: ['AI Tax Document Organizer'],
        escalation: null,
        memoryUsed: null,
        skillsActive: ['client-survey'],
        activeWorkflow: null,
        recentWin: 'Sent Q1 NPS to 38 clients — 9.1 avg',
        currentBlocker: null,
      },
    ],
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
    lifeSignals: [
      {
        agentSlug: 'intake-assistant',
        agentName: 'AI Intake Assistant',
        presence: 'waiting-for-approval',
        currentlyWorkingOn: 'New intake: Henderson v. Westview — conflict-check held',
        confidence: 'medium',
        workloadPressure: 'heavy',
        responseSpeedMin: 4,
        collaborators: ['AI Conflict Check Agent', 'AI Case Summary Assistant'],
        escalation: { title: 'Potential conflict of interest — attorney sign-off required', severity: 'high' },
        memoryUsed: { source: 'Notion', snippet: 'Intake SOP: run conflict check BEFORE first consult is scheduled.' },
        skillsActive: ['intake-form', 'conflict-search'],
        activeWorkflow: 'New Client Intake',
        recentWin: 'Closed 4 intakes overnight — 100% packet completeness',
        currentBlocker: 'Awaiting attorney clearance on Henderson intake',
      },
      {
        agentSlug: 'case-summary',
        agentName: 'AI Case Summary Assistant',
        presence: 'working',
        currentlyWorkingOn: 'Drafting matter summary for Roberts complaint',
        confidence: 'high',
        workloadPressure: 'balanced',
        responseSpeedMin: 6,
        collaborators: ['AI Intake Assistant'],
        escalation: null,
        memoryUsed: { source: 'Pinecone', snippet: 'Similar matter recall: Walters complaint (closed 2024-08).' },
        skillsActive: ['document-summary', 'matter-tagging'],
        activeWorkflow: 'Matter Brief Generation',
        recentWin: 'Drafted 22 matter summaries this week',
        currentBlocker: null,
      },
      {
        agentSlug: 'client-comms',
        agentName: 'AI Client Communications',
        presence: 'working',
        currentlyWorkingOn: 'Sending matter updates to 14 active clients',
        confidence: 'high',
        workloadPressure: 'balanced',
        responseSpeedMin: 3,
        collaborators: [],
        escalation: null,
        memoryUsed: { source: 'Notion', snippet: 'Tone: firm, specific, never legalese.' },
        skillsActive: ['matter-update-email', 'scheduling'],
        activeWorkflow: 'Weekly Client Touch',
        recentWin: 'Zero client chase emails today',
        currentBlocker: null,
      },
      {
        agentSlug: 'compliance-watch',
        agentName: 'AI Compliance Watch',
        presence: 'online',
        currentlyWorkingOn: null,
        confidence: 'high',
        workloadPressure: 'light',
        responseSpeedMin: 12,
        collaborators: ['AI Intake Assistant'],
        escalation: null,
        memoryUsed: null,
        skillsActive: ['advertising-rules', 'fee-agreement-review'],
        activeWorkflow: null,
        recentWin: 'Flagged 1 advertising-rule risk pre-publication',
        currentBlocker: null,
      },
    ],
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
