/**
 * Day-2 Operator Notification Center API.
 *
 * Aggregates the five events that matter on day two:
 *   - approvals waiting (with age in hours)
 *   - failed executions (last 24h)
 *   - blocked actions (last 24h)
 *   - critical tasks waiting on action
 *   - runtime offline (any registered runtime not heartbeat'd in last 5 min)
 *
 * Lane: pure read of Mission Control's own tables. No decisioning, no
 * recomputation. Replaces nothing — the existing /api/notifications
 * (database-backed user-addressed alerts) stays as-is; this endpoint
 * powers the header bell and is workspace-scoped, not recipient-scoped.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'

const STALE_APPROVAL_WARN_HOURS = 24
const STALE_APPROVAL_ESCALATE_HOURS = 48
const RUNTIME_OFFLINE_AFTER_SECONDS = 300

export type Day2NotificationKind =
  | 'approval_pending'
  | 'failed_execution'
  | 'blocked_action'
  | 'critical_task'
  | 'runtime_offline'

export interface Day2Notification {
  id: string
  kind: Day2NotificationKind
  title: string
  detail?: string
  age_hours?: number
  age_label?: string
  severity: 'info' | 'warn' | 'critical'
  url: string
  created_at_iso: string
}

export interface Day2NotificationFeed {
  workspace_id: number
  unread_count: number
  total_count: number
  items: Day2Notification[]
  generated_at: string
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const workspaceId = auth.user.workspace_id ?? 1
  const db = getDatabase()
  const nowSec = Math.floor(Date.now() / 1000)
  const items: Day2Notification[] = []

  // ── Pending approvals ────────────────────────────────────────────
  try {
    const approvals = db
      .prepare(
        `SELECT te.id, te.task_id, te.cli_tool_id, te.approval_requested_at, te.created_at, t.title
         FROM tool_executions te
         LEFT JOIN tasks t ON t.id = te.task_id
         WHERE te.workspace_id = ?
           AND te.approval_required = 1
           AND te.approved_at IS NULL
           AND te.rejected_at IS NULL
         ORDER BY te.created_at ASC
         LIMIT 25`,
      )
      .all(workspaceId) as Array<{
        id: number
        task_id: number | null
        cli_tool_id: string
        approval_requested_at: number | null
        created_at: number
        title: string | null
      }>
    for (const a of approvals) {
      const since = a.approval_requested_at ?? a.created_at
      const ageHours = Math.max(0, (nowSec - since) / 3600)
      const severity: 'info' | 'warn' | 'critical' =
        ageHours >= STALE_APPROVAL_ESCALATE_HOURS
          ? 'critical'
          : ageHours >= STALE_APPROVAL_WARN_HOURS
            ? 'warn'
            : 'info'
      items.push({
        id: `approval-${a.id}`,
        kind: 'approval_pending',
        title: a.title ?? `${a.cli_tool_id} action`,
        detail:
          ageHours >= STALE_APPROVAL_ESCALATE_HOURS
            ? `Escalating: waiting ${Math.round(ageHours)}h`
            : ageHours >= STALE_APPROVAL_WARN_HOURS
              ? `Waiting ${Math.round(ageHours)}h — review soon`
              : a.cli_tool_id,
        age_hours: Math.round(ageHours * 10) / 10,
        age_label: humanAge(ageHours),
        severity,
        url: '/app/approvals',
        created_at_iso: new Date(since * 1000).toISOString(),
      })
    }
  } catch { /* table may not exist on first boot */ }

  // ── Failed executions (last 24h) ─────────────────────────────────
  try {
    const failed = db
      .prepare(
        `SELECT te.id, te.cli_tool_id, te.stderr_summary, te.task_id, te.completed_at, te.created_at, t.title
         FROM tool_executions te
         LEFT JOIN tasks t ON t.id = te.task_id
         WHERE te.workspace_id = ?
           AND (te.status = 'failed' OR te.exit_code NOT IN (0))
           AND COALESCE(te.completed_at, te.created_at) >= ?
         ORDER BY te.created_at DESC
         LIMIT 10`,
      )
      .all(workspaceId, nowSec - 86400) as Array<{
        id: number
        cli_tool_id: string
        stderr_summary: string | null
        task_id: number | null
        completed_at: number | null
        created_at: number
      title: string | null
      }>
    for (const f of failed) {
      const since = f.completed_at ?? f.created_at
      items.push({
        id: `failed-${f.id}`,
        kind: 'failed_execution',
        title: f.title ? `${f.cli_tool_id} — ${f.title}` : `${f.cli_tool_id} failed`,
        detail: f.stderr_summary ?? 'Execution failed.',
        age_label: humanAge((nowSec - since) / 3600),
        severity: 'critical',
        url: '/app/tool-executions',
        created_at_iso: new Date(since * 1000).toISOString(),
      })
    }
  } catch { /* */ }

  // ── Blocked actions (last 24h) ───────────────────────────────────
  try {
    const blocked = db
      .prepare(
        `SELECT te.id, te.cli_tool_id, te.task_id, te.created_at, t.title
         FROM tool_executions te
         LEFT JOIN tasks t ON t.id = te.task_id
         WHERE te.workspace_id = ?
           AND te.risk = 'blocked'
           AND te.created_at >= ?
         ORDER BY te.created_at DESC
         LIMIT 10`,
      )
      .all(workspaceId, nowSec - 86400) as Array<{
        id: number
        cli_tool_id: string
        task_id: number | null
        created_at: number
        title: string | null
      }>
    for (const b of blocked) {
      items.push({
        id: `blocked-${b.id}`,
        kind: 'blocked_action',
        title: b.title ? `Blocked: ${b.title}` : `${b.cli_tool_id} refused`,
        detail: 'Workforce refused per approval matrix.',
        age_label: humanAge((nowSec - b.created_at) / 3600),
        severity: 'warn',
        url: '/app/tool-executions',
        created_at_iso: new Date(b.created_at * 1000).toISOString(),
      })
    }
  } catch { /* */ }

  // ── Critical tasks ───────────────────────────────────────────────
  try {
    const critical = db
      .prepare(
        `SELECT id, title, updated_at FROM tasks
         WHERE workspace_id = ? AND priority = 'critical'
           AND status NOT IN ('done','completed','closed','cancelled')
         ORDER BY updated_at DESC LIMIT 5`,
      )
      .all(workspaceId) as Array<{ id: number; title: string; updated_at: number }>
    for (const c of critical) {
      items.push({
        id: `critical-${c.id}`,
        kind: 'critical_task',
        title: c.title,
        detail: 'Critical-priority workflow waiting on action.',
        age_label: humanAge((nowSec - c.updated_at) / 3600),
        severity: 'critical',
        url: `/app/tasks/kanban#task-${c.id}`,
        created_at_iso: new Date(c.updated_at * 1000).toISOString(),
      })
    }
  } catch { /* */ }

  // ── Runtime offline ──────────────────────────────────────────────
  try {
    const stale = db
      .prepare(
        `SELECT name, agent_type, last_heartbeat_at FROM runtimes
         WHERE workspace_id = ? AND (last_heartbeat_at IS NULL OR last_heartbeat_at < ?)
         LIMIT 5`,
      )
      .all(workspaceId, nowSec - RUNTIME_OFFLINE_AFTER_SECONDS) as Array<{
        name: string
        agent_type: string
        last_heartbeat_at: number | null
      }>
    for (const s of stale) {
      const since = s.last_heartbeat_at ?? nowSec - 86400
      items.push({
        id: `runtime-${s.name}`,
        kind: 'runtime_offline',
        title: `${s.name} (${s.agent_type}) is offline`,
        detail: 'No heartbeat — work may be queueing without execution.',
        age_label: humanAge((nowSec - since) / 3600),
        severity: 'warn',
        url: '/app/settings/runtimes',
        created_at_iso: new Date(since * 1000).toISOString(),
      })
    }
  } catch { /* runtimes table optional */ }

  // Severity sort: critical first, then warn, then info; newest first inside each.
  items.sort((a, b) => {
    const s = severityRank(a.severity) - severityRank(b.severity)
    if (s !== 0) return s
    return (b.created_at_iso > a.created_at_iso ? 1 : -1)
  })

  const feed: Day2NotificationFeed = {
    workspace_id: workspaceId,
    unread_count: items.length,
    total_count: items.length,
    items: items.slice(0, 30),
    generated_at: new Date(nowSec * 1000).toISOString(),
  }
  return NextResponse.json(feed)
}

function severityRank(s: 'info' | 'warn' | 'critical'): number {
  if (s === 'critical') return 0
  if (s === 'warn') return 1
  return 2
}

function humanAge(ageHours: number): string {
  if (ageHours < 1) return 'just now'
  if (ageHours < 24) return `${Math.round(ageHours)}h ago`
  const days = Math.round(ageHours / 24)
  return `${days}d ago`
}

export const dynamic = 'force-dynamic'
