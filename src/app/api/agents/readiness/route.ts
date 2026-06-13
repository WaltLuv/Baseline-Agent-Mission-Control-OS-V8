/**
 * GET /api/agents/readiness — execution readiness for the workspace's agents.
 *
 * Returns, for each agent (+ the canonical AI-systems runtime agents), its
 * execution level, assigned runtime, runtime status, tools, permissions,
 * approval rules, and readiness status — computed from the capability matrix.
 * No fake green states. viewer+.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { computeCapabilityMatrix } from '@/lib/workspace/capability-matrix'
import { agentReadiness, EXECUTION_PROFILES } from '@/lib/agents/execution-model'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1

  const cutoff = Math.floor(Date.now() / 1000) - 120
  let flightDeckOnline = false
  try {
    const r = getDatabase().prepare(`SELECT COUNT(*) n FROM paired_devices WHERE workspace_id = ? AND status='paired' AND last_seen_at >= ?`).get(ws, cutoff) as { n: number } | undefined
    flightDeckOnline = (r?.n ?? 0) > 0
  } catch { /* table optional */ }

  const matrix = computeCapabilityMatrix(ws, { flightDeckOnline })

  let agents: Array<{ id: number; name: string; role: string }> = []
  try {
    agents = getDatabase()
      .prepare(`SELECT id, name, role FROM agents WHERE workspace_id = ? ORDER BY name LIMIT 200`)
      .all(ws) as Array<{ id: number; name: string; role: string }>
  } catch { /* table optional */ }

  const roster = agents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    readiness: agentReadiness({ id: String(a.id), name: a.name, role: a.role }, matrix),
  }))

  // Canonical reference agents (so the architecture is visible even on an
  // empty workspace) — one per profile key.
  const reference = EXECUTION_PROFILES.map((p) => ({
    key: p.key,
    name: p.key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: p.description,
    readiness: agentReadiness({ name: p.key }, matrix),
  }))

  return NextResponse.json({ workspace_id: ws, roster, reference })
}
