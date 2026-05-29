/**
 * Guided Demo — a 60–90 second prospect walkthrough.
 *
 * Distinct from the First-Run Tour: that one helps a new operator orient.
 * This one answers a different question entirely:
 *
 *   "I am a prospect. In 60 seconds, what is this product?"
 *
 * The script is deliberately short and executive. Six steps. No jargon.
 * Auto-advance is opt-in; the default is operator-paced because real
 * executives skim, they do not click through. Each step anchors to a
 * surface that already exists — we do not invent UI to demo.
 */

export interface GuidedDemoStep {
  id: string
  /** A single sentence that fits in a phone-call answer. */
  title: string
  /** Two-line body — the "why this matters" companion. */
  body: string
  /** Optional pre-step navigation. Uses the existing panel system. */
  panel?: string
  /** Optional data-testid to anchor / highlight a real surface. */
  anchorTestId?: string
  /** Optional vertical-specific gloss — appears under the body when set. */
  forTemplate?: Record<string, string>
}

export const GUIDED_DEMO_STEPS: GuidedDemoStep[] = [
  {
    id: 'baseline-os',
    title: 'This is Baseline OS — the brain behind your AI workforce.',
    body:
      'It holds your business memory, derives operational truth from real activity, and connects skills to the right employees. You never see it directly. You see what it produces.',
  },
  {
    id: 'mission-control',
    title: 'This is Mission Control — your supervision layer.',
    body:
      'One executive page. Morning briefing on the top. Workforce in the middle. Approvals on the right. You operate the business; the workforce does the work.',
    panel: 'overview',
    anchorTestId: 'executive-briefing',
  },
  {
    id: 'ai-employees',
    title: 'These are AI Employees — named workers with roles and skills.',
    body:
      'Not chatbots. Each one has a role, a memory, a track record, and a skill set. They pick work up, do it, and ask you to approve.',
    panel: 'overview',
    anchorTestId: 'ai-employee-life-roster',
    forTemplate: {
      cpa: 'Today: AI Senior CPA, AI Bookkeeper, AI Tax Document Organizer, AI Client Success.',
      'law-firm': 'Today: AI Intake Assistant, AI Case Summary Assistant, AI Client Communications, AI Compliance Watch.',
      pm: 'Today: AI Maintenance Triage, AI Vendor Dispatch, AI Owner Updates, AI Leasing Assistant.',
      'ai-agency': 'Today: AI Workforce Manager, AI Client Success, AI Skills Operator, AI Utilization Watch.',
    },
  },
  {
    id: 'memory',
    title: 'Memory is how the workforce learns how your business operates.',
    body:
      'Notes, SOPs, contracts, past decisions — connected from Obsidian or Notion. Every answer carries a citation, so the work is never opaque.',
    panel: 'memory',
  },
  {
    id: 'approvals',
    title: 'You stay in control through approvals.',
    body:
      'When work needs human sign-off, it lands here with the memory the employee used. You approve, reject, or request changes. Trust trajectory follows.',
    panel: 'exec-approvals',
    anchorTestId: 'approval-queue',
  },
  {
    id: 'value',
    title: 'Value is measured in business outcomes, not metrics.',
    body:
      'Hours saved. Value created. Approvals reviewed. The Executive Briefing reports the business — not the dashboard.',
    panel: 'overview',
    anchorTestId: 'briefing-headline',
    forTemplate: {
      cpa: '124 hours saved this month. $11,900 value created. One reconciliation still needs you.',
      'law-firm': '88 hours saved this month. $14,200 value created. One conflict check needs you.',
      pm: '92 hours saved this month. $8,420 value created. One tenant escalation needs you.',
      'ai-agency': '142 hours saved this month. $22,400 value created. One quality dip needs you.',
    },
  },
]
