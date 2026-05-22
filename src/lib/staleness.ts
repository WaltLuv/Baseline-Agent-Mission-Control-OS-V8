/**
 * Staleness detection utilities for finding orphaned tasks and stale workflows.
 * Read-only diagnostic functions — they do not mutate data.
 */

import type { Database } from 'better-sqlite3'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface StaleItem {
  id: string | number
  type: string
  details: string
  stale_since: string
  hours_stale: number
}

// ─────────────────────────────────────────────
// Orphaned task detection
// ─────────────────────────────────────────────

export interface DetectOrphanedTasksOptions {
  /** Hours after which an 'in_progress' task is considered orphaned (default: 24) */
  inProgressThresholdHours?: number
  /** Hours after which an 'assigned' task is considered orphaned (default: 48) */
  assignedThresholdHours?: number
}

/**
 * Finds tasks that have been stuck in a non-terminal state for too long.
 *
 * - Tasks with status 'in_progress' for more than 24 hours (configurable)
 * - Tasks with status 'assigned' for more than 48 hours (configurable)
 *
 * Both thresholds use `updated_at` as the staleness marker.
 */
export function detectOrphanedTasks(
  db: Database,
  options: DetectOrphanedTasksOptions = {}
): StaleItem[] {
  const { inProgressThresholdHours = 24, assignedThresholdHours = 48 } = options
  const now = Date.now()
  const results: StaleItem[] = []

  // in_progress tasks older than threshold
  const inProgressThreshold = now / 1000 - inProgressThresholdHours * 3600
  try {
    const inProgressTasks = db
      .prepare(
        `SELECT id, title, status, assigned_to, updated_at
         FROM tasks
         WHERE status = 'in_progress' AND updated_at < ?
         ORDER BY updated_at ASC`
      )
      .all(inProgressThreshold) as Array<{
        id: number
        title: string
        status: string
        assigned_to: string | null
        updated_at: number
      }>

    for (const task of inProgressTasks) {
      const hoursStale = (now / 1000 - task.updated_at) / 3600
      results.push({
        id: task.id,
        type: 'task.orphaned',
        details: `Task #${task.id} "${task.title}" stuck in_progress for ${hoursStale.toFixed(1)}h` +
          (task.assigned_to ? ` (assigned to: ${task.assigned_to})` : ''),
        stale_since: new Date(task.updated_at * 1000).toISOString(),
        hours_stale: Number(hoursStale.toFixed(1)),
      })
    }
  } catch {
    // Table may not exist in early startup or test scenarios
  }

  // assigned tasks older than threshold
  const assignedThreshold = now / 1000 - assignedThresholdHours * 3600
  try {
    const assignedTasks = db
      .prepare(
        `SELECT id, title, status, assigned_to, updated_at
         FROM tasks
         WHERE status = 'assigned' AND updated_at < ?
         ORDER BY updated_at ASC`
      )
      .all(assignedThreshold) as Array<{
        id: number
        title: string
        status: string
        assigned_to: string | null
        updated_at: number
      }>

    for (const task of assignedTasks) {
      const hoursStale = (now / 1000 - task.updated_at) / 3600
      results.push({
        id: task.id,
        type: 'task.stale_assigned',
        details: `Task #${task.id} "${task.title}" sits assigned for ${hoursStale.toFixed(1)}h` +
          (task.assigned_to ? ` (assigned to: ${task.assigned_to})` : ''),
        stale_since: new Date(task.updated_at * 1000).toISOString(),
        hours_stale: Number(hoursStale.toFixed(1)),
      })
    }
  } catch {
    // Table may not exist
  }

  return results
}

// ─────────────────────────────────────────────
// Stale workflow / pipeline run detection
// ─────────────────────────────────────────────

export interface DetectStaleWorkflowsOptions {
  /** Hours after which a 'running' pipeline_run is considered stale (default: 1) */
  runningThresholdHours?: number
}

/**
 * Finds pipeline_runs that have been stuck in 'running' status for too long.
 * Looks for tables `pipeline_runs` or falls back to `agent_runs` if the former
 * does not exist.
 */
export function detectStaleWorkflows(
  db: Database,
  options: DetectStaleWorkflowsOptions = {}
): StaleItem[] {
  const { runningThresholdHours = 1 } = options
  const now = Date.now()
  const results: StaleItem[] = []
  const staleThreshold = now / 1000 - runningThresholdHours * 3600

  // Try pipeline_runs first, then fall back to agent_runs
  const tables = ['pipeline_runs', 'agent_runs']

  for (const table of tables) {
    try {
      // Check if the table exists
      const exists = db
        .prepare(
          `SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name=?`
        )
        .get(table) as { cnt: number }

      if (!exists || exists.cnt === 0) continue

      // Check status column name — could be 'status' or 'state'
      const cols = db
        .prepare(`PRAGMA table_info(${table})`)
        .all() as Array<{ name: string }>

      const hasStatus = cols.some((c) => c.name === 'status' || c.name === 'state')
      const hasStartedAt = cols.some(
        (c) => c.name === 'started_at' || c.name === 'created_at'
      )

      if (!hasStatus || !hasStartedAt) continue

      const statusCol = cols.some((c) => c.name === 'status') ? 'status' : 'state'
      const timeCol = cols.some((c) => c.name === 'started_at') ? 'started_at' : 'created_at'

      const rows = db
        .prepare(
          `SELECT id, ${statusCol} as status, ${timeCol} as created_time
           FROM ${table}
           WHERE ${statusCol} = 'running' AND ${timeCol} < ?
           ORDER BY ${timeCol} ASC`
        )
        .all(staleThreshold) as Array<{
          id: string | number
          status: string
          created_time: string | number
        }>

      for (const row of rows) {
        // Handle both unixepoch (number) and ISO string timestamps
        const ts =
          typeof row.created_time === 'number'
            ? row.created_time * 1000
            : new Date(row.created_time).getTime()

        const hoursStale = (now - ts) / (1000 * 60 * 60)
        if (hoursStale <= 0) continue

        results.push({
          id: row.id,
          type: `workflow.stale_${table}`,
          details: `${table} #${row.id} stuck in 'running' for ${hoursStale.toFixed(1)}h`,
          stale_since: new Date(ts).toISOString(),
          hours_stale: Number(hoursStale.toFixed(1)),
        })
      }

      // If we found results, we're done (don't try the fallback table)
      if (results.length > 0) break
    } catch {
      // Table doesn't exist or has unexpected schema — continue to fallback
    }
  }

  return results
}

// ─────────────────────────────────────────────
// Combined diagnostic
// ─────────────────────────────────────────────

export interface StalenessReport {
  tasks: StaleItem[]
  workflows: StaleItem[]
  generated_at: string
}

/**
 * Run all staleness checks against the database.
 */
export function generateStalenessReport(
  db: Database,
  options?: {
    taskOptions?: DetectOrphanedTasksOptions
    workflowOptions?: DetectStaleWorkflowsOptions
  }
): StalenessReport {
  return {
    tasks: detectOrphanedTasks(db, options?.taskOptions),
    workflows: detectStaleWorkflows(db, options?.workflowOptions),
    generated_at: new Date().toISOString(),
  }
}
