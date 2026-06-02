/**
 * Workforce Template installer.
 *
 * Idempotent install of a vertical-specific workforce: personas → agents,
 * workflows → tasks (status='inbox' so the operator triages them on first
 * load), tool hints → settings rows so the UI can display catalog state.
 *
 * Idempotency: every persona + workflow has a stable slug. We use the
 * `agents.source` column (`workforce-template:<slug>`) and a settings flag
 * (`workforce.installed.<slug>`) to short-circuit repeat installs. Re-clicking
 * "Install" is safe; it returns the same row IDs and writes a single
 * activity event noting the no-op.
 *
 * Workspace-scoped everywhere. Audit-logged on success.
 */

import { getDatabase, db_helpers } from '@/lib/db'
import {
  getTemplate,
  type WorkforceTemplate,
  type WorkforceWorkflow,
} from './catalog'

export interface InstallResult {
  template: string
  status: 'installed' | 'already_installed' | 'unavailable'
  installed_at: number
  personas: Array<{ id: number; slug: string; name: string; role: string }>
  workflows: Array<{ id: number; slug: string; title: string; status: string }>
  tools: Array<{ cli_tool_id: string; label: string; state: string }>
  deep_links: {
    agents: string
    tasks: string
    tool_executions: string
    approvals: string
    runtime_registry: string
  }
}

const TOOL_SETTING_PREFIX = (templateSlug: string) => `workforce.${templateSlug}.tool.`
const INSTALL_SETTING = (templateSlug: string) => `workforce.installed.${templateSlug}`

export function installWorkforceTemplate(
  workspaceId: number,
  templateSlug: string,
  actor: string,
): InstallResult {
  const tmpl = getTemplate(templateSlug)
  if (!tmpl) {
    return {
      template: templateSlug,
      status: 'unavailable',
      installed_at: 0,
      personas: [],
      workflows: [],
      tools: [],
      deep_links: deepLinks(),
    }
  }
  if (tmpl.status !== 'ready') {
    return {
      template: tmpl.slug,
      status: 'unavailable',
      installed_at: 0,
      personas: [],
      workflows: [],
      tools: [],
      deep_links: deepLinks(),
    }
  }

  const db = getDatabase()
  const now = Math.floor(Date.now() / 1000)
  const source = `workforce-template:${tmpl.slug}`

  // Idempotency check — settings row written on first install.
  const existing = db
    .prepare(`SELECT value FROM settings WHERE workspace_id = ? AND key = ?`)
    .get(workspaceId, INSTALL_SETTING(tmpl.slug)) as { value: string } | undefined
  const wasInstalled = !!existing

  // Wrap inserts in a transaction so a partial install can't leave the
  // workspace in a half-state.
  const personasInstalled: InstallResult['personas'] = []
  const workflowsInstalled: InstallResult['workflows'] = []

  const txn = db.transaction(() => {
    // ─── Personas → agents ───
    for (const p of tmpl.personas) {
      const fingerprint = `${tmpl.slug}::${p.slug}`
      const existingAgent = db
        .prepare(
          `SELECT id, name FROM agents
           WHERE workspace_id = ? AND source = ? AND content_hash = ?`,
        )
        .get(workspaceId, source, fingerprint) as { id: number; name: string } | undefined
      if (existingAgent) {
        personasInstalled.push({
          id: existingAgent.id,
          slug: p.slug,
          name: p.name,
          role: p.role,
        })
        continue
      }
      const config = JSON.stringify({
        persona_slug: p.slug,
        description: p.description,
        capabilities: p.capabilities,
      })
      const res = db
        .prepare(
          `INSERT INTO agents (name, role, status, soul_content, last_seen, last_activity,
                               created_at, updated_at, config, workspace_id, source, content_hash)
           VALUES (?, ?, 'offline', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          p.name,
          p.role,
          p.description,
          now,
          now,
          now,
          now,
          config,
          workspaceId,
          source,
          fingerprint,
        )
      personasInstalled.push({
        id: Number(res.lastInsertRowid),
        slug: p.slug,
        name: p.name,
        role: p.role,
      })
    }

    // ─── Workflows → tasks ───
    const projectRow = db
      .prepare(
        `SELECT id FROM projects WHERE workspace_id = ? AND slug = 'general'`,
      )
      .get(workspaceId) as { id: number } | undefined
    const projectId = projectRow?.id ?? null
    let ticketCounter = projectRow
      ? ((db
          .prepare(`SELECT ticket_counter FROM projects WHERE id = ?`)
          .get(projectId) as { ticket_counter: number } | undefined)?.ticket_counter ?? 0)
      : 0

    for (const wf of tmpl.workflows) {
      const existingTask = db
        .prepare(
          `SELECT id, status FROM tasks
           WHERE workspace_id = ? AND metadata LIKE ?`,
        )
        .get(workspaceId, `%"workforce_workflow_slug":"${wf.slug}"%`) as
        | { id: number; status: string }
        | undefined
      if (existingTask) {
        workflowsInstalled.push({
          id: existingTask.id,
          slug: wf.slug,
          title: wf.title,
          status: existingTask.status,
        })
        continue
      }
      ticketCounter += 1
      const meta = JSON.stringify({
        workforce_template: tmpl.slug,
        workforce_workflow_slug: wf.slug,
        owner_persona: wf.owner_persona,
        runtime_hint: wf.runtime_hint ?? null,
        tool_hint: wf.tool_hint ?? null,
        skill_hint: wf.skill_hint ?? null,
        approval_policy: wf.approval_policy,
        proof_expectation: wf.proof_expectation,
        success_criteria: wf.success_criteria,
      })
      const res = db
        .prepare(
          `INSERT INTO tasks
            (title, description, status, priority, project_id, project_ticket_no,
             created_by, workspace_id, created_at, updated_at, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          wf.title,
          wf.description,
          wf.initial_status ?? 'inbox',
          wf.priority ?? 'medium',
          projectId,
          projectId ? ticketCounter : 0,
          actor,
          workspaceId,
          now,
          now,
          meta,
        )
      workflowsInstalled.push({
        id: Number(res.lastInsertRowid),
        slug: wf.slug,
        title: wf.title,
        status: wf.initial_status ?? 'inbox',
      })
    }
    if (projectId && ticketCounter > 0) {
      db.prepare(
        `UPDATE projects SET ticket_counter = ?, updated_at = ? WHERE id = ?`,
      ).run(ticketCounter, now, projectId)
    }

    // ─── Tool hints → settings rows (display-only catalog state) ───
    const insertSetting = db.prepare(
      `INSERT INTO settings (workspace_id, key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(workspace_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    for (const t of tmpl.tools) {
      insertSetting.run(
        workspaceId,
        `${TOOL_SETTING_PREFIX(tmpl.slug)}${t.cli_tool_id}`,
        JSON.stringify({
          cli_tool_id: t.cli_tool_id,
          label: t.label,
          description: t.description,
          state: t.state,
          default_risk: t.default_risk,
        }),
        now,
      )
    }

    // ─── Mark template as installed ───
    insertSetting.run(
      workspaceId,
      INSTALL_SETTING(tmpl.slug),
      JSON.stringify({
        installed_at: now,
        installed_by: actor,
        persona_count: personasInstalled.length,
        workflow_count: workflowsInstalled.length,
      }),
      now,
    )

    // ─── Audit + activity events ───
    db.prepare(
      `INSERT INTO audit_log (action, actor, target_type, target_id, detail)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      wasInstalled ? 'workforce_template_reinstall' : 'workforce_template_installed',
      actor,
      'workforce_template',
      0,
      JSON.stringify({
        template: tmpl.slug,
        workspace_id: workspaceId,
        personas: personasInstalled.length,
        workflows: workflowsInstalled.length,
      }),
    )
    db_helpers.logActivity(
      wasInstalled ? 'workforce_template_reinstall' : 'workforce_template_installed',
      'workforce_template',
      0,
      actor,
      wasInstalled
        ? `Verified ${tmpl.vertical} workforce — already installed (${personasInstalled.length} personas, ${workflowsInstalled.length} workflows)`
        : `Installed ${tmpl.vertical} workforce — ${personasInstalled.length} AI employees, ${workflowsInstalled.length} starter workflows queued`,
      { template: tmpl.slug, persona_count: personasInstalled.length, workflow_count: workflowsInstalled.length },
      workspaceId,
    )
  })
  txn()

  return {
    template: tmpl.slug,
    status: wasInstalled ? 'already_installed' : 'installed',
    installed_at: now,
    personas: personasInstalled,
    workflows: workflowsInstalled,
    tools: tmpl.tools.map((t) => ({ cli_tool_id: t.cli_tool_id, label: t.label, state: t.state })),
    deep_links: deepLinks(),
  }
}

export function getInstallStatus(
  workspaceId: number,
  templateSlug: string,
): { installed: boolean; meta: Record<string, unknown> | null } {
  const db = getDatabase()
  const row = db
    .prepare(`SELECT value FROM settings WHERE workspace_id = ? AND key = ?`)
    .get(workspaceId, INSTALL_SETTING(templateSlug)) as { value: string } | undefined
  if (!row) return { installed: false, meta: null }
  try {
    return { installed: true, meta: JSON.parse(row.value) as Record<string, unknown> }
  } catch {
    return { installed: true, meta: null }
  }
}

function deepLinks(): InstallResult['deep_links'] {
  return {
    agents: '/app/agents',
    tasks: '/app/tasks',
    tool_executions: '/app/tool-executions',
    approvals: '/app/tool-executions?status=pending_approval',
    runtime_registry: '/app/runtime-validation',
  }
}

export function listInstalledTemplates(workspaceId: number): string[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT key FROM settings WHERE workspace_id = ? AND key LIKE 'workforce.installed.%'`,
    )
    .all(workspaceId) as Array<{ key: string }>
  return rows.map((r) => r.key.replace('workforce.installed.', ''))
}
