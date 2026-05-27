/**
 * Demo workspace seeder.
 *
 * Builds polished, realistic-feeling demo data for every business template so
 * that when a prospect opens Mission Control they see a workspace that is
 * already "alive in 60 seconds" — AI employees doing work, credits being
 * spent, time saved, ROI computed, and one attention-needed item to drive
 * engagement.
 *
 * Usage:
 *   MISSION_CONTROL_TEST_MODE=1 pnpm tsx scripts/seed-demo-workspace.ts <templateId>
 *   MISSION_CONTROL_TEST_MODE=1 pnpm tsx scripts/seed-demo-workspace.ts --all
 *
 * Idempotent: re-running on an existing workspace is a no-op for rows that
 * already exist.
 */
import { getDatabase } from '../src/lib/db'
import { BUSINESS_TEMPLATES, getBusinessTemplate } from '../src/lib/business-templates'
import { grantCredits, chargeForAction } from '../src/lib/billing'

process.env.MISSION_CONTROL_TEST_MODE = '1'

interface SeedResult {
  templateId: string
  workspaceId: number
  aiEmployees: number
  skills: number
  workflows: number
  tasks: number
  creditsGranted: number
  creditsUsed: number
  attentionItems: number
}

function ensureWorkspace(name: string, templateId: string): number {
  const db = getDatabase()
  // Check if a demo workspace for this template already exists.
  const existing = db.prepare(
    "SELECT id FROM workspaces WHERE name = ? LIMIT 1"
  ).get(name) as { id: number } | undefined
  if (existing) return existing.id
  // Create one. We use minimal columns + sensible defaults — every workspaces
  // schema migration in the codebase shares (id, tenant_id, name).
  try {
    const r = db.prepare(
      'INSERT INTO workspaces (tenant_id, name, settings_json, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())'
    ).run(1, name, JSON.stringify({ demo: true, templateId }))
    return Number(r.lastInsertRowid)
  } catch {
    // Fallback to the default workspace id 1 if the table shape differs.
    return 1
  }
}

function ensureAgent(workspaceId: number, name: string): number {
  const db = getDatabase()
  const existing = db.prepare(
    'SELECT id FROM agents WHERE workspace_id = ? AND name = ? LIMIT 1'
  ).get(workspaceId, name) as { id: number } | undefined
  if (existing) return existing.id
  try {
    const r = db.prepare(
      "INSERT INTO agents (workspace_id, tenant_id, name, status, capacity, created_at, updated_at) VALUES (?, 1, ?, 'active', 3, unixepoch(), unixepoch())"
    ).run(workspaceId, name)
    return Number(r.lastInsertRowid)
  } catch {
    return 0
  }
}

function ensureSkill(name: string): void {
  const db = getDatabase()
  try {
    db.prepare(
      "INSERT OR IGNORE INTO skills (name, installed, source, created_at, updated_at) VALUES (?, 1, 'demo', unixepoch(), unixepoch())"
    ).run(name)
  } catch {
    // Schema variation — skills table may not exist in older shapes.
  }
}

function ensureTask(
  workspaceId: number,
  title: string,
  status: string,
  priority: string,
  description?: string,
): number {
  const db = getDatabase()
  const existing = db.prepare(
    'SELECT id FROM tasks WHERE workspace_id = ? AND title = ? LIMIT 1'
  ).get(workspaceId, title) as { id: number } | undefined
  if (existing) return existing.id
  try {
    const r = db.prepare(
      'INSERT INTO tasks (workspace_id, tenant_id, title, description, status, priority, created_at, updated_at) VALUES (?, 1, ?, ?, ?, ?, unixepoch(), unixepoch())'
    ).run(workspaceId, title, description ?? '', status, priority)
    return Number(r.lastInsertRowid)
  } catch {
    return 0
  }
}

function seedTemplate(templateId: string): SeedResult {
  const tpl = getBusinessTemplate(templateId)
  if (!tpl) throw new Error(`Unknown template: ${templateId}`)

  const workspaceName = `Demo — ${tpl.name}`
  const workspaceId = ensureWorkspace(workspaceName, tpl.id)
  let creditsGranted = 0
  let creditsUsed = 0

  // Grant a fresh credit allowance.
  const grantKey = `demo-grant-${tpl.id}`
  const granted = grantCredits({
    workspaceId,
    credits: tpl.recommendedStarterCredits,
    sourceType: 'manual',
    sourceId: 'demo-seed',
    description: `Demo allowance for ${tpl.name}`,
    idempotencyKey: grantKey,
  })
  if (granted) creditsGranted = tpl.recommendedStarterCredits

  // Provision AI employees + skills.
  for (const name of tpl.aiEmployees) ensureAgent(workspaceId, name)
  for (const skill of tpl.skills) ensureSkill(skill)

  // Seed tasks across the kanban board:
  //   - 1 "first 5-minute" task in inbox  (the starter)
  //   - 2 "in progress" tasks
  //   - 3 "done" tasks (proves the AI workforce is actually doing work)
  //   - 1 "needs attention" task (creates engagement)
  ensureTask(workspaceId, tpl.starterTaskTitle, 'inbox', 'high', tpl.starterTaskDescription)

  const inProgress = sampleInProgressTasksFor(tpl.id)
  for (const t of inProgress) ensureTask(workspaceId, t.title, 'in-progress', t.priority, t.description)

  const done = sampleDoneTasksFor(tpl.id)
  for (const t of done) ensureTask(workspaceId, t.title, 'done', t.priority, t.description)

  const attention = sampleAttentionTaskFor(tpl.id)
  ensureTask(workspaceId, attention.title, 'review', 'high', attention.description)

  // Simulate completed work credit usage so the margin endpoint has data.
  for (const t of done) {
    try {
      chargeForAction(
        workspaceId,
        'agent_session',
        'agent_session',
        `demo:${tpl.id}:${t.title}`,
        `demo-charge-${tpl.id}-${t.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
        null,
        null,
        { customCredits: t.credits },
      )
      creditsUsed += t.credits
    } catch {
      // Likely insufficient demo budget; skip.
    }
  }

  return {
    templateId: tpl.id,
    workspaceId,
    aiEmployees: tpl.aiEmployees.length,
    skills: tpl.skills.length,
    workflows: tpl.workflows.length,
    tasks: 1 + inProgress.length + done.length + 1,
    creditsGranted,
    creditsUsed,
    attentionItems: 1,
  }
}

interface DemoTask {
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  credits: number
}

function sampleInProgressTasksFor(id: string): DemoTask[] {
  const samples: Record<string, DemoTask[]> = {
    pm: [
      { title: 'Triage maintenance request: water heater @ 142 Elm', description: 'Tenant reports no hot water since 7am. Vendor dispatch in progress.', priority: 'high', credits: 12 },
      { title: 'Draft monthly owner update for 92 Birch', description: 'Pull rent collection + open work orders.', priority: 'medium', credits: 8 },
    ],
    gc: [
      { title: 'Prepare bid for Edgewater kitchen remodel', description: 'Estimate materials + subs for 220sqft remodel.', priority: 'high', credits: 18 },
      { title: 'Punch list — Madison St rebuild', description: 'Walkthrough photos uploaded by site supervisor.', priority: 'medium', credits: 11 },
    ],
    'home-services': [
      { title: 'Quote for HVAC swap — 88 Oakridge', description: 'Customer requested same-day quote.', priority: 'high', credits: 9 },
      { title: 'Schedule plumbing follow-ups for week of 6/10', description: 'Batch 14 follow-up calls into AI dispatcher.', priority: 'medium', credits: 7 },
    ],
    'ai-agency': [
      { title: 'Weekly QA review for Client Alpha', description: 'Review 22 sessions for hallucinations + tool errors.', priority: 'medium', credits: 15 },
      { title: 'Cost optimization sweep — Client Bravo', description: 'Identify routes that should switch to cheaper model.', priority: 'medium', credits: 10 },
    ],
    'real-estate': [
      { title: 'Build CMA for 18 Westwood listing prep', description: 'Pull 6 active + 8 closed comps.', priority: 'high', credits: 14 },
      { title: 'Follow up on 3 buyer leads from Saturday open house', description: 'Personalized email + tour scheduling.', priority: 'high', credits: 9 },
    ],
    mortgage: [
      { title: 'Send doc checklist — Borrower #4421', description: 'Conventional purchase. 30 days to close.', priority: 'high', credits: 8 },
      { title: 'Pre-qual scoring for 5 inbound applications', description: 'AI Pre-Qual Scorer produces tier + recommended product.', priority: 'medium', credits: 11 },
    ],
    cpa: [
      { title: 'Tax document follow-up — 7 clients still missing W-2', description: 'Personalized email chase with deadline.', priority: 'high', credits: 9 },
      { title: 'Monthly bookkeeping categorization — Client #88', description: 'Review uncategorized transactions before close.', priority: 'medium', credits: 12 },
    ],
    'marketing-agency': [
      { title: 'Build 7-day content calendar for Client Orion', description: 'Mixed organic + paid across IG, LinkedIn, X.', priority: 'medium', credits: 16 },
      { title: 'Performance report — Q2 campaigns', description: 'Pull GA4 + ad-platform data into client deck.', priority: 'high', credits: 13 },
    ],
    'law-firm': [
      { title: 'Summarize 4 new client intakes from this morning', description: 'One-paragraph matter summary + follow-up email each.', priority: 'high', credits: 10 },
      { title: 'Build document checklist for new family law matter', description: 'Standard intake docs + jurisdiction-specific items.', priority: 'medium', credits: 8 },
    ],
  }
  return samples[id] ?? []
}

function sampleDoneTasksFor(id: string): DemoTask[] {
  const samples: Record<string, DemoTask[]> = {
    pm: [
      { title: 'Owner report sent — 14 properties (Q1)', description: 'Auto-generated + emailed.', priority: 'medium', credits: 24 },
      { title: 'Dispatched 8 vendor work orders this week', description: 'AI matched maintenance request → vendor.', priority: 'medium', credits: 18 },
      { title: 'Drafted 22 tenant lease-renewal emails', description: 'Personalized with rent + term updates.', priority: 'low', credits: 16 },
    ],
    gc: [
      { title: 'Awarded Madison St rebuild contract', description: 'Bid produced + sent + signed.', priority: 'high', credits: 30 },
      { title: 'Tracked progress photos for 6 active projects', description: 'Weekly client update auto-built.', priority: 'medium', credits: 22 },
      { title: 'Closed punch list for Highland Ave', description: 'All 14 items resolved + signed off.', priority: 'medium', credits: 14 },
    ],
    'home-services': [
      { title: 'Booked 17 service calls this week', description: 'AI Intake → AI Dispatcher.', priority: 'medium', credits: 26 },
      { title: 'Sent 23 post-service follow-ups', description: 'Review request + maintenance reminder.', priority: 'low', credits: 18 },
      { title: 'Recovered 4 leads abandoned at quote stage', description: 'Auto follow-up with discount.', priority: 'medium', credits: 12 },
    ],
    'ai-agency': [
      { title: 'Delivered ROI deck to Client Alpha', description: '47h saved, $4 100 labor value.', priority: 'high', credits: 35 },
      { title: 'Switched Client Bravo routes to gemini-flash', description: 'Saved ~$320/mo at no quality drop.', priority: 'medium', credits: 22 },
      { title: 'Onboarded Client Charlie workspace', description: 'New tenant + 4 AI employees provisioned.', priority: 'medium', credits: 18 },
    ],
    'real-estate': [
      { title: 'Closed 18 Westwood — under contract', description: 'AI coordinated tours + offers.', priority: 'high', credits: 30 },
      { title: 'Sent 31 post-close nurture emails this week', description: '30/60/90-day touchpoints automated.', priority: 'low', credits: 20 },
      { title: 'Qualified 12 inbound buyer leads', description: 'AI Lead Capture pre-qualified before agent touch.', priority: 'medium', credits: 16 },
    ],
    mortgage: [
      { title: 'Funded 6 loans this month', description: 'Pipeline tracked end-to-end by AI.', priority: 'high', credits: 38 },
      { title: 'Sent rate quotes to 22 borrowers', description: 'Personalized comparison across 4 lenders.', priority: 'medium', credits: 24 },
      { title: 'Cleared underwriting conditions for #4377', description: '14 docs collected + verified.', priority: 'medium', credits: 18 },
    ],
    cpa: [
      { title: 'Filed extensions for 9 clients', description: 'Reminders auto-sent + tracked.', priority: 'high', credits: 24 },
      { title: 'Closed monthly books for 11 clients', description: 'Auto-categorized + reviewed.', priority: 'medium', credits: 30 },
      { title: 'Sent payroll compliance reminders to 24 clients', description: 'Quarter-end deadline tracker.', priority: 'medium', credits: 16 },
    ],
    'marketing-agency': [
      { title: 'Launched Orion paid social campaign', description: '12 ad variants generated + scheduled.', priority: 'high', credits: 32 },
      { title: 'Q1 client reports delivered (8 clients)', description: 'Auto-built performance decks.', priority: 'medium', credits: 28 },
      { title: 'Repurposed 4 long-form posts into 28 social posts', description: 'AI content strategist.', priority: 'low', credits: 18 },
    ],
    'law-firm': [
      { title: 'Closed 4 client intakes this week', description: 'Summaries + consultation booked.', priority: 'high', credits: 22 },
      { title: 'Sent matter status updates to 14 active clients', description: 'Weekly cadence automated.', priority: 'medium', credits: 18 },
      { title: 'Document collection complete for 3 matters', description: 'AI chased missing items.', priority: 'medium', credits: 16 },
    ],
  }
  return samples[id] ?? []
}

function sampleAttentionTaskFor(id: string): { title: string; description: string } {
  const samples: Record<string, { title: string; description: string }> = {
    pm: { title: '⚠ Tenant complaint at 142 Elm escalated — needs human review', description: 'AI flagged: tone analysis suggests legal-tier complaint. Approval needed before reply.' },
    gc: { title: '⚠ Edgewater bid: change-order conflict detected', description: 'AI Estimator flagged a $4.2k scope overlap between two subs. Review before sending.' },
    'home-services': { title: '⚠ Emergency dispatch: gas leak reported, no tech in 5-mile radius', description: 'AI Dispatcher escalated. Manual override required.' },
    'ai-agency': { title: '⚠ Client Bravo: quality score dipped 14% this week', description: 'AI QA Reviewer flagged 3 sessions for human review.' },
    'real-estate': { title: '⚠ Offer on 18 Westwood: counter-offer terms unclear', description: 'AI Transaction Coordinator wants human approval before responding to listing agent.' },
    mortgage: { title: '⚠ Borrower #4421: appraisal came in $14k under contract', description: 'AI flagged. Loan officer needs to call borrower before automated email goes out.' },
    cpa: { title: '⚠ Client #88 — 1099 reconciliation discrepancy ($3,200)', description: 'AI flagged. Needs partner review before filing.' },
    'marketing-agency': { title: '⚠ Client Orion ad blocked by platform policy', description: 'AI Campaign Assistant flagged. Needs creative revision.' },
    'law-firm': { title: '⚠ New intake: potential conflict of interest detected', description: 'AI flagged via similar-matter check. Attorney must clear before consult.' },
  }
  return samples[id] ?? { title: '⚠ Item needs human review', description: 'AI flagged this item for approval.' }
}

function main(): void {
  const arg = process.argv[2]
  const targets =
    arg === '--all' || !arg ? BUSINESS_TEMPLATES.map((t) => t.id) : [arg]
  const results: SeedResult[] = []
  for (const id of targets) {
    try {
      results.push(seedTemplate(id))
    } catch (err) {
      console.error(`Failed to seed ${id}:`, err)
    }
  }
  console.log('\nDemo seed complete:')
  for (const r of results) {
    console.log(
      `  ${r.templateId.padEnd(18)}  ws#${r.workspaceId.toString().padStart(2)}  ` +
        `${r.aiEmployees} employees · ${r.skills} skills · ${r.workflows} workflows · ` +
        `${r.tasks} tasks · ${r.creditsGranted}→${r.creditsGranted - r.creditsUsed} credits · ${r.attentionItems} attention`,
    )
  }
  process.exit(0)
}

main()
