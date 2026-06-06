/**
 * Regression spec for the onboarding setup checklist's RUNTIME predicate.
 *
 * Walt's P0-2/P0-3 onboarding audit found the headline bug: the dashboard
 * setup checklist could never reach 100% because the "Runtime connected"
 * required row (20% of the bar) was derived from SQL that queried
 * `runtimes` / `runtime_handshakes` / `runtime_telemetry` — tables that do
 * not exist in this database. The real runtime handshake writes to
 * `runtime_registry`. This test pins the contract that a registered runtime
 * (via the same registerHandshake() the live handshake endpoint uses) makes
 * the runtime row tick.
 */
import { describe, it, expect, beforeAll } from 'vitest'

import { GET as checklistGET } from '@/app/api/help/checklist/route'
import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { registerHandshake } from '@/lib/baseline-os/runtime-registry'

interface ChecklistRow {
  id: string
  done: boolean
  tier: 'required' | 'optional'
}
interface ChecklistResponse {
  items: ChecklistRow[]
  percent: number
}

async function readChecklist(): Promise<ChecklistResponse> {
  const res = await checklistGET()
  expect(res.status).toBe(200)
  return (await res.json()) as ChecklistResponse
}

describe('GET /api/help/checklist — runtime predicate', () => {
  beforeAll(() => {
    runMigrations(getDatabase())
  })

  it('the runtime row is satisfied by a runtime_registry handshake (not the legacy table names)', async () => {
    const before = await readChecklist()
    const runtimeBefore = before.items.find((i) => i.id === 'runtime')
    expect(runtimeBefore).toBeDefined()
    expect(runtimeBefore!.tier).toBe('required')

    // Register a runtime exactly as the live handshake endpoint does.
    registerHandshake(1, {
      kind: 'claude',
      installationId: 'checklist-test-rt',
      label: 'Checklist Test Runtime',
      version: '1.0.0',
      capabilities: ['runtime'],
    })

    const after = await readChecklist()
    const runtimeAfter = after.items.find((i) => i.id === 'runtime')
    expect(runtimeAfter!.done).toBe(true)
  })

  it('a registered runtime lifts the percent above the 80% cap that blocked 100%', async () => {
    const db = getDatabase()
    const ts = Math.floor(Date.now() / 1000)
    const uniq = `${ts}-${Math.floor(Math.random() * 1e6)}`

    // Satisfy the other four required predicates so the only variable is the
    // runtime row. (users already exist from migrations/other tests; ensure
    // template + credentials/credits + a task are present.)
    db.prepare(
      `INSERT INTO agents (name, role, status, soul_content, created_at, updated_at, workspace_id, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(`Checklist Persona ${uniq}`, 'AI Employee', 'offline', '', ts, ts, 1, 'workforce-template:property-management')

    db.prepare(`INSERT INTO tasks (title, status, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(
      'Checklist starter task',
      'inbox',
      ts,
      ts,
    )

    // Credits via the ledger (positive balance satisfies credentialsOrCredits).
    try {
      db.prepare(`INSERT INTO credit_ledger (amount, created_at) VALUES (?, ?)`).run(1000, ts)
    } catch {
      // If the ledger schema differs, fall back to a saved credential preview.
      try {
        db.prepare(
          `INSERT INTO workspace_credentials (workspace_id, provider_id, secret_preview, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(1, 'openrouter', 'sk-...abcd', 'connected', ts, ts)
      } catch {
        /* one of the two will exist; the assertion below tolerates either */
      }
    }

    registerHandshake(1, {
      kind: 'hermes',
      installationId: 'checklist-test-rt-2',
      label: 'Checklist Test Runtime 2',
      version: '1.0.0',
      capabilities: ['runtime'],
    })

    const after = await readChecklist()
    // With a registered runtime, the required runtime row must be done, and the
    // bar must be able to exceed the old 80% ceiling.
    const runtimeAfter = after.items.find((i) => i.id === 'runtime')
    expect(runtimeAfter!.done).toBe(true)
    expect(after.percent).toBeGreaterThan(80)
  })
})
