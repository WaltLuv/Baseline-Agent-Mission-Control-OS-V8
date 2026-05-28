import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'

/**
 * GET /api/openclaw/hooks
 *
 * Serves the **OpenClaw runtime hook template** — the browser/JS variant
 * of the Hermes Python hook. OpenClaw runs in browser/tool-action
 * contexts (CDP, native automation) where Python isn't available, so
 * this template uses the global `fetch` and the standard
 * `runtime-telemetry` HTTP contract.
 *
 * Maintainers of an OpenClaw runtime can:
 *
 *   curl -fsSL "$MC_URL/api/openclaw/hooks" -H "X-Api-Key: $MC_API_KEY" \
 *     > openclaw/mission-control-hook.js
 *
 * Then `import { handle } from './mission-control-hook.js'` and route
 * the runtime's event stream into the `handle(eventName, payload)` fn.
 *
 * Contract:
 *   - Fire-and-forget. NEVER throws.
 *   - 4s timeout per call.
 *   - Workspace-scoped via `MC_API_KEY` injected by the runtime at boot.
 *   - Memory `source` values are restricted to the customer-facing
 *     enum: `Obsidian / Notion / Pinecone / Internal`.
 *   - No vector / embedding / orchestration jargon in payloads.
 *
 * Events recognised:
 *   - `tool:start` / `tool:end`         → /api/agents (presence)
 *   - `tool:invoked` / `skill:used`     → /api/skills/event
 *   - `task:complete`                   → /api/agents/outcome + /api/skills/event
 *   - `skill:escalated`                 → /api/skills/event + /api/agents/escalation
 *   - `memory:cited`                    → /api/agents/memory-use
 *   - `agent:handoff`                   → /api/agents/collaboration
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  return new NextResponse(HOOK_JS, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

const HOOK_JS = `/* eslint-disable */
// Mission Control · OpenClaw runtime hook (JavaScript)
// Auto-generated. Drop into your OpenClaw runtime as the default
// telemetry hook. NEVER throws — every call is fire-and-forget with
// a short timeout, so a Mission Control outage cannot crash OpenClaw.

const MC_URL = process.env.MC_URL || 'http://127.0.0.1:3000'
const MC_API_KEY = process.env.MC_API_KEY || ''

const HEADERS = () => {
  const h = { 'Content-Type': 'application/json' }
  if (MC_API_KEY) h['X-Api-Key'] = MC_API_KEY
  return h
}

async function _post(path, body) {
  try {
    const ac = new AbortController()
    const timeout = setTimeout(() => ac.abort(), 4_000)
    try {
      await fetch(MC_URL + path, {
        method: 'POST',
        headers: HEADERS(),
        body: JSON.stringify(body),
        signal: ac.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    // OpenClaw must never crash on telemetry failure.
  }
}

function _allowedSource(s) {
  return ['Obsidian', 'Notion', 'Pinecone', 'Internal'].includes(s) ? s : 'Internal'
}

export async function handle(event, payload = {}) {
  payload = payload || {}
  if (event === 'tool:start' || event === 'tool:end') {
    return _post('/api/agents', {
      name: payload.agent_name || payload.agentName || 'openclaw',
      role: 'OpenClaw Runtime',
      status: event === 'tool:start' ? 'active' : 'idle',
      source: 'openclaw-hook',
    })
  }
  if (event === 'tool:invoked' || event === 'skill:used') {
    if (!payload.skillSlug && !payload.skill_slug && !payload.skill) return
    return _post('/api/skills/event', {
      skillSlug: payload.skillSlug || payload.skill_slug || payload.skill,
      agentSlug: payload.agentSlug || payload.agent_slug || payload.agent_name,
      valueImpactCents: Math.max(0, Math.floor(payload.value_cents || 0)),
      durationMinutes: payload.duration_min,
      success: payload.success !== false,
      taskId: payload.task_id || payload.taskId,
      note: (payload.summary || payload.note || '').slice(0, 240),
    })
  }
  if (event === 'skill:escalated') {
    await _post('/api/skills/event', {
      skillSlug: payload.skill_slug || payload.skill,
      agentSlug: payload.agentSlug || payload.agent_slug,
      success: false,
      taskId: payload.task_id,
    })
    return _post('/api/agents/escalation', {
      agentSlug: payload.agentSlug || payload.agent_slug,
      taskId: payload.task_id,
      reason: (payload.reason || payload.summary || 'Escalated by OpenClaw').slice(0, 240),
      severity: payload.severity || 'medium',
      source: _allowedSource(payload.memory_source || payload.source),
    })
  }
  if (event === 'task:complete') {
    const status = payload.status || (payload.success === false ? 'failed' : 'done')
    await _post('/api/agents/outcome', {
      agentSlug: payload.agentSlug || payload.agent_slug,
      taskId: payload.task_id || payload.taskId,
      status: ['done', 'failed', 'partial'].includes(status) ? status : 'done',
      valueImpactCents: Math.max(0, Math.floor(payload.value_cents || 0)),
      durationMinutes: payload.duration_min,
      summary: (payload.summary || '').slice(0, 180),
    })
    if (payload.skill_slug || payload.skillSlug) {
      return _post('/api/skills/event', {
        skillSlug: payload.skill_slug || payload.skillSlug,
        agentSlug: payload.agentSlug || payload.agent_slug,
        valueImpactCents: Math.max(0, Math.floor(payload.value_cents || 0)),
        success: status === 'done',
        taskId: payload.task_id,
      })
    }
    return
  }
  if (event === 'memory:cited') {
    if (!payload.title) return
    return _post('/api/agents/memory-use', {
      agentSlug: payload.agentSlug || payload.agent_slug,
      taskId: payload.task_id,
      source: _allowedSource(payload.source),
      title: payload.title.slice(0, 180),
      excerpt: (payload.excerpt || '').slice(0, 240),
      rationale: (payload.rationale || '').slice(0, 240),
    })
  }
  if (event === 'agent:handoff') {
    if (!payload.from_agent_slug && !payload.fromAgentSlug) return
    if (!payload.to_agent_slug && !payload.toAgentSlug) return
    return _post('/api/agents/collaboration', {
      fromAgentSlug: payload.fromAgentSlug || payload.from_agent_slug,
      toAgentSlug: payload.toAgentSlug || payload.to_agent_slug,
      taskId: payload.task_id,
      reason: (payload.reason || '').slice(0, 240),
    })
  }
}

export const MISSION_CONTROL_HOOK_VERSION = '1.0.0'
`

export const dynamic = 'force-dynamic'
