import { existsSync } from 'node:fs'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { detectAllRuntimes, detectRuntime, startInstall, getInstallJob, getActiveJobs, generateDockerSidecar } from '@/lib/agent-runtimes'
import type { RuntimeId, DeploymentMode } from '@/lib/agent-runtimes'
import { clearHermesDetectionCache } from '@/lib/hermes-sessions'
import { getDatabase, logAuditEvent } from '@/lib/db'
import { logger } from '@/lib/logger'

const VALID_RUNTIMES = new Set<RuntimeId>(['openclaw', 'hermes', 'claude', 'codex', 'opencode'])
const VALID_MODES = new Set<DeploymentMode>(['local', 'docker'])

// A registered runtime is considered "connected" while its last_seen heartbeat
// is within this many seconds. After that → stale; over 5x → disconnected.
const HEARTBEAT_OK_SECONDS = 90
const HEARTBEAT_STALE_SECONDS = HEARTBEAT_OK_SECONDS * 5

type RegistryRow = {
  id: number
  name: string
  runtime_type: RuntimeId | null
  status: string
  last_seen: number | null
  workspace_id: number
  config: string | null
}

function loadRegisteredRuntimes(workspaceId: number): Array<{
  id: number
  name: string
  runtime_type: RuntimeId
  workspace_id: number
  connection_status: 'connected' | 'stale' | 'disconnected'
  last_heartbeat_at: number | null
  seconds_since_heartbeat: number | null
  config: Record<string, unknown> | null
}> {
  const db = getDatabase()
  const now = Math.floor(Date.now() / 1000)
  const rows = db.prepare(`
    SELECT id, name, runtime_type, status, last_seen, workspace_id, config
    FROM agents
    WHERE workspace_id = ? AND runtime_type IS NOT NULL AND (hidden IS NULL OR hidden = 0)
    ORDER BY id DESC
  `).all(workspaceId) as RegistryRow[]
  return rows.map((r) => {
    const last = r.last_seen ?? 0
    const delta = last ? now - last : null
    let connection_status: 'connected' | 'stale' | 'disconnected'
    if (!last) connection_status = 'disconnected'
    else if (delta! <= HEARTBEAT_OK_SECONDS) connection_status = 'connected'
    else if (delta! <= HEARTBEAT_STALE_SECONDS) connection_status = 'stale'
    else connection_status = 'disconnected'
    let parsedConfig: Record<string, unknown> | null = null
    try { if (r.config) parsedConfig = JSON.parse(r.config) } catch { parsedConfig = null }
    return {
      id: r.id,
      name: r.name,
      runtime_type: r.runtime_type as RuntimeId,
      workspace_id: r.workspace_id,
      connection_status,
      last_heartbeat_at: last || null,
      seconds_since_heartbeat: delta,
      config: parsedConfig,
    }
  })
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Clear caches so freshly-installed runtimes are detected immediately
  clearHermesDetectionCache()
  const runtimes = detectAllRuntimes()
  const activeJobs = getActiveJobs()
  const isDocker = existsSync('/.dockerenv')

  // Merge: filesystem-local runtimes (this Mission Control host) + DB-registered
  // remote runtimes (Hermes / OpenClaw / Claude Code / Codex running on
  // another machine that handshakes via /api/agents/register).
  const workspaceId = auth.user.workspace_id ?? 1
  const registered = loadRegisteredRuntimes(workspaceId)

  return NextResponse.json({
    runtimes,
    registered,
    activeJobs,
    isDocker,
    heartbeat_window_seconds: HEARTBEAT_OK_SECONDS,
  })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action } = body

  if (action === 'install') {
    const runtime = body.runtime as RuntimeId
    const mode = (body.mode || 'local') as DeploymentMode
    if (!runtime || !VALID_RUNTIMES.has(runtime)) {
      return NextResponse.json({ error: 'Invalid runtime. Use: openclaw, hermes, claude, codex, opencode' }, { status: 400 })
    }
    if (!VALID_MODES.has(mode)) {
      return NextResponse.json({ error: 'Invalid mode. Use: local, docker' }, { status: 400 })
    }

    logger.info({ runtime, mode, actor: auth.user.username }, 'Starting agent runtime install')
    logAuditEvent({
      action: 'agent_runtime.install',
      actor: auth.user.username,
      detail: JSON.stringify({ runtime, mode }),
    })

    const job = startInstall(runtime, mode)
    return NextResponse.json({ jobId: job.id, job })
  }

  if (action === 'job-status') {
    const { jobId } = body
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })
    const job = getInstallJob(jobId)
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    return NextResponse.json({ job })
  }

  if (action === 'docker-compose') {
    const runtime = body.runtime as RuntimeId
    if (!runtime || !VALID_RUNTIMES.has(runtime)) {
      return NextResponse.json({ error: 'Invalid runtime' }, { status: 400 })
    }
    return NextResponse.json({ yaml: generateDockerSidecar(runtime) })
  }

  if (action === 'detect') {
    const runtime = body.runtime as RuntimeId
    if (!runtime || !VALID_RUNTIMES.has(runtime)) {
      return NextResponse.json({ error: 'Invalid runtime' }, { status: 400 })
    }
    const status = detectRuntime(runtime)
    return NextResponse.json({ status })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
