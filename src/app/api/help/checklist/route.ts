/**
 * /api/help/checklist
 *
 * Returns the setup checklist derived from real workspace state.
 * No fake ticks: each line is satisfied only when the underlying entity
 * exists. See lib/help/checklist.ts for the predicate model.
 */
import { NextResponse } from 'next/server'
import { completionPercent, deriveChecklist, nextStep, type ChecklistInput } from '@/lib/help/checklist'
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
  // Required predicates — each maps to ONE measurable condition.
  const workspaceConfigured = tableExists('users') && count('SELECT COUNT(*) AS c FROM users') > 0

  // Template "installed" — the install path creates agent rows with
  // source = 'workforce-template:<slug>'. Falling back to the older
  // settings key for legacy installs.
  const templateSelected = (() => {
    if (tableExists('agents') && count("SELECT COUNT(*) AS c FROM agents WHERE source LIKE 'workforce-template:%'") > 0) return true
    if (tableExists('settings') && count("SELECT COUNT(*) AS c FROM settings WHERE key = 'business.template'") > 0) return true
    return false
  })()

  // Credentials OR credits — either at least one credential row has a
  // secret_preview (i.e. it was actually saved with an encrypted value)
  // OR the workspace has a positive credit balance.
  const credentialsOrCreditsConfigured = (() => {
    if (tableExists('workspace_credentials') && count("SELECT COUNT(*) AS c FROM workspace_credentials WHERE secret_preview IS NOT NULL AND secret_preview != ''") > 0) return true
    if (tableExists('credit_ledger')) {
      const balanceRow = (() => {
        try {
          const db = getDatabase()
          return db
            .prepare(
              `SELECT COALESCE(SUM(amount), 0) AS bal FROM credit_ledger`,
            )
            .get() as { bal: number } | undefined
        } catch { return undefined }
      })()
      if (balanceRow && balanceRow.bal > 0) return true
    }
    return false
  })()

  const runtimesConnectedCount = (() => {
    // The runtime handshake (`POST /api/runtime/handshake` → registerHandshake)
    // writes to `runtime_registry`. That is the source of truth for "a runtime
    // connected." The older `runtimes` / `runtime_handshakes` /
    // `runtime_telemetry` names never existed in this database, so the previous
    // predicate was permanently 0 — which capped the setup bar at 80% and made
    // onboarding impossible to complete. Count `runtime_registry` first; keep
    // the legacy tables as fallbacks only if they ever appear.
    let c = 0
    if (tableExists('runtime_registry')) c += count('SELECT COUNT(*) AS c FROM runtime_registry')
    if (c === 0 && tableExists('runtimes')) c += count('SELECT COUNT(*) AS c FROM runtimes')
    if (c === 0 && tableExists('runtime_handshakes')) c += count('SELECT COUNT(DISTINCT runtime) AS c FROM runtime_handshakes')
    if (c === 0 && tableExists('runtime_telemetry')) c += count('SELECT COUNT(DISTINCT runtime) AS c FROM runtime_telemetry')
    return c
  })()

  const taskCount = (() => {
    let c = 0
    if (tableExists('tasks')) c += count('SELECT COUNT(*) AS c FROM tasks')
    if (tableExists('orchestration_tasks')) c += count('SELECT COUNT(*) AS c FROM orchestration_tasks')
    return c
  })()

  // Optional predicates — failure to measure → false (not surfaced as broken).
  const teamInvitedCount = tableExists('users') ? Math.max(0, count('SELECT COUNT(*) AS c FROM users') - 1) : 0
  const googleConnected = tableExists('workspace_credentials')
    ? count("SELECT COUNT(*) AS c FROM workspace_credentials WHERE provider_id IN ('gmail','google_drive','google_calendar','google_contacts') AND status = 'connected'") > 0
    : false
  const marketplacePurchasesCount = (() => {
    if (tableExists('workspace_marketplace_purchases')) return count('SELECT COUNT(*) AS c FROM workspace_marketplace_purchases')
    if (tableExists('marketplace_purchases')) return count('SELECT COUNT(*) AS c FROM marketplace_purchases')
    return 0
  })()
  const briefingGenerated = tableExists('briefings') ? count('SELECT COUNT(*) AS c FROM briefings') > 0 : false

  const input: ChecklistInput = {
    workspaceConfigured,
    templateSelected,
    credentialsOrCreditsConfigured,
    runtimesConnectedCount,
    taskCount,
    teamInvitedCount,
    googleConnected,
    marketplacePurchasesCount,
    briefingGenerated,
    // flightDeckInstalled: not measurable from the cloud DB; stays false
    // and the row appears as "not done" optional.
  }

  const items = deriveChecklist(input)
  const done = items.filter((i) => i.done).length
  const percent = completionPercent(items)
  const next = nextStep(items)
  return NextResponse.json({
    items,
    total: items.length,
    completed: done,
    percent,
    next_step: next,
  })
}
