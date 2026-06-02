/**
 * Tool Executions — Mission Control's CLI supervision ledger.
 *
 * Mission Control does NOT execute commands. Baseline OS / MCP Gateway /
 * the runtime CLIs do that. This module stores:
 *   - what the runtime asked to run (command + redacted args)
 *   - the workspace risk classification
 *   - whether approval is required, and who approved/rejected it
 *   - lifecycle: pending → approved/rejected → running → completed/failed
 *   - exit code, stdout/stderr summaries, proof payload, cost estimate
 *   - a link back to the audit_events row so every decision is provable
 *
 * Public contract (consumed by /api/tool-executions/* routes and the
 * supervisor UI). Workspace-scoped at every read and write.
 */

import { getDatabase, logAuditEvent, db_helpers } from '@/lib/db'

export type ToolExecutionRisk = 'low' | 'medium' | 'high' | 'blocked'
export type ToolExecutionStatus =
  | 'pending' // submitted, classification done, not yet running
  | 'awaiting_approval' // risk=high, needs human approve before runtime runs
  | 'approved' // approved, runtime should pick up and run
  | 'rejected'
  | 'blocked' // workspace policy refuses to ever run this
  | 'running'
  | 'completed'
  | 'failed'

export interface ToolExecutionRow {
  id: number
  workspace_id: number
  task_id: number | null
  agent_id: number | null
  runtime_id: number | null
  cli_tool_id: string
  command_name: string
  command_args_redacted: string | null
  risk: ToolExecutionRisk
  status: ToolExecutionStatus
  approval_required: 0 | 1
  approved_by: string | null
  approved_at: number | null
  rejected_by: string | null
  rejected_at: number | null
  rejection_reason: string | null
  requested_by: string
  /** Phase 4 approval supervision fields. */
  approval_requested_by: string | null
  approval_requested_at: number | null
  approval_reason: string | null
  approval_audit_id: number | null
  started_at: number | null
  completed_at: number | null
  exit_code: number | null
  stdout_summary: string | null
  stderr_summary: string | null
  proof_url: string | null
  proof_payload: string | null
  cost_estimate: number | null
  billable_action_type: string | null
  audit_event_id: number | null
  created_at: number
  updated_at: number
}

export interface ToolExecutionView extends Omit<ToolExecutionRow, 'proof_payload'> {
  proof_payload: Record<string, unknown> | null
}

/**
 * Workspace-policy risk classifier. The default list reflects the
 * mandate's examples (list files = low, delete data = blocked). Specific
 * tools/commands can be overridden per workspace via `settings`
 * (`workspace.<id>.tool_policy.<cli_tool_id>.<command_name> = risk`) —
 * but we keep this module pure: callers pass `policyOverride` if needed.
 *
 * Anything not listed defaults to MEDIUM. Customer-facing copy never
 * shows "blocked" rationale, only "needs approval" or "not allowed".
 */
const DEFAULT_RISK_MAP: Record<string, ToolExecutionRisk> = {
  // LOW — pure read / inspection
  'list': 'low',
  'ls': 'low',
  'cat': 'low',
  'read': 'low',
  'get': 'low',
  'search': 'low',
  'show': 'low',
  'status': 'low',
  'describe': 'low',
  'view': 'low',
  'preview': 'low',
  'render': 'low',

  // MEDIUM — generates artifacts, side-effects local only
  'create-draft': 'medium',
  'draft': 'medium',
  'generate': 'medium',
  'write': 'medium',
  'render-pdf': 'medium',
  'export': 'medium',
  'archive': 'medium',

  // HIGH — external side-effects (email, billing, deployment)
  'send-email': 'high',
  'send': 'high',
  'email': 'high',
  'invite': 'high',
  'charge': 'high',
  'invoice': 'high',
  'publish': 'high',
  'deploy': 'high',
  'apply': 'high',
  'create-issue': 'high',
  'create-pr': 'high',
  'merge': 'high',

  // BLOCKED — never auto-runnable
  'delete-all': 'blocked',
  'drop': 'blocked',
  'rm-rf': 'blocked',
  'destroy': 'blocked',
  'reset-database': 'blocked',
  'truncate': 'blocked',
}

export function classifyRisk(
  command_name: string,
  policyOverride?: ToolExecutionRisk,
): ToolExecutionRisk {
  if (policyOverride) return policyOverride
  const key = command_name.toLowerCase().trim()
  return DEFAULT_RISK_MAP[key] ?? 'medium'
}

export interface StartToolExecutionInput {
  workspace_id: number
  requested_by: string
  cli_tool_id: string
  command_name: string
  command_args_redacted?: string
  task_id?: number | null
  agent_id?: number | null
  runtime_id?: number | null
  cost_estimate?: number | null
  billable_action_type?: string | null
  policy_override?: ToolExecutionRisk
  /** Phase 4: who/what is requesting the approval (typically the router
   * or runtime). Falls back to `requested_by` if not provided. */
  approval_requested_by?: string
}

export interface StartToolExecutionResult {
  id: number
  status: ToolExecutionStatus
  risk: ToolExecutionRisk
  approval_required: boolean
}

/**
 * Record a runtime's intent to execute. Returns the created row + whether
 * Baseline OS should hold the runtime until approval lands. Audit-logged.
 */
export function startToolExecution(input: StartToolExecutionInput): StartToolExecutionResult {
  const db = getDatabase()
  const now = Math.floor(Date.now() / 1000)
  const risk = classifyRisk(input.command_name, input.policy_override)

  let status: ToolExecutionStatus
  let approvalRequired: 0 | 1
  if (risk === 'blocked') {
    status = 'blocked'
    approvalRequired = 0
  } else if (risk === 'high') {
    status = 'awaiting_approval'
    approvalRequired = 1
  } else {
    // low + medium auto-approve (workspace policy can flip medium → high)
    status = 'approved'
    approvalRequired = 0
  }

  const res = db
    .prepare(
      `INSERT INTO tool_executions (
        workspace_id, task_id, agent_id, runtime_id,
        cli_tool_id, command_name, command_args_redacted,
        risk, status, approval_required,
        requested_by, cost_estimate, billable_action_type,
        approval_requested_by, approval_requested_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.workspace_id,
      input.task_id ?? null,
      input.agent_id ?? null,
      input.runtime_id ?? null,
      input.cli_tool_id,
      input.command_name,
      input.command_args_redacted ?? null,
      risk,
      status,
      approvalRequired,
      input.requested_by,
      input.cost_estimate ?? null,
      input.billable_action_type ?? null,
      // Phase 4: only set if approval is actually required. For auto-approved
      // (low/medium) and blocked, leave null — Mission Control reads these
      // fields as "approval supervised by humans" markers.
      approvalRequired ? (input.approval_requested_by ?? input.requested_by) : null,
      approvalRequired ? now : null,
      now,
      now,
    )

  const id = Number(res.lastInsertRowid)
  // Inline audit insert so we can capture the row id and link it back to
  // this execution's `audit_event_id` (the directive's proof column).
  const auditRes = db
    .prepare(
      `INSERT INTO audit_log (action, actor, target_type, target_id, detail)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      'tool_execution_requested',
      input.requested_by,
      'tool_execution',
      id,
      JSON.stringify({
        cli_tool_id: input.cli_tool_id,
        command_name: input.command_name,
        risk,
        status,
        runtime_id: input.runtime_id ?? null,
        task_id: input.task_id ?? null,
      }),
    )
  const auditId = Number(auditRes.lastInsertRowid)
  if (auditId) {
    db.prepare('UPDATE tool_executions SET audit_event_id = ? WHERE id = ?').run(auditId, id)
  }
  // Activity Feed mirror so operators see CLI requests where they already watch.
  db_helpers.logActivity(
    'tool_execution_requested',
    'tool_execution',
    id,
    input.requested_by,
    `Requested ${input.cli_tool_id} · ${input.command_name} (${risk})`,
    {
      cli_tool_id: input.cli_tool_id,
      command_name: input.command_name,
      risk,
      status,
      task_id: input.task_id ?? null,
      runtime_id: input.runtime_id ?? null,
    },
    input.workspace_id,
  )

  return { id, status, risk, approval_required: approvalRequired === 1 }
}

export interface PatchToolExecutionInput {
  workspace_id: number
  id: number
  status?: ToolExecutionStatus
  started_at?: number
  completed_at?: number
  exit_code?: number
  stdout_summary?: string
  stderr_summary?: string
  proof_url?: string | null
  proof_payload?: Record<string, unknown> | null
  cost_estimate?: number | null
  actor?: string
}

/**
 * Runtime calls back to advance the lifecycle. Status transitions are
 * validated. Returns the latest row or null if not found.
 */
export function patchToolExecution(input: PatchToolExecutionInput): ToolExecutionView | null {
  const db = getDatabase()
  const existing = db
    .prepare('SELECT * FROM tool_executions WHERE id = ? AND workspace_id = ?')
    .get(input.id, input.workspace_id) as ToolExecutionRow | undefined
  if (!existing) return null

  if (input.status && !isValidTransition(existing.status, input.status)) {
    throw new Error(`invalid transition: ${existing.status} → ${input.status}`)
  }

  const now = Math.floor(Date.now() / 1000)
  const next: Partial<ToolExecutionRow> = {
    status: input.status ?? existing.status,
    started_at: input.started_at ?? existing.started_at,
    completed_at: input.completed_at ?? existing.completed_at,
    exit_code: input.exit_code ?? existing.exit_code,
    stdout_summary: input.stdout_summary ?? existing.stdout_summary,
    stderr_summary: input.stderr_summary ?? existing.stderr_summary,
    proof_url: input.proof_url !== undefined ? input.proof_url : existing.proof_url,
    proof_payload:
      input.proof_payload !== undefined
        ? input.proof_payload === null
          ? null
          : JSON.stringify(input.proof_payload)
        : existing.proof_payload,
    cost_estimate: input.cost_estimate !== undefined ? input.cost_estimate : existing.cost_estimate,
  }

  db.prepare(
    `UPDATE tool_executions
       SET status = ?, started_at = ?, completed_at = ?, exit_code = ?,
           stdout_summary = ?, stderr_summary = ?, proof_url = ?, proof_payload = ?,
           cost_estimate = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
  ).run(
    next.status,
    next.started_at,
    next.completed_at,
    next.exit_code,
    next.stdout_summary,
    next.stderr_summary,
    next.proof_url,
    next.proof_payload,
    next.cost_estimate,
    now,
    input.id,
    input.workspace_id,
  )

  if (input.status && input.status !== existing.status) {
    logAuditEvent({
      action: 'tool_execution_status_changed',
      actor: input.actor ?? 'runtime',
      target_type: 'tool_execution',
      target_id: input.id,
      detail: { from: existing.status, to: input.status, exit_code: input.exit_code ?? null },
    })
    // Mirror terminal-state transitions into the Activity Feed so operators
    // see completion + failure in the place they already watch.
    if (input.status === 'completed' || input.status === 'failed') {
      const verb = input.status === 'completed' ? 'Completed' : 'Failed'
      db_helpers.logActivity(
        `tool_execution_${input.status}`,
        'tool_execution',
        input.id,
        input.actor ?? 'runtime',
        `${verb} ${existing.cli_tool_id} · ${existing.command_name}${input.exit_code != null ? ` (exit ${input.exit_code})` : ''}`,
        {
          cli_tool_id: existing.cli_tool_id,
          command_name: existing.command_name,
          exit_code: input.exit_code ?? null,
          proof_url: input.proof_url ?? null,
          task_id: existing.task_id,
          runtime_id: existing.runtime_id,
        },
        input.workspace_id,
      )
    }
  }
  return getToolExecution(input.workspace_id, input.id)
}

export function approveToolExecution(
  workspace_id: number,
  id: number,
  actor: string,
  reason?: string,
): ToolExecutionView | null {
  const db = getDatabase()
  const existing = db
    .prepare('SELECT status, approval_required FROM tool_executions WHERE id = ? AND workspace_id = ?')
    .get(id, workspace_id) as { status: string; approval_required: number } | undefined
  if (!existing) return null
  if (existing.status !== 'awaiting_approval') {
    throw new Error(`cannot approve: current status is ${existing.status}`)
  }
  const now = Math.floor(Date.now() / 1000)
  // Audit the approval decision first so we can link the row id back into
  // tool_executions.approval_audit_id (Phase 4 directive field).
  const auditRes = db
    .prepare(
      `INSERT INTO audit_log (action, actor, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)`,
    )
    .run('tool_execution_approved', actor, 'tool_execution', id, reason ? JSON.stringify({ reason }) : null)
  const approvalAuditId = Number(auditRes.lastInsertRowid)
  db.prepare(
    `UPDATE tool_executions
       SET status = 'approved', approved_by = ?, approved_at = ?,
           approval_reason = ?, approval_audit_id = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
  ).run(actor, now, reason ?? null, approvalAuditId, now, id, workspace_id)
  // Activity Feed mirror.
  const row = db
    .prepare('SELECT cli_tool_id, command_name, task_id, runtime_id FROM tool_executions WHERE id = ?')
    .get(id) as { cli_tool_id: string; command_name: string; task_id: number | null; runtime_id: number | null } | undefined
  if (row) {
    db_helpers.logActivity(
      'tool_execution_approved',
      'tool_execution',
      id,
      actor,
      `Approved ${row.cli_tool_id} · ${row.command_name}${reason ? ` — ${reason.slice(0, 80)}` : ''}`,
      {
        cli_tool_id: row.cli_tool_id,
        command_name: row.command_name,
        reason: reason ?? null,
        approval_audit_id: approvalAuditId,
        task_id: row.task_id,
        runtime_id: row.runtime_id,
      },
      workspace_id,
    )
  }
  return getToolExecution(workspace_id, id)
}

export function rejectToolExecution(
  workspace_id: number,
  id: number,
  actor: string,
  reason?: string,
): ToolExecutionView | null {
  const db = getDatabase()
  const existing = db
    .prepare('SELECT status FROM tool_executions WHERE id = ? AND workspace_id = ?')
    .get(id, workspace_id) as { status: string } | undefined
  if (!existing) return null
  if (existing.status !== 'awaiting_approval') {
    throw new Error(`cannot reject: current status is ${existing.status}`)
  }
  const now = Math.floor(Date.now() / 1000)
  const auditRes = db
    .prepare(
      `INSERT INTO audit_log (action, actor, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)`,
    )
    .run('tool_execution_rejected', actor, 'tool_execution', id, reason ? JSON.stringify({ reason }) : null)
  const approvalAuditId = Number(auditRes.lastInsertRowid)
  db.prepare(
    `UPDATE tool_executions
       SET status = 'rejected', rejected_by = ?, rejected_at = ?,
           rejection_reason = ?, approval_audit_id = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
  ).run(actor, now, reason ?? null, approvalAuditId, now, id, workspace_id)
  const row = db
    .prepare('SELECT cli_tool_id, command_name, task_id, runtime_id FROM tool_executions WHERE id = ?')
    .get(id) as { cli_tool_id: string; command_name: string; task_id: number | null; runtime_id: number | null } | undefined
  if (row) {
    db_helpers.logActivity(
      'tool_execution_rejected',
      'tool_execution',
      id,
      actor,
      `Rejected ${row.cli_tool_id} · ${row.command_name}${reason ? ` — ${reason.slice(0, 80)}` : ''}`,
      {
        cli_tool_id: row.cli_tool_id,
        command_name: row.command_name,
        reason: reason ?? null,
        approval_audit_id: approvalAuditId,
        task_id: row.task_id,
      },
      workspace_id,
    )
  }
  return getToolExecution(workspace_id, id)
}

export function getToolExecution(workspace_id: number, id: number): ToolExecutionView | null {
  const db = getDatabase()
  const row = db
    .prepare('SELECT * FROM tool_executions WHERE id = ? AND workspace_id = ?')
    .get(id, workspace_id) as ToolExecutionRow | undefined
  if (!row) return null
  return rowToView(row)
}

export interface ListToolExecutionsOptions {
  workspace_id: number
  status?: ToolExecutionStatus | 'all' | 'pending_approval'
  task_id?: number
  runtime_id?: number
  limit?: number
  offset?: number
}

export function listToolExecutions(opts: ListToolExecutionsOptions): {
  items: ToolExecutionView[]
  total: number
} {
  const db = getDatabase()
  const wheres = ['workspace_id = ?']
  const params: unknown[] = [opts.workspace_id]
  if (opts.status === 'pending_approval') {
    wheres.push("status = 'awaiting_approval' AND approval_required = 1")
  } else if (opts.status && opts.status !== 'all') {
    wheres.push('status = ?')
    params.push(opts.status)
  }
  if (opts.task_id) {
    wheres.push('task_id = ?')
    params.push(opts.task_id)
  }
  if (opts.runtime_id) {
    wheres.push('runtime_id = ?')
    params.push(opts.runtime_id)
  }
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = opts.offset ?? 0
  const rows = db
    .prepare(
      `SELECT * FROM tool_executions
       WHERE ${wheres.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as ToolExecutionRow[]
  const totalRow = db
    .prepare(`SELECT COUNT(*) as n FROM tool_executions WHERE ${wheres.join(' AND ')}`)
    .get(...params) as { n: number }
  return { items: rows.map(rowToView), total: totalRow.n }
}

function rowToView(row: ToolExecutionRow): ToolExecutionView {
  let proof: Record<string, unknown> | null = null
  if (row.proof_payload) {
    try {
      proof = JSON.parse(row.proof_payload) as Record<string, unknown>
    } catch {
      proof = null
    }
  }
  return {
    ...row,
    proof_payload: proof,
  }
}

function isValidTransition(from: ToolExecutionStatus, to: ToolExecutionStatus): boolean {
  const allowed: Record<ToolExecutionStatus, ToolExecutionStatus[]> = {
    pending: ['approved', 'awaiting_approval', 'blocked', 'rejected'],
    awaiting_approval: ['approved', 'rejected', 'blocked'],
    approved: ['running', 'failed', 'completed'],
    running: ['completed', 'failed'],
    rejected: [],
    blocked: [],
    completed: [],
    failed: [],
  }
  return allowed[from]?.includes(to) ?? false
}
