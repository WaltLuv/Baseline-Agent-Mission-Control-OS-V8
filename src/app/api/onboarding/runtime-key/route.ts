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

// Walt's D-A3 + Phase F:
//   - 'hermes-vps' is the VPS-hosted Hermes runtime identity (Production
//     Controller for the 24 AI Maintenance Pipelines).
//   - 'omp' is the Oh My Pi coding harness.
// Both are paired via this same one-shot runtime-key flow.
const ALLOWED_RUNTIMES = [
  'claude',
  'codex',
  'openclaw',
  'opencode',
  'hermes',
  'hermes-vps',
  'omp',
] as const

type Runtime = (typeof ALLOWED_RUNTIMES)[number]

function isRuntime(v: unknown): v is Runtime {
  return typeof v === 'string' && (ALLOWED_RUNTIMES as readonly string[]).includes(v)
}

/**
 * Runtimes with a stable singleton identity (e.g. there's only one
 * `hermes-vps` per workspace; we don't want timestamp-suffixed agent
 * names sprawling on every wizard re-entry). For these, the default
 * agent name is the runtime kind itself — idempotent by intent.
 */
const SINGLETON_RUNTIMES = new Set<Runtime>(['hermes-vps'])

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
  // Singleton runtimes (e.g. hermes-vps) get a stable identity per workspace
  // so re-entering the wizard re-keys the existing agent rather than
  // sprouting hermes-vps-runtime-<ts1>, hermes-vps-runtime-<ts2>, …
  const agentName =
    label ||
    (SINGLETON_RUNTIMES.has(runtime)
      ? runtime
      : `${runtime}-runtime-${now}`)
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

  // For VPS / remote runtimes where Node + the connect script may not be
  // colocated, surface a pure-curl handshake command. This is what Walt
  // pastes on the VPS to register hermes-vps.
  const curlBody = JSON.stringify({
    kind: runtime,
    installationId: agentName,
    label: runtime === 'hermes-vps' ? 'Hermes VPS' : agentName,
    version: null,
    capabilities: runtime === 'hermes-vps' ? ['production-controller', 'pipelines', 'agent-orchestration'] : [],
  })
  const curlCommand =
    `curl -sS -X POST "${origin}/api/runtime/handshake" \\\n` +
    `  -H "Content-Type: application/json" \\\n` +
    `  -H "X-API-Key: ${apiKey}" \\\n` +
    `  -d '${curlBody.replace(/'/g, "'\\''")}'`

  return NextResponse.json({
    runtime,
    agent_id: agentId,
    agent_name: agentName,
    workspace_id: workspaceId,
    api_key: apiKey, // shown ONCE
    api_key_hint: apiKey.slice(0, 12) + '...' + apiKey.slice(-4),
    expires_at: null,
    connect_command: command,
    curl_command: curlCommand,
    mission_control_url: origin,
    docs_url:
      runtime === 'hermes-vps'
        ? '/docs/security/VPS_HERMES_PAIRING'
        : '/help#runtime-setup',
  })
}
