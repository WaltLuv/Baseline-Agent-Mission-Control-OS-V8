import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import crypto from 'node:crypto'

// POST /api/onboarding/runtime-key
// Body: { runtime: 'claude' | 'codex' | 'openclaw' | 'hermes', label?: string }
//
// Creates a one-shot runtime API key bound to a freshly-minted "owner agent"
// for the current workspace, and returns the exact `scripts/connect-runtime.mjs`
// command the operator should paste. Wraps existing `/api/agents` + `/api/agents/:id/keys`
// so the wizard is a single click.

const ALLOWED_RUNTIMES = ['claude', 'codex', 'openclaw', 'opencode', 'hermes'] as const

type Runtime = (typeof ALLOWED_RUNTIMES)[number]

function isRuntime(v: unknown): v is Runtime {
  return typeof v === 'string' && (ALLOWED_RUNTIMES as readonly string[]).includes(v)
}

function makeApiKey() {
  // 32 random bytes → 43-char base64url plus the `mca_` prefix everything
  // else in the codebase expects.
  return 'mca_' + crypto.randomBytes(32).toString('base64url')
}

export async function POST(request: Request) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { user } = auth
  const workspaceId = user.workspace_id ?? 1
  const db = getDatabase()

  let runtime: Runtime
  let label: string | undefined
  try {
    const body = (await request.json()) as { runtime?: string; label?: string }
    if (!isRuntime(body.runtime)) {
      return NextResponse.json(
        { error: 'runtime must be one of: ' + ALLOWED_RUNTIMES.join(', ') },
        { status: 400 },
      )
    }
    runtime = body.runtime
    label = body.label?.toString().slice(0, 64)
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const now = Math.floor(Date.now() / 1000)
  const agentName = label || `${runtime}-runtime-${now}`
  // Reuse an existing agent record if one already exists with this exact
  // name + workspace — idempotent so re-entering the wizard doesn't sprawl.
  const existing = db
    .prepare('SELECT id FROM agents WHERE name = ? AND workspace_id = ? LIMIT 1')
    .get(agentName, workspaceId) as { id: number } | undefined

  const agentId =
    existing?.id ??
    (db
      .prepare(
        `INSERT INTO agents (name, role, session_key, soul_content, status, workspace_id, runtime_type, created_at, updated_at, last_activity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        agentName,
        'runtime',
        null,
        '',
        'inactive',
        workspaceId,
        runtime,
        now,
        now,
        'Waiting for first heartbeat',
      )
      .lastInsertRowid as number)

  // Mint a fresh runtime-scoped API key and persist its hash.
  const apiKey = makeApiKey()
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
  const keyPrefix = apiKey.slice(0, 12)
  db.prepare(
    `INSERT INTO agent_api_keys (agent_id, workspace_id, name, key_hash, key_prefix, scopes, expires_at, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    agentId,
    workspaceId,
    `wizard-${now}`,
    keyHash,
    keyPrefix,
    JSON.stringify(['runtime']),
    null,
    `user:${user.id ?? user.username ?? 'admin'}`,
    now,
    now,
  )

  // Compose the connect-runtime.mjs command the customer pastes on the runtime host.
  const origin = (process.env.NEXT_PUBLIC_APP_URL || 'https://baseline-agents.com').replace(/\/$/, '')
  const command =
    `MC_URL=${origin} \\\n` +
    `MC_API_KEY=${apiKey} \\\n` +
    `RUNTIME_NAME=${agentName} \\\n` +
    `RUNTIME_TYPE=${runtime} \\\n` +
    `node scripts/connect-runtime.mjs`

  return NextResponse.json({
    runtime,
    agent_id: agentId,
    agent_name: agentName,
    workspace_id: workspaceId,
    api_key: apiKey, // shown ONCE
    api_key_hint: apiKey.slice(0, 12) + '...' + apiKey.slice(-4),
    expires_at: null,
    connect_command: command,
    mission_control_url: origin,
    docs_url: '/help#runtime-setup',
  })
}
