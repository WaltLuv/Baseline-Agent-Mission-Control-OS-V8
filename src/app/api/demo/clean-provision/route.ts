/**
 * POST /api/demo/clean-provision → make this workspace identical to a brand-new
 * signup's PM demo, even if it accumulated junk (e.g. an old workspace polluted
 * by test runs / placeholder agents).
 *
 * Safe + reversible:
 *   1. SNAPSHOT the workspace's demo-relevant tables to a JSON recovery file
 *      under <dataDir>/snapshots/ before touching anything.
 *   2. CLEAN: remove workforce-template agents, clear the install flags + demo
 *      data + seeded performance, so the re-install creates the canonical named
 *      personas (not stale placeholders).
 *   3. PROVISION the first-run PM demo (named workforce + live scenarios +
 *      Star-Employee performance) — exactly what a new signup gets.
 *
 * admin-only. Workspace-scoped.
 */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { requireRole } from '@/lib/auth'
import { getDatabase, logAuditEvent } from '@/lib/db'
import { config, ensureDirExists } from '@/lib/config'
import { clearDemo, demoStatus } from '@/lib/pm/demo-seed'
import { provisionFirstRunDemo } from '@/lib/pm/first-run-demo'

export const dynamic = 'force-dynamic'

const SNAPSHOT_TABLES = [
  'agents',
  'work_orders',
  'owner_approvals',
  'comms_log',
  'mission_replays',
  'agent_trust_scores',
  'tasks',
]

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const ws = auth.user.workspace_id ?? 1
  const db = getDatabase()

  // 1. SNAPSHOT (recovery path) ------------------------------------------------
  const snapshot: Record<string, unknown[]> = {}
  for (const t of SNAPSHOT_TABLES) {
    try {
      snapshot[t] = db.prepare(`SELECT * FROM ${t} WHERE workspace_id = ?`).all(ws)
    } catch {
      snapshot[t] = [] // table may not exist in this schema version
    }
  }
  const snapDir = path.join(config.dataDir, 'snapshots')
  ensureDirExists(snapDir)
  const snapFile = path.join(snapDir, `ws-${ws}-${Date.now()}.json`)
  fs.writeFileSync(snapFile, JSON.stringify({ workspace_id: ws, takenAt: Date.now(), tables: snapshot }, null, 2), { mode: 0o600 })

  // 2. CLEAN -------------------------------------------------------------------
  const deletedAgents = db
    .prepare(`DELETE FROM agents WHERE workspace_id = ? AND source LIKE 'workforce-template:%'`)
    .run(ws).changes
  const clearedFlags = db
    .prepare(`DELETE FROM settings WHERE key LIKE ?`)
    .run(`ws.${ws}.workforce.%`).changes
  try { db.prepare(`DELETE FROM agent_trust_scores WHERE workspace_id = ?`).run(ws) } catch { /* table optional */ }
  clearDemo(ws)

  // 3. PROVISION ---------------------------------------------------------------
  const provisioned = await provisionFirstRunDemo(ws, auth.user.username)

  logAuditEvent({
    action: 'demo_clean_provision',
    actor: auth.user.username,
    actor_id: auth.user.id,
    detail: { workspace_id: ws, snapshot: snapFile, deletedAgents, clearedFlags, provisioned },
  })

  return NextResponse.json({
    ok: true,
    workspace_id: ws,
    snapshot: snapFile,
    cleaned: { deletedAgents, clearedFlags },
    provisioned,
    status: demoStatus(ws),
  })
}
