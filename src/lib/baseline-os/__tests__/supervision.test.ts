/**
 * Vitest spec for the Mission Control supervision layer:
 *   - GET /api/runtimes  (Phase 1 projection of the runtime registry)
 *   - GET /api/runtimes/:id
 *   - GET /api/runtimes/:id/tasks
 *   - POST /api/runtime/handshake + /api/runtime/heartbeat extended fields
 *   - POST /api/tasks/:id/routing  (Workforce Router decision write-back)
 *   - POST /api/tool-executions    (start → risk classification)
 *   - POST /api/tool-executions/:id/approve / reject
 *   - PATCH /api/tool-executions/:id
 *
 * These prove Mission Control supervises Baseline OS's decisions —
 * it does NOT host a second registry and does NOT execute commands.
 */
import { describe, it, expect, beforeAll } from 'vitest'

process.env.MC_DISABLE_RATE_LIMIT = '1'

import { GET as runtimesGET } from '@/app/api/runtimes/route'
import { GET as runtimeGET } from '@/app/api/runtimes/[id]/route'
import { GET as runtimeTasksGET } from '@/app/api/runtimes/[id]/tasks/route'
import { POST as handshakePOST } from '@/app/api/runtime/handshake/route'
import { POST as heartbeatPOST } from '@/app/api/runtime/heartbeat/route'
import { POST as routingPOST } from '@/app/api/tasks/[id]/routing/route'
import { POST as txStart, GET as txList } from '@/app/api/tool-executions/route'
import { PATCH as txPatch, GET as txDetail } from '@/app/api/tool-executions/[id]/route'
import { POST as txApprove } from '@/app/api/tool-executions/[id]/approve/route'
import { POST as txReject } from '@/app/api/tool-executions/[id]/reject/route'
import { POST as signupPOST } from '@/app/api/auth/signup/route'
import { getDatabase } from '@/lib/db'
import '@/lib/migrations'
import { runMigrations } from '@/lib/migrations'

async function adminSession(): Promise<{ cookie: string; workspaceId: number; username: string }> {
  const ts = Date.now() + Math.floor(Math.random() * 10000)
  const res = await signupPOST(
    new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.${ts % 250}.${(ts >> 8) % 250}` },
      body: JSON.stringify({
        email: `sup_${ts}@acme.test`,
        password: 'CorrectHorseBattery42',
        full_name: 'Supervisor',
        company_name: `SupervisorCo ${ts}`,
        business_type: 'pm',
      }),
    }),
  )
  expect(res.status).toBe(200)
  const data = (await res.json()) as { workspace: { id: number }; user: { username: string } }
  const setCookie = res.headers.get('set-cookie') || ''
  const m = setCookie.match(/(?:mc-session|__Secure-mc-session)=([^;]+)/i)
  if (!m) throw new Error('no session cookie')
  return { cookie: `mc-session=${m[1]}`, workspaceId: data.workspace.id, username: data.user.username }
}

function req(url: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${url}`, init)
}
function authedReq(cookie: string, url: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${url}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', cookie, ...(init.headers || {}) },
  })
}

describe('Mission Control supervision — runtime registry projection', () => {
  beforeAll(() => {
    runMigrations(getDatabase())
  })

  it('GET /api/runtimes returns empty list for a fresh workspace', async () => {
    const { cookie } = await adminSession()
    const res = await runtimesGET(authedReq(cookie, '/api/runtimes') as never)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { runtimes: unknown[] }
    expect(data.runtimes).toEqual([])
  })

  it('handshake → heartbeat (extended fields) → list/projection round-trip', async () => {
    const { cookie, workspaceId } = await adminSession()
    // Handshake from a Claude Code runtime.
    const hs = await handshakePOST(
      authedReq(cookie, '/api/runtime/handshake', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'claude-code',
          installationId: 'ws-mac-mini-uuid-001',
          label: 'Claude Code · mac-mini',
          version: '1.4.0',
          capabilities: ['code', 'review', 'pr'],
        }),
      }) as never,
    )
    expect(hs.status).toBe(200)

    // Heartbeat with Phase 1 extended fields.
    const hb = await heartbeatPOST(
      authedReq(cookie, '/api/runtime/heartbeat', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'claude-code',
          installationId: 'ws-mac-mini-uuid-001',
          taskCount: 2,
          health: 'green',
          host: 'mac-mini-01.local',
          installedTools: ['stripe-cli', 'gh', 'pnpm'],
          installedSkills: ['draft-pr', 'review-code'],
          healthScore: 92,
          metadata: { uptime_s: 18203, last_task_at: 1780340000 },
        }),
      }) as never,
    )
    expect(hb.status).toBe(200)

    // List projection.
    const list = await runtimesGET(authedReq(cookie, '/api/runtimes') as never)
    expect(list.status).toBe(200)
    const { runtimes } = (await list.json()) as { runtimes: Array<Record<string, unknown>> }
    expect(runtimes).toHaveLength(1)
    const r = runtimes[0]
    expect(r.runtime_id).toBe('ws-mac-mini-uuid-001')
    expect(r.runtime_type).toBe('claude-code')
    expect(r.host).toBe('mac-mini-01.local')
    expect(r.health_score).toBe(92)
    expect(r.installed_tools).toEqual(['stripe-cli', 'gh', 'pnpm'])
    expect(r.installed_skills).toEqual(['draft-pr', 'review-code'])
    expect(r.active_tasks).toBe(2)
    expect(r.status).toBe('healthy')
    expect(r.workspace_id).toBe(workspaceId)
    expect(typeof r.heartbeat_age).toBe('number')
    expect((r.metadata as Record<string, unknown>).uptime_s).toBe(18203)

    // Detail by internal id.
    const detail = await runtimeGET(authedReq(cookie, `/api/runtimes/${r.internal_id as number}`) as never, {
      params: Promise.resolve({ id: String(r.internal_id) }),
    })
    expect(detail.status).toBe(200)
    const detailJson = (await detail.json()) as { runtime: Record<string, unknown> }
    expect(detailJson.runtime.runtime_id).toBe('ws-mac-mini-uuid-001')
  })

  it('derives status: healthy → warning → critical → offline based on heartbeat age', async () => {
    const { cookie } = await adminSession()
    await handshakePOST(
      authedReq(cookie, '/api/runtime/handshake', {
        method: 'POST',
        body: JSON.stringify({ kind: 'hermes', installationId: 'h-stale-1', label: 'Hermes · stale' }),
      }) as never,
    )
    // Backdate last_seen_at past the warning threshold (>120s).
    const db = getDatabase()
    db.prepare(
      `UPDATE runtime_registry SET last_seen_at = ? WHERE installation_id = 'h-stale-1'`,
    ).run(Math.floor(Date.now() / 1000) - 150)
    const list = await runtimesGET(authedReq(cookie, '/api/runtimes') as never)
    const { runtimes } = (await list.json()) as { runtimes: Array<{ status: string }> }
    expect(runtimes[0].status).toBe('warning')

    // Past critical threshold (>300s).
    db.prepare(
      `UPDATE runtime_registry SET last_seen_at = ? WHERE installation_id = 'h-stale-1'`,
    ).run(Math.floor(Date.now() / 1000) - 350)
    const list2 = await runtimesGET(authedReq(cookie, '/api/runtimes') as never)
    const { runtimes: r2 } = (await list2.json()) as { runtimes: Array<{ status: string }> }
    expect(r2[0].status).toBe('critical')

    // Past offline threshold (>600s).
    db.prepare(
      `UPDATE runtime_registry SET last_seen_at = ? WHERE installation_id = 'h-stale-1'`,
    ).run(Math.floor(Date.now() / 1000) - 700)
    const list3 = await runtimesGET(authedReq(cookie, '/api/runtimes') as never)
    const { runtimes: r3 } = (await list3.json()) as { runtimes: Array<{ status: string }> }
    expect(r3[0].status).toBe('offline')
  })

  it('routing decision: task gains assigned_runtime + selected_tool + reason; runtime tasks list reflects it', async () => {
    const { cookie } = await adminSession()
    // Register runtime.
    await handshakePOST(
      authedReq(cookie, '/api/runtime/handshake', {
        method: 'POST',
        body: JSON.stringify({ kind: 'codex', installationId: 'codex-routed-1', label: 'Codex' }),
      }) as never,
    )
    // Get its internal id.
    const list = await runtimesGET(authedReq(cookie, '/api/runtimes') as never)
    const { runtimes } = (await list.json()) as {
      runtimes: Array<{ internal_id: number; runtime_id: string }>
    }
    const codex = runtimes.find((r) => r.runtime_id === 'codex-routed-1')!
    // Create a task directly.
    const db = getDatabase()
    const ws = await adminWorkspaceId(cookie)
    const project = db
      .prepare(`SELECT id FROM projects WHERE workspace_id = ? AND slug = 'general'`)
      .get(ws) as { id: number }
    const insertRes = db
      .prepare(
        `INSERT INTO tasks (title, status, priority, project_id, project_ticket_no, created_by, workspace_id, created_at, updated_at)
         VALUES (?, 'inbox', 'medium', ?, 1, 'admin', ?, unixepoch(), unixepoch())`,
      )
      .run('Refactor auth module', project.id, ws)
    const taskId = Number(insertRes.lastInsertRowid)

    // Router records its decision.
    const r = await routingPOST(
      authedReq(cookie, `/api/tasks/${taskId}/routing`, {
        method: 'POST',
        body: JSON.stringify({
          assigned_runtime: 'codex-routed-1',
          selected_tool: 'codex-cli',
          selected_skill: 'refactor-typescript',
          routing_reason: 'task title matches refactor-typescript skill exemplars',
          routing_confidence: 0.82,
          approval_required: false,
        }),
      }) as never,
      { params: Promise.resolve({ id: String(taskId) }) },
    )
    expect(r.status).toBe(200)
    const rj = (await r.json()) as { task: Record<string, unknown> }
    expect(rj.task.assigned_runtime).toBe('codex-routed-1')
    expect(rj.task.selected_tool).toBe('codex-cli')
    expect(rj.task.routing_confidence).toBe(0.82)

    // /api/runtimes/:id/tasks should return this task.
    const tasksRes = await runtimeTasksGET(
      authedReq(cookie, `/api/runtimes/${codex.internal_id}/tasks`) as never,
      { params: Promise.resolve({ id: String(codex.internal_id) }) },
    )
    expect(tasksRes.status).toBe(200)
    const tj = (await tasksRes.json()) as { tasks: Array<Record<string, unknown>> }
    expect(tj.tasks).toHaveLength(1)
    expect(tj.tasks[0].id).toBe(taskId)
    expect(tj.tasks[0].selected_skill).toBe('refactor-typescript')
  })
})

describe('Mission Control supervision — tool executions (CLI supervision)', () => {
  beforeAll(() => {
    runMigrations(getDatabase())
  })

  it('LOW risk command auto-approves', async () => {
    const { cookie } = await adminSession()
    const res = await txStart(
      authedReq(cookie, '/api/tool-executions', {
        method: 'POST',
        body: JSON.stringify({
          cli_tool_id: 'gh',
          command_name: 'list',
          command_args_redacted: 'gh repo list',
        }),
      }) as never,
    )
    expect(res.status).toBe(201)
    const data = (await res.json()) as { id: number; status: string; risk: string; approval_required: boolean }
    expect(data.risk).toBe('low')
    expect(data.status).toBe('approved')
    expect(data.approval_required).toBe(false)
  })

  it('HIGH risk command gates on approval; approve transitions to approved', async () => {
    const { cookie } = await adminSession()
    const res = await txStart(
      authedReq(cookie, '/api/tool-executions', {
        method: 'POST',
        body: JSON.stringify({
          cli_tool_id: 'resend',
          command_name: 'send-email',
          command_args_redacted: 'resend send --to=*** --subject=***',
          cost_estimate: 0.001,
        }),
      }) as never,
    )
    expect(res.status).toBe(201)
    const { id, status, risk, approval_required } = (await res.json()) as {
      id: number
      status: string
      risk: string
      approval_required: boolean
    }
    expect(risk).toBe('high')
    expect(status).toBe('awaiting_approval')
    expect(approval_required).toBe(true)

    // Owner approves.
    const ap = await txApprove(
      authedReq(cookie, `/api/tool-executions/${id}/approve`, { method: 'POST' }) as never,
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(ap.status).toBe(200)
    const apj = (await ap.json()) as { execution: { status: string; approved_by: string | null } }
    expect(apj.execution.status).toBe('approved')
    expect(apj.execution.approved_by).toBeTruthy()
  })

  it('BLOCKED commands cannot be executed and cannot be approved', async () => {
    const { cookie } = await adminSession()
    const res = await txStart(
      authedReq(cookie, '/api/tool-executions', {
        method: 'POST',
        body: JSON.stringify({ cli_tool_id: 'pg', command_name: 'drop' }),
      }) as never,
    )
    const { id, risk, status } = (await res.json()) as { id: number; risk: string; status: string }
    expect(risk).toBe('blocked')
    expect(status).toBe('blocked')

    const ap = await txApprove(
      authedReq(cookie, `/api/tool-executions/${id}/approve`, { method: 'POST' }) as never,
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(ap.status).toBe(409) // cannot approve a blocked execution
  })

  it('full lifecycle: start → approve → running → completed with proof', async () => {
    const { cookie } = await adminSession()
    const startRes = await txStart(
      authedReq(cookie, '/api/tool-executions', {
        method: 'POST',
        body: JSON.stringify({ cli_tool_id: 'stripe-cli', command_name: 'charge' }),
      }) as never,
    )
    const { id } = (await startRes.json()) as { id: number }
    await txApprove(
      authedReq(cookie, `/api/tool-executions/${id}/approve`, { method: 'POST' }) as never,
      { params: Promise.resolve({ id: String(id) }) },
    )
    // Runtime → running
    await txPatch(
      authedReq(cookie, `/api/tool-executions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'running', started_at: Math.floor(Date.now() / 1000) }),
      }) as never,
      { params: Promise.resolve({ id: String(id) }) },
    )
    // Runtime → completed with proof
    const done = await txPatch(
      authedReq(cookie, `/api/tool-executions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'completed',
          completed_at: Math.floor(Date.now() / 1000),
          exit_code: 0,
          stdout_summary: 'charge_id=ch_xxx amount=2500 currency=usd',
          proof_url: 'https://stripe.com/charges/ch_xxx',
          proof_payload: { charge_id: 'ch_xxx', amount: 2500 },
          cost_estimate: 0.029,
        }),
      }) as never,
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(done.status).toBe(200)
    const dj = (await done.json()) as { execution: { status: string; exit_code: number; proof_payload: Record<string, unknown> | null } }
    expect(dj.execution.status).toBe('completed')
    expect(dj.execution.exit_code).toBe(0)
    expect(dj.execution.proof_payload?.charge_id).toBe('ch_xxx')

    const det = await txDetail(
      authedReq(cookie, `/api/tool-executions/${id}`) as never,
      { params: Promise.resolve({ id: String(id) }) },
    )
    const detj = (await det.json()) as { execution: { audit_event_id: number | null } }
    expect(detj.execution.audit_event_id).toBeTruthy()
  })

  it('reject transitions awaiting_approval → rejected with reason', async () => {
    const { cookie } = await adminSession()
    const startRes = await txStart(
      authedReq(cookie, '/api/tool-executions', {
        method: 'POST',
        body: JSON.stringify({ cli_tool_id: 'resend', command_name: 'send-email' }),
      }) as never,
    )
    const { id } = (await startRes.json()) as { id: number }
    const rj = await txReject(
      authedReq(cookie, `/api/tool-executions/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'do not send marketing emails on weekends' }),
      }) as never,
      { params: Promise.resolve({ id: String(id) }) },
    )
    expect(rj.status).toBe(200)
    const j = (await rj.json()) as { execution: { status: string; rejection_reason: string | null } }
    expect(j.execution.status).toBe('rejected')
    expect(j.execution.rejection_reason).toMatch(/marketing/)
  })

  it('lifecycle events surface into the Activity Feed (read-side mirror)', async () => {
    const { cookie, workspaceId } = await adminSession()
    // Start a HIGH-risk execution → expect tool_execution_requested activity.
    const startRes = await txStart(
      authedReq(cookie, '/api/tool-executions', {
        method: 'POST',
        body: JSON.stringify({ cli_tool_id: 'resend', command_name: 'send-email' }),
      }) as never,
    )
    const { id } = (await startRes.json()) as { id: number }
    await txApprove(
      authedReq(cookie, `/api/tool-executions/${id}/approve`, { method: 'POST' }) as never,
      { params: Promise.resolve({ id: String(id) }) },
    )
    await txPatch(
      authedReq(cookie, `/api/tool-executions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'running', started_at: Math.floor(Date.now() / 1000) }),
      }) as never,
      { params: Promise.resolve({ id: String(id) }) },
    )
    await txPatch(
      authedReq(cookie, `/api/tool-executions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'completed',
          completed_at: Math.floor(Date.now() / 1000),
          exit_code: 0,
        }),
      }) as never,
      { params: Promise.resolve({ id: String(id) }) },
    )
    const db = getDatabase()
    const acts = db
      .prepare(
        `SELECT type FROM activities WHERE workspace_id = ? AND entity_type = 'tool_execution' AND entity_id = ?
         ORDER BY id ASC`,
      )
      .all(workspaceId, id) as Array<{ type: string }>
    const types = acts.map((a) => a.type)
    expect(types).toContain('tool_execution_requested')
    expect(types).toContain('tool_execution_approved')
    expect(types).toContain('tool_execution_completed')
  })

  it('list filters by status=pending_approval surface only items waiting on a human', async () => {
    const { cookie } = await adminSession()
    await txStart(
      authedReq(cookie, '/api/tool-executions', {
        method: 'POST',
        body: JSON.stringify({ cli_tool_id: 'gh', command_name: 'list' }), // low → approved
      }) as never,
    )
    await txStart(
      authedReq(cookie, '/api/tool-executions', {
        method: 'POST',
        body: JSON.stringify({ cli_tool_id: 'gh', command_name: 'deploy' }), // high → awaiting
      }) as never,
    )
    const res = await txList(
      authedReq(cookie, '/api/tool-executions?status=pending_approval') as never,
    )
    const data = (await res.json()) as { items: Array<{ status: string }>; total: number }
    expect(data.items.every((i) => i.status === 'awaiting_approval')).toBe(true)
    expect(data.total).toBeGreaterThanOrEqual(1)
  })
})

async function adminWorkspaceId(cookie: string): Promise<number> {
  // Decode workspace from /api/runtimes (which the session-bound user owns).
  // Cheaper than re-importing /api/auth/me.
  const r = await runtimesGET(
    new Request('http://localhost/api/runtimes', {
      headers: { 'Content-Type': 'application/json', cookie },
    }) as never,
  )
  const { runtimes } = (await r.json()) as { runtimes: Array<{ workspace_id: number }> }
  if (runtimes.length > 0) return runtimes[0].workspace_id
  // Fall back: derive from settings table.
  const db = getDatabase()
  const ws = db
    .prepare(
      `SELECT CAST(value AS INTEGER) AS id FROM settings WHERE key LIKE 'user.%.onboarding.workspace_id' ORDER BY updated_at DESC LIMIT 1`,
    )
    .get() as { id: number } | undefined
  return ws?.id ?? 1
}
