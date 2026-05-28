import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'

/**
 * Baseline OS — Workforce Health Score v2
 *
 * Mission Control DISPLAYS this score; Baseline OS COMPUTES it. This route
 * is the boundary: it reads the operational facts from SQLite and projects
 * them into 8 sub-dimensions that operators can act on.
 *
 * Sub-dimensions returned:
 *   - executionHealth         "are tasks actually closing?"
 *   - responsiveness          "are AI employees acting on heartbeats?"
 *   - workloadBalance         "is work spread sensibly across the team?"
 *   - costEfficiency          "are credits buying outcomes vs spinning?"
 *   - quality                 "are approvals/needs-review piling up?"
 *   - memoryContinuity        "is the memory feed accumulating?"
 *   - automationReliability   "is the workforce humming or erroring?"
 *   - customerExperience      "are blocked / SLA items low?"
 *
 * Every dimension returns:
 *   { score: 0-100, trend: 'up'|'flat'|'down', whyChanged: string, fix?: string }
 *
 * This is the "Why this matters" intelligence the user demanded — every
 * dimension has a human-readable cause and a recommended action.
 */

interface Dimension {
  key: string
  label: string
  score: number
  trend: 'up' | 'flat' | 'down'
  whyChanged: string
  fix?: string
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  const db = getDatabase()
  const now = Math.floor(Date.now() / 1000)
  const weekAgo = now - 7 * 24 * 60 * 60
  const monthAgo = now - 30 * 24 * 60 * 60

  // --- Inputs ---
  let totalUsage = 0
  let errorEvents = 0
  let avgCostCents = 0
  let agentCount = 0
  let activeAgents = 0
  let blockedTasks = 0
  let closedTasks = 0
  let approvalQueue = 0
  let memoryEntries = 0
  let usagePerAgent: number[] = []

  try {
    const ws = workspaceId
    const u = db.prepare(`SELECT COUNT(*) c, AVG(retail_cost_cents) avg_c FROM usage_events WHERE workspace_id=? AND created_at>=?`).get(ws, monthAgo) as { c: number; avg_c: number }
    totalUsage = Number(u?.c || 0)
    avgCostCents = Number(u?.avg_c || 0)
    const err = db.prepare(`SELECT COUNT(*) c FROM usage_events WHERE workspace_id=? AND created_at>=? AND event_type LIKE '%error%'`).get(ws, monthAgo) as { c: number }
    errorEvents = Number(err?.c || 0)
    const ag = db.prepare(`SELECT COUNT(*) c FROM agents WHERE workspace_id=?`).get(ws) as { c: number }
    agentCount = Number(ag?.c || 0)
    const act = db.prepare(`SELECT COUNT(DISTINCT agent_id) c FROM usage_events WHERE workspace_id=? AND created_at>=? AND agent_id IS NOT NULL`).get(ws, weekAgo) as { c: number }
    activeAgents = Number(act?.c || 0)
    const rows = db.prepare(`SELECT COUNT(*) c FROM usage_events WHERE workspace_id=? AND created_at>=? AND agent_id IS NOT NULL GROUP BY agent_id`).all(ws, monthAgo) as { c: number }[]
    usagePerAgent = rows.map((r) => Number(r.c))
  } catch {}
  try {
    blockedTasks = Number((db.prepare(`SELECT COUNT(*) c FROM tasks WHERE status IN ('blocked')`).get() as { c: number } | undefined)?.c || 0)
    closedTasks = Number((db.prepare(`SELECT COUNT(*) c FROM tasks WHERE status='done'`).get() as { c: number } | undefined)?.c || 0)
    approvalQueue = Number((db.prepare(`SELECT COUNT(*) c FROM tasks WHERE status IN ('needs_approval','review')`).get() as { c: number } | undefined)?.c || 0)
  } catch {}
  try {
    memoryEntries = Number((db.prepare(`SELECT COUNT(*) c FROM workforce_memory WHERE workspace_id=?`).get(workspaceId) as { c: number } | undefined)?.c || 0)
  } catch {}

  // --- Project into 8 dimensions ---
  const execScore = clamp(closedTasks + blockedTasks === 0 ? 75 : (closedTasks / Math.max(1, closedTasks + blockedTasks)) * 100)
  const respScore = clamp(agentCount === 0 ? 60 : (activeAgents / Math.max(1, agentCount)) * 100)
  // workload balance — coefficient of variation across agent usage. Lower CV = better balance.
  let workloadScore = 80
  if (usagePerAgent.length > 1) {
    const mean = usagePerAgent.reduce((a, b) => a + b, 0) / usagePerAgent.length
    const variance = usagePerAgent.reduce((a, b) => a + (b - mean) ** 2, 0) / usagePerAgent.length
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0
    workloadScore = clamp(100 - cv * 35)
  }
  // cost efficiency — cheaper average cost-per-action is better
  const costScore = clamp(avgCostCents > 0 ? 100 - Math.min(60, avgCostCents / 5) : 80)
  const qualityScore = clamp(100 - approvalQueue * 8)
  const memoryScore = clamp(Math.min(100, memoryEntries * 8 + 40))
  const reliabilityScore = clamp(totalUsage === 0 ? 70 : 100 - (errorEvents / Math.max(1, totalUsage)) * 100)
  const cxScore = clamp(100 - blockedTasks * 12)

  const dimensions: Dimension[] = [
    {
      key: 'execution-health',
      label: 'Execution health',
      score: execScore,
      trend: execScore >= 75 ? 'up' : execScore >= 50 ? 'flat' : 'down',
      whyChanged:
        execScore >= 75
          ? `${closedTasks} tasks closed cleanly — the workforce is finishing what it starts.`
          : `${blockedTasks} blocked / ${closedTasks} done — too many tasks are stalling.`,
      fix: execScore < 75 ? 'Open the Approvals panel and unblock the oldest items.' : undefined,
    },
    {
      key: 'responsiveness',
      label: 'Responsiveness',
      score: respScore,
      trend: respScore >= 75 ? 'up' : respScore >= 50 ? 'flat' : 'down',
      whyChanged:
        agentCount === 0
          ? 'No AI employees on staff yet.'
          : `${activeAgents} of ${agentCount} AI employees acted in the last 7 days.`,
      fix: respScore < 60 ? 'Several employees are idle. Consider reassigning their workload or letting them go.' : undefined,
    },
    {
      key: 'workload-balance',
      label: 'Workload balance',
      score: workloadScore,
      trend: workloadScore >= 70 ? 'up' : workloadScore >= 50 ? 'flat' : 'down',
      whyChanged:
        usagePerAgent.length <= 1
          ? 'Only one active employee — balance is undefined.'
          : workloadScore >= 70
          ? 'Work is spread reasonably across employees.'
          : 'A few employees are doing most of the work.',
      fix: workloadScore < 60 ? 'Hire a peer for your busiest employee or rebalance their queue.' : undefined,
    },
    {
      key: 'cost-efficiency',
      label: 'Cost efficiency',
      score: costScore,
      trend: costScore >= 75 ? 'up' : costScore >= 50 ? 'flat' : 'down',
      whyChanged: `Average cost per action is ~$${(avgCostCents / 100).toFixed(3)}.`,
      fix: costScore < 60 ? 'Open Daily Optimization to see model-substitution recommendations.' : undefined,
    },
    {
      key: 'quality',
      label: 'Quality',
      score: qualityScore,
      trend: qualityScore >= 75 ? 'up' : qualityScore >= 50 ? 'flat' : 'down',
      whyChanged:
        approvalQueue === 0
          ? 'No items waiting on human review — quality is consistent.'
          : `${approvalQueue} items waiting on you to approve before they ship.`,
      fix: approvalQueue > 3 ? 'Clear the Approvals queue to keep work moving.' : undefined,
    },
    {
      key: 'memory-continuity',
      label: 'Memory continuity',
      score: memoryScore,
      trend: memoryScore >= 75 ? 'up' : memoryScore >= 50 ? 'flat' : 'down',
      whyChanged:
        memoryEntries === 0
          ? 'No memory entries yet — the workforce has no longitudinal context to lean on.'
          : `${memoryEntries} memory entries — the workforce is building business context.`,
      fix: memoryEntries < 5 ? 'Connect Obsidian / Pinecone / Notion in Settings → Baseline OS Memory.' : undefined,
    },
    {
      key: 'automation-reliability',
      label: 'Automation reliability',
      score: reliabilityScore,
      trend: reliabilityScore >= 90 ? 'up' : reliabilityScore >= 75 ? 'flat' : 'down',
      whyChanged:
        errorEvents === 0
          ? 'Zero error events on usage — the workforce is humming.'
          : `${errorEvents} error events out of ${totalUsage} — investigate the failing model/employee.`,
      fix: reliabilityScore < 75 ? 'Open the Activity Feed and filter by errors.' : undefined,
    },
    {
      key: 'customer-experience',
      label: 'Customer experience',
      score: cxScore,
      trend: cxScore >= 75 ? 'up' : cxScore >= 50 ? 'flat' : 'down',
      whyChanged:
        blockedTasks === 0
          ? 'No customer-facing work is blocked.'
          : `${blockedTasks} blocked tasks may be impacting customer response time.`,
      fix: blockedTasks > 0 ? 'Unblock the oldest customer-facing items first.' : undefined,
    },
  ]

  const overall = clamp(
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length,
  )

  return NextResponse.json({
    overall,
    overallTrend: overall >= 80 ? 'up' : overall >= 60 ? 'flat' : 'down',
    headline:
      overall >= 80
        ? 'Workforce is healthy and ahead of pace.'
        : overall >= 60
        ? 'Workforce is steady — a few dimensions need attention.'
        : 'Workforce health is below threshold. Review the recommended fixes.',
    dimensions,
    computedAt: now,
    computedBy: 'baseline-os',
  })
}
