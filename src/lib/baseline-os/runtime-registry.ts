/**
 * Unified Runtime Registry
 *
 * Mission Control treats Hermes, OpenClaw, Open Code, Codex, and Claude
 * Code as **equal first-class native execution engines** ("Triple Threat"
 * stack plus the two adjacent reasoning runtimes). Every runtime calls
 * `POST /api/runtime/handshake` at boot to register itself, then
 * `POST /api/runtime/heartbeat` periodically.
 *
 * The registry is **workspace-scoped**. A workspace can have any number
 * of runtimes connected. The Workforce Health surface reads from
 * `runtimeRegistrySnapshot()`.
 *
 * Customer-facing label rules (no runtime jargon leakage):
 *   - operator-mode UI says: "AI Employee completed work."
 *   - admin/developer mode shows: "executed by Hermes / OpenClaw / …"
 *
 * Schema is additive — uses an existing SQLite DB. No new database, no
 * destructive migrations.
 */
import type { Database } from 'better-sqlite3'
import { getDatabase } from '@/lib/db'

export type RuntimeKind = 'hermes' | 'openclaw' | 'opencode' | 'codex' | 'claude-code' | 'other'

export interface RuntimeRecord {
  id: number
  workspaceId: number
  kind: RuntimeKind
  /** Stable installation id chosen by the runtime (e.g. host + uuid). */
  installationId: string
  /** Friendly label the runtime advertises ("Hermes 2.3 / mac-mini-01"). */
  label: string
  version: string | null
  capabilities: string[]
  registeredAt: number
  lastSeenAt: number
  lastTaskCount: number
  health: 'green' | 'amber' | 'red'
}

const VALID_KINDS = new Set<RuntimeKind>(['hermes', 'openclaw', 'opencode', 'codex', 'claude-code', 'other'])

function ensureTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runtime_registry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      installation_id TEXT NOT NULL,
      label TEXT NOT NULL,
      version TEXT,
      capabilities TEXT,
      registered_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      last_task_count INTEGER NOT NULL DEFAULT 0,
      health TEXT NOT NULL DEFAULT 'green',
      UNIQUE(workspace_id, kind, installation_id)
    );
    CREATE INDEX IF NOT EXISTS idx_runtime_registry_workspace
      ON runtime_registry(workspace_id, kind, last_seen_at DESC);
  `)
}

export interface HandshakeInput {
  kind: string
  installationId: string
  label?: string
  version?: string | null
  capabilities?: string[]
}

/**
 * Idempotent: same (workspace, kind, installationId) updates the existing
 * row rather than creating duplicates.
 */
export function registerHandshake(workspaceId: number, input: HandshakeInput): RuntimeRecord {
  const db = getDatabase()
  ensureTable(db)
  const kind: RuntimeKind = VALID_KINDS.has(input.kind as RuntimeKind) ? (input.kind as RuntimeKind) : 'other'
  const now = Math.floor(Date.now() / 1000)
  const label = (input.label || `${kind} runtime`).slice(0, 80)
  const version = (input.version || null) as string | null
  const caps = JSON.stringify(input.capabilities ?? [])

  db.prepare(
    `INSERT INTO runtime_registry (workspace_id, kind, installation_id, label, version, capabilities, registered_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (workspace_id, kind, installation_id) DO UPDATE SET
       label = excluded.label,
       version = excluded.version,
       capabilities = excluded.capabilities,
       last_seen_at = excluded.last_seen_at,
       health = 'green'`,
  ).run(workspaceId, kind, input.installationId.slice(0, 120), label, version, caps, now, now)

  return getRuntime(workspaceId, kind, input.installationId)!
}

export interface HeartbeatInput {
  kind: string
  installationId: string
  taskCount?: number
  health?: 'green' | 'amber' | 'red'
}

export function recordHeartbeat(workspaceId: number, input: HeartbeatInput): RuntimeRecord | null {
  const db = getDatabase()
  ensureTable(db)
  const kind: RuntimeKind = VALID_KINDS.has(input.kind as RuntimeKind) ? (input.kind as RuntimeKind) : 'other'
  const now = Math.floor(Date.now() / 1000)
  const taskCount = Math.max(0, Math.floor(input.taskCount ?? 0))
  const health = input.health ?? 'green'
  db.prepare(
    `UPDATE runtime_registry
       SET last_seen_at = ?, last_task_count = ?, health = ?
     WHERE workspace_id = ? AND kind = ? AND installation_id = ?`,
  ).run(now, taskCount, health, workspaceId, kind, input.installationId)
  return getRuntime(workspaceId, kind, input.installationId)
}

export function getRuntime(workspaceId: number, kind: RuntimeKind, installationId: string): RuntimeRecord | null {
  const db = getDatabase()
  ensureTable(db)
  const row = db
    .prepare(
      `SELECT id, workspace_id, kind, installation_id, label, version, capabilities,
              registered_at, last_seen_at, last_task_count, health
       FROM runtime_registry
       WHERE workspace_id = ? AND kind = ? AND installation_id = ?`,
    )
    .get(workspaceId, kind, installationId) as
    | {
        id: number
        workspace_id: number
        kind: RuntimeKind
        installation_id: string
        label: string
        version: string | null
        capabilities: string | null
        registered_at: number
        last_seen_at: number
        last_task_count: number
        health: 'green' | 'amber' | 'red'
      }
    | undefined
  if (!row) return null
  return toRecord(row)
}

/**
 * The single source of truth read by Workforce Health.
 *
 * Auto-degrades health to 'amber' (>120s since last_seen) or 'red'
 * (>300s) without writing back to the database — non-mutating snapshot.
 */
export function runtimeRegistrySnapshot(workspaceId: number): RuntimeRecord[] {
  const db = getDatabase()
  ensureTable(db)
  const rows = db
    .prepare(
      `SELECT id, workspace_id, kind, installation_id, label, version, capabilities,
              registered_at, last_seen_at, last_task_count, health
       FROM runtime_registry
       WHERE workspace_id = ?
       ORDER BY kind, last_seen_at DESC`,
    )
    .all(workspaceId) as Array<{
    id: number
    workspace_id: number
    kind: RuntimeKind
    installation_id: string
    label: string
    version: string | null
    capabilities: string | null
    registered_at: number
    last_seen_at: number
    last_task_count: number
    health: 'green' | 'amber' | 'red'
  }>

  const now = Math.floor(Date.now() / 1000)
  return rows.map((r) => {
    const rec = toRecord(r)
    const age = now - r.last_seen_at
    if (age > 300 && rec.health !== 'red') rec.health = 'red'
    else if (age > 120 && rec.health === 'green') rec.health = 'amber'
    return rec
  })
}

function toRecord(row: {
  id: number
  workspace_id: number
  kind: RuntimeKind
  installation_id: string
  label: string
  version: string | null
  capabilities: string | null
  registered_at: number
  last_seen_at: number
  last_task_count: number
  health: 'green' | 'amber' | 'red'
}): RuntimeRecord {
  let caps: string[] = []
  try {
    caps = JSON.parse(row.capabilities ?? '[]') as string[]
    if (!Array.isArray(caps)) caps = []
  } catch {
    caps = []
  }
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    kind: row.kind,
    installationId: row.installation_id,
    label: row.label,
    version: row.version,
    capabilities: caps,
    registeredAt: row.registered_at,
    lastSeenAt: row.last_seen_at,
    lastTaskCount: row.last_task_count,
    health: row.health,
  }
}

/** Friendly customer-facing label set (operator mode never sees the slug). */
export const RUNTIME_LABEL: Record<RuntimeKind, string> = {
  hermes: 'Hermes',
  openclaw: 'OpenClaw',
  opencode: 'Open Code',
  codex: 'Codex',
  'claude-code': 'Claude Code',
  other: 'Runtime',
}
