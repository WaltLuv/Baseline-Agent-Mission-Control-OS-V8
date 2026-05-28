import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { getWorkspaceBalance } from '@/lib/billing'
import { recentObsidianCitations } from '@/lib/baseline-os/obsidian-ingest'

/**
 * Executive Morning Briefing — real-data endpoint.
 *
 * Aggregates today's workforce activity into the shape the
 * <ExecutiveBriefing /> component renders when demo mode is OFF.
 *
 * Returns:
 *   - briefingHeadline   one-line operator headline
 *   - dailyWins[]        wins today (recent done tasks)
 *   - attentionItems[]   things waiting on the operator (blocked/needs review)
 *   - valueCreatedMonthUsd / hoursSavedMonth   labor-value rollup
 *   - topEmployee        the AI employee that has done the most this week
 *   - nextAction         a single CTA
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const workspaceId = auth.user.workspace_id ?? 1
  const db = getDatabase()

  // --- Daily wins: tasks completed in the last 24h ---
  const dayAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60
  const monthAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60

  let dailyWins: { title: string; impact: string; valueUsd: number }[] = []
  try {
    const completed = db.prepare(
      `SELECT id, title, COALESCE(updated_at, created_at) as ts
       FROM tasks
       WHERE status = 'done' AND COALESCE(updated_at, created_at) >= ?
       ORDER BY ts DESC LIMIT 3`
    ).all(dayAgo) as { id: number; title: string; ts: number }[]
    dailyWins = completed.map((t) => ({
      title: t.title || `Task #${t.id} completed`,
      impact: 'Done in the last 24h',
      valueUsd: 75,
    }))
  } catch {
    // tasks table not present in some forks
  }

  // --- Attention items: blocked or approval-needed tasks ---
  let attentionItems: { title: string; severity: 'low' | 'medium' | 'high'; reason: string }[] = []
  try {
    const blocked = db.prepare(
      `SELECT id, title, status FROM tasks
       WHERE status IN ('blocked','review','needs_approval')
       ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 4`
    ).all() as { id: number; title: string; status: string }[]
    attentionItems = blocked.map((t) => ({
      title: t.title || `Task #${t.id}`,
      severity: t.status === 'blocked' ? 'high' : 'medium',
      reason:
        t.status === 'blocked'
          ? 'Blocked — needs your unblock decision.'
          : t.status === 'needs_approval'
          ? 'Waiting on your approval before it goes live.'
          : 'AI flagged for human review.',
    }))
  } catch {
    // ignore
  }

  // --- Workforce labor-value rollup (last 30 days) ---
  let creditsUsedMonth = 0
  let hoursSavedMonth = 0
  let valueCreatedMonthUsd = 0
  try {
    const usage = db.prepare(
      `SELECT COALESCE(SUM(credits_charged),0) as credits
       FROM usage_events
       WHERE workspace_id = ? AND created_at >= ?`
    ).get(workspaceId, monthAgo) as { credits: number }
    creditsUsedMonth = Math.round(Number(usage?.credits || 0))
    // Rough heuristic: 1 credit ≈ 5 minutes of manual work avoided ≈ $4 labor value at $48/hr.
    hoursSavedMonth = Math.round((creditsUsedMonth * 5) / 60)
    valueCreatedMonthUsd = Math.round(creditsUsedMonth * 4)
  } catch {
    // ignore
  }

  // --- Top AI employee this week (by usage events) ---
  let topEmployee: { name: string; impact: string } | null = null
  try {
    const row = db.prepare(
      `SELECT a.name as name, COUNT(*) as cnt
       FROM usage_events ue
       LEFT JOIN agents a ON ue.agent_id = a.id
       WHERE ue.workspace_id = ? AND ue.created_at >= ? AND a.name IS NOT NULL
       GROUP BY ue.agent_id
       ORDER BY cnt DESC LIMIT 1`
    ).get(workspaceId, weekAgo) as { name: string; cnt: number } | undefined
    if (row?.name) {
      topEmployee = {
        name: row.name,
        impact: `${row.cnt} actions completed this week.`,
      }
    }
  } catch {
    // ignore
  }
  if (!topEmployee) {
    try {
      const anyAgent = db.prepare(`SELECT name FROM agents ORDER BY id ASC LIMIT 1`).get() as
        | { name: string }
        | undefined
      if (anyAgent?.name) {
        topEmployee = { name: anyAgent.name, impact: 'Ready to take on more workload this week.' }
      }
    } catch {
      // ignore
    }
  }

  // --- Headline ---
  let briefingHeadline = 'Quiet morning. Workforce ready.'
  if (attentionItems.length > 0) {
    briefingHeadline = `${attentionItems.length} item${attentionItems.length === 1 ? '' : 's'} need your attention today.`
  } else if (dailyWins.length > 0) {
    briefingHeadline = `${dailyWins.length} win${dailyWins.length === 1 ? '' : 's'} closed in the last 24 hours.`
  }

  // --- Next action ---
  const nextAction =
    attentionItems.length > 0
      ? { label: 'Review attention items', href: '/app/tasks' }
      : dailyWins.length > 0
      ? { label: 'Review today\u2019s wins', href: '/app/activity' }
      : { label: 'Hire your next AI employee', href: '/marketplace' }

  // --- Balance / fuel info ---
  let balance: { balance: number; granted: number; used: number; refunded: number } | null = null
  try {
    balance = getWorkspaceBalance(workspaceId)
  } catch {
    balance = null
  }

  // --- Workforce utilization v2 — highest-ROI vs most-overloaded employees ---
  let highestRoiEmployee: { name: string; impact: string } | null = null
  let overloadedEmployee: { name: string; impact: string } | null = null
  let blockedAwaitingApprovalCount = 0
  try {
    const monthAgoTs = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
    const usageByAgent = db.prepare(
      `SELECT a.name as name, COUNT(*) as cnt, COALESCE(SUM(ue.retail_cost_cents),0) as cost_cents
       FROM usage_events ue
       LEFT JOIN agents a ON ue.agent_id = a.id
       WHERE ue.workspace_id = ? AND ue.created_at >= ? AND a.name IS NOT NULL
       GROUP BY ue.agent_id
       ORDER BY cnt DESC LIMIT 5`,
    ).all(workspaceId, monthAgoTs) as { name: string; cnt: number; cost_cents: number }[]
    if (usageByAgent.length > 0) {
      // Highest ROI = most actions for lowest cost-per-action.
      const ranked = usageByAgent
        .filter((r) => r.cnt > 0)
        .map((r) => ({ ...r, cpa: r.cost_cents / r.cnt }))
      const cheapest = [...ranked].sort((a, b) => a.cpa - b.cpa)[0]
      const busiest = [...ranked].sort((a, b) => b.cnt - a.cnt)[0]
      if (cheapest) {
        highestRoiEmployee = {
          name: cheapest.name,
          impact: `${cheapest.cnt} actions at ~$${(cheapest.cpa / 100).toFixed(2)}/action — best ROI this month.`,
        }
      }
      if (busiest && busiest.name !== cheapest?.name) {
        overloadedEmployee = {
          name: busiest.name,
          impact: `${busiest.cnt} actions this month — consider hiring a peer or reroute work.`,
        }
      }
    }
  } catch {
    // ignore
  }
  try {
    const row = db.prepare(
      `SELECT COUNT(*) as c FROM tasks WHERE status IN ('needs_approval','review')`
    ).get() as { c: number } | undefined
    blockedAwaitingApprovalCount = Number(row?.c ?? 0)
  } catch {
    // ignore
  }

  // --- Obsidian operator-memory citations (Layer 1 / Baseline OS) ---
  // If the operator has Obsidian connected and there are notes touched in
  // the last ~48h, the briefing prefaces its headline with the literal
  // "Based on your operator notes from yesterday…" line and surfaces up to
  // 3 citations the operator can click through to in the Memory Feed.
  let memoryCitations: Array<{ id: number; title: string; rationale: string | null; createdAt: number }> = []
  try {
    const rows = recentObsidianCitations(db, workspaceId, 48 * 60 * 60, 3)
    memoryCitations = rows.map((r) => ({
      id: r.id,
      title: r.title,
      rationale: r.rationale,
      createdAt: r.created_at,
    }))
  } catch {
    memoryCitations = []
  }
  if (memoryCitations.length > 0) {
    briefingHeadline = `Based on your operator notes from yesterday — ${briefingHeadline}`
  }

  return NextResponse.json({
    mode: 'live',
    briefingHeadline,
    dailyWins,
    attentionItems,
    creditsUsedMonth,
    hoursSavedMonth,
    valueCreatedMonthUsd,
    topEmployee,
    highestRoiEmployee,
    overloadedEmployee,
    blockedAwaitingApprovalCount,
    nextAction,
    balance,
    memoryCitations,
  })
}
