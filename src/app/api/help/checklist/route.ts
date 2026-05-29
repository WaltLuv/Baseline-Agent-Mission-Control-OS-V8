/**
 * /api/help/checklist
 *
 * Returns the setup checklist derived from real workspace state.
 * No fake ticks: each line is satisfied only when the underlying entity exists.
 */
import { NextResponse } from 'next/server'
import { deriveChecklist, type ChecklistInput } from '@/lib/help/checklist'
import { getDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function count(sql: string): number {
  try {
    const db = getDatabase()
    const row = db.prepare(sql).get() as { c?: number } | undefined
    return Number(row?.c ?? 0)
  } catch {
    return 0
  }
}

function tableExists(name: string): boolean {
  try {
    const db = getDatabase()
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
      .get(name)
    return !!row
  } catch {
    return false
  }
}

export async function GET() {
  const input: ChecklistInput = {
    workspaceConfigured: tableExists('users') && count('SELECT COUNT(*) AS c FROM users') > 0,
    templateSelected: tableExists('settings')
      ? count("SELECT COUNT(*) AS c FROM settings WHERE key = 'business.template'") > 0
      : false,
    agentCount: tableExists('agents') ? count('SELECT COUNT(*) AS c FROM agents') : 0,
    installedSkillsCount: tableExists('skills') ? count('SELECT COUNT(*) AS c FROM skills') : 0,
    memorySourcesCount: (() => {
      // Count distinct memory sources by inspecting integrations / connected memory.
      let c = 0
      if (tableExists('integrations')) {
        c += count(
          "SELECT COUNT(*) AS c FROM integrations WHERE name IN ('notion','obsidian','pinecone') AND status = 'connected'"
        )
      }
      if (tableExists('memory_files')) {
        c += count('SELECT COUNT(DISTINCT path) AS c FROM memory_files') > 0 ? 1 : 0
      }
      return c
    })(),
    runtimesConnectedCount: (() => {
      let c = 0
      if (tableExists('runtime_handshakes')) {
        c += count('SELECT COUNT(DISTINCT runtime) AS c FROM runtime_handshakes')
      } else if (tableExists('runtime_telemetry')) {
        c += count('SELECT COUNT(DISTINCT runtime) AS c FROM runtime_telemetry')
      }
      return c
    })(),
    billingConfigured: tableExists('settings')
      ? count("SELECT COUNT(*) AS c FROM settings WHERE key LIKE 'billing.%'") > 0
      : false,
    taskCount: tableExists('tasks') ? count('SELECT COUNT(*) AS c FROM tasks') : 0,
    approvalsReviewedCount: tableExists('exec_approvals')
      ? count("SELECT COUNT(*) AS c FROM exec_approvals WHERE status IN ('approved','rejected','changes_requested')")
      : 0,
    briefingGenerated: tableExists('briefings') ? count('SELECT COUNT(*) AS c FROM briefings') > 0 : false,
    trackedSkillRoiCount: tableExists('skill_events')
      ? count('SELECT COUNT(DISTINCT skill_id) AS c FROM skill_events')
      : 0,
  }

  const items = deriveChecklist(input)
  const done = items.filter((i) => i.done).length
  return NextResponse.json({
    items,
    total: items.length,
    completed: done,
    percent: items.length === 0 ? 0 : Math.round((done / items.length) * 100),
  })
}
