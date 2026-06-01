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
  /** Phase 1 extended fields (additive — only present when the runtime sends them). */
  host?: string | null
  installedTools?: string[]
  installedSkills?: string[]
  healthScore?: number | null
  metadata?: Record<string, unknown> | null
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
  /** Phase 1 extended fields (Baseline OS sync layer). */
  host?: string | null
  installedTools?: string[]
  installedSkills?: string[]
  healthScore?: number | null
  capabilities?: string[]
  version?: string | null
  metadata?: Record<string, unknown> | null
}

export function recordHeartbeat(workspaceId: number, input: HeartbeatInput): RuntimeRecord | null {
  const db = getDatabase()
  ensureTable(db)
  const kind: RuntimeKind = VALID_KINDS.has(input.kind as RuntimeKind) ? (input.kind as RuntimeKind) : 'other'
  const now = Math.floor(Date.now() / 1000)
  const taskCount = Math.max(0, Math.floor(input.taskCount ?? 0))
  const health = input.health ?? 'green'

  // Build dynamic SET clause so we only touch columns the heartbeat actually sent.
  const sets = ['last_seen_at = ?', 'last_task_count = ?', 'health = ?']
  const params: unknown[] = [now, taskCount, health]
  if (input.host !== undefined) {
    sets.push('host = ?')
    params.push(input.host)
  }
  if (input.installedTools !== undefined) {
    sets.push('installed_tools = ?')
    params.push(JSON.stringify(input.installedTools ?? []))
  }
  if (input.installedSkills !== undefined) {
    sets.push('installed_skills = ?')
    params.push(JSON.stringify(input.installedSkills ?? []))
  }
  if (input.healthScore !== undefined) {
    sets.push('health_score = ?')
    params.push(input.healthScore)
  }
  if (input.capabilities !== undefined) {
    sets.push('capabilities = ?')
    params.push(JSON.stringify(input.capabilities ?? []))
  }
  if (input.version !== undefined) {
    sets.push('version = ?')
    params.push(input.version)
  }
  if (input.metadata !== undefined) {
    sets.push('metadata = ?')
    params.push(input.metadata === null ? null : JSON.stringify(input.metadata))
  }
  params.push(workspaceId, kind, input.installationId)
  db.prepare(
    `UPDATE runtime_registry
       SET ${sets.join(', ')}
     WHERE workspace_id = ? AND kind = ? AND installation_id = ?`,
  ).run(...params)
  return getRuntime(workspaceId, kind, input.installationId)
}

export function getRuntime(workspaceId: number, kind: RuntimeKind, installationId: string): RuntimeRecord | null {
  const db = getDatabase()
  ensureTable(db)
  const row = db
    .prepare(
      `SELECT id, workspace_id, kind, installation_id, label, version, capabilities,
              registered_at, last_seen_at, last_task_count, health,
              host, installed_tools, installed_skills, health_score, metadata
       FROM runtime_registry
       WHERE workspace_id = ? AND kind = ? AND installation_id = ?`,
    )
    .get(workspaceId, kind, installationId) as RuntimeRow | undefined
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
              registered_at, last_seen_at, last_task_count, health,
              host, installed_tools, installed_skills, health_score, metadata
       FROM runtime_registry
       WHERE workspace_id = ?
       ORDER BY kind, last_seen_at DESC`,
    )
    .all(workspaceId) as RuntimeRow[]

  const now = Math.floor(Date.now() / 1000)
  return rows.map((r) => {
    const rec = toRecord(r)
    const age = now - r.last_seen_at
    if (age > 300 && rec.health !== 'red') rec.health = 'red'
    else if (age > 120 && rec.health === 'green') rec.health = 'amber'
    return rec
  })
}

type RuntimeRow = {
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
  host: string | null
  installed_tools: string | null
  installed_skills: string | null
  health_score: number | null
  metadata: string | null
}

function toRecord(row: RuntimeRow): RuntimeRecord {
  let caps: string[] = []
  try {
    caps = JSON.parse(row.capabilities ?? '[]') as string[]
    if (!Array.isArray(caps)) caps = []
  } catch {
    caps = []
  }
  let tools: string[] = []
  try {
    tools = JSON.parse(row.installed_tools ?? '[]') as string[]
    if (!Array.isArray(tools)) tools = []
  } catch {
    tools = []
  }
  let skills: string[] = []
  try {
    skills = JSON.parse(row.installed_skills ?? '[]') as string[]
    if (!Array.isArray(skills)) skills = []
  } catch {
    skills = []
  }
  let meta: Record<string, unknown> | null = null
  if (row.metadata) {
    try {
      meta = JSON.parse(row.metadata) as Record<string, unknown>
    } catch {
      meta = null
    }
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
    host: row.host,
    installedTools: tools,
    installedSkills: skills,
    healthScore: row.health_score,
    metadata: meta,
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

/**
 * Phase 1 / mandate field shape — `healthy / warning / critical / offline`
 * with a heartbeat_age in seconds. Mission Control derives these from the
 * registry's green/amber/red + last_seen_at without writing back. This
 * is the wire shape consumed by Mission Control UI surfaces (Runtime
 * Registry view, Task Detail, Activity Feed).
 */
export type RuntimeStatus = 'healthy' | 'warning' | 'critical' | 'offline'

export interface RuntimeProjection {
  runtime_id: string
  runtime_type: RuntimeKind
  name: string
  host: string | null
  status: RuntimeStatus
  health_score: number | null
  version: string | null
  capabilities: string[]
  installed_tools: string[]
  installed_skills: string[]
  active_tasks: number
  heartbeat_age: number | null
  last_seen: number
  registered_at: number
  workspace_id: number
  metadata: Record<string, unknown> | null
  /** Numeric primary key in `runtime_registry` — needed for /api/runtimes/:id. */
  internal_id: number
}

export function deriveStatus(
  health: 'green' | 'amber' | 'red',
  lastSeenAt: number,
  now: number = Math.floor(Date.now() / 1000),
): { status: RuntimeStatus; heartbeat_age: number } {
  const age = now - lastSeenAt
  if (age > 600) return { status: 'offline', heartbeat_age: age }
  if (health === 'red' || age > 300) return { status: 'critical', heartbeat_age: age }
  if (health === 'amber' || age > 120) return { status: 'warning', heartbeat_age: age }
  return { status: 'healthy', heartbeat_age: age }
}

export function toProjection(rec: RuntimeRecord, now?: number): RuntimeProjection {
  const { status, heartbeat_age } = deriveStatus(rec.health, rec.lastSeenAt, now)
  return {
    runtime_id: rec.installationId,
    runtime_type: rec.kind,
    name: rec.label,
    host: rec.host ?? null,
    status,
    health_score: rec.healthScore ?? null,
    version: rec.version,
    capabilities: rec.capabilities,
    installed_tools: rec.installedTools ?? [],
    installed_skills: rec.installedSkills ?? [],
    active_tasks: rec.lastTaskCount,
    heartbeat_age,
    last_seen: rec.lastSeenAt,
    registered_at: rec.registeredAt,
    workspace_id: rec.workspaceId,
    metadata: rec.metadata ?? null,
    internal_id: rec.id,
  }
}

/** Fetch a runtime by its numeric internal id, workspace-scoped. */
export function getRuntimeByInternalId(workspaceId: number, internalId: number): RuntimeRecord | null {
  const db = getDatabase()
  ensureTable(db)
  const row = db
    .prepare(
      `SELECT id, workspace_id, kind, installation_id, label, version, capabilities,
              registered_at, last_seen_at, last_task_count, health,
              host, installed_tools, installed_skills, health_score, metadata
       FROM runtime_registry
       WHERE workspace_id = ? AND id = ?`,
    )
    .get(workspaceId, internalId) as RuntimeRow | undefined
  if (!row) return null
  return toRecord(row)
}
