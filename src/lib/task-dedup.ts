/**
 * Task deduplication via fingerprint hashing.
 * Detects potential duplicate tasks by comparing a hash of title + description + agent + workspace.
 */

import { createHash } from 'crypto'
import type { Database } from 'better-sqlite3'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface TaskInput {
  title: string
  description?: string | null
  agent?: string | null
  workspace?: string | number | null
}

export interface DuplicateTask {
  id: string | number
  title: string
  status: string
  created_at: number | string
  fingerprint: string
}

// ─────────────────────────────────────────────
// Fingerprint generation
// ─────────────────────────────────────────────

/**
 * Generate a deterministic fingerprint for a task based on
 * title, description, agent, and workspace.
 *
 * Fields are normalized (trimmed, lowercased) before hashing to
 * reduce false negatives from minor formatting differences.
 */
export function getTaskFingerprint(task: TaskInput): string {
  const parts = [
    (task.title || '').trim().toLowerCase(),
    (task.description || '').trim().toLowerCase(),
    (task.agent || '').trim().toLowerCase(),
    String(task.workspace || '').trim().toLowerCase(),
  ]

  const normalized = parts.join('|')

  return createHash('sha256').update(normalized).digest('hex')
}

/**
 * Alternative: get a fingerprint using only the title for broader matching.
 * Useful when description varies but the core task intention is identical.
 */
export function getTitleFingerprint(title: string): string {
  return createHash('sha256')
    .update(title.trim().toLowerCase())
    .digest('hex')
}

// ─────────────────────────────────────────────
// Duplicate detection
// ─────────────────────────────────────────────

export interface CheckDuplicateTaskOptions {
  /** Time window in minutes to search for duplicates (default: 60) */
  windowMinutes?: number
}

/**
 * Check if a task with the same fingerprint was created within the specified time window.
 *
 * The fingerprint is computed from title + description + agent + workspace
 * and compared against tasks in the database.
 *
 * Returns an array of matching tasks, ordered by creation date descending.
 */
export function checkDuplicateTask(
  db: Database,
  fingerprint: string,
  options: CheckDuplicateTaskOptions = {}
): DuplicateTask[] {
  const { windowMinutes = 60 } = options

  const cutoffTimestamp = Math.floor(Date.now() / 1000) - windowMinutes * 60

  try {
    const rows = db
      .prepare(
        `SELECT id, title, status, created_at, metadata
         FROM tasks
         WHERE created_at >= ?
         ORDER BY created_at DESC`
      )
      .all(cutoffTimestamp) as Array<{
        id: number
        title: string
        description: string | null
        assigned_to: string | null
        status: string
        created_at: number
        metadata: string | null
      }>

    const duplicates: DuplicateTask[] = []

    for (const row of rows) {
      // Parse metadata to extract workspace if present
      let workspace: string | number | null = null
      try {
        if (row.metadata) {
          const meta = JSON.parse(row.metadata)
          workspace = meta.workspace_id ?? meta.workspace ?? null
        }
      } catch {
        // Invalid JSON, skip workspace extraction
      }

      const rowFingerprint = getTaskFingerprint({
        title: row.title,
        description: row.description,
        agent: row.assigned_to,
        workspace,
      })

      if (rowFingerprint === fingerprint) {
        duplicates.push({
          id: row.id,
          title: row.title,
          status: row.status,
          created_at: row.created_at,
          fingerprint: rowFingerprint,
        })
      }
    }

    return duplicates
  } catch {
    // Table may not exist
    return []
  }
}

/**
 * Combined fingerprint + database lookup.
 * Given a candidate task, computes its fingerprint and checks for duplicates
 * in the database within a time window.
 *
 * Returns { isDuplicate: true, duplicates: [...] } or { isDuplicate: false, duplicates: [] }.
 */
export function findDuplicateTasks(
  db: Database,
  task: TaskInput,
  options: CheckDuplicateTaskOptions = {}
): { isDuplicate: boolean; duplicates: DuplicateTask[]; fingerprint: string } {
  const fingerprint = getTaskFingerprint(task)
  const duplicates = checkDuplicateTask(db, fingerprint, options)
  const isDuplicate = duplicates.length > 0

  return { isDuplicate, duplicates, fingerprint }
}

/**
 * Scan for ALL potential duplicate pairs in the database.
 * Useful for cleanup jobs and reporting.
 */
export function findAllDuplicateTasks(
  db: Database,
  options?: CheckDuplicateTaskOptions
): Array<{
  fingerprint: string
  tasks: DuplicateTask[]
}> {
  const { windowMinutes } = options ?? {}

  try {
    const rows = db
      .prepare(
        windowMinutes
          ? `SELECT id, title, description, assigned_to, status, created_at, metadata
             FROM tasks
             WHERE created_at >= ?
             ORDER BY created_at DESC`
          : `SELECT id, title, description, assigned_to, status, created_at, metadata
             FROM tasks
             ORDER BY created_at DESC`
      )
      .all(
        windowMinutes
          ? Math.floor(Date.now() / 1000) - windowMinutes * 60
          : 0
      ) as Array<{
        id: number
        title: string
        description: string | null
        assigned_to: string | null
        status: string
        created_at: number
        metadata: string | null
      }>

    const fingerprintMap = new Map<string, DuplicateTask[]>()

    for (const row of rows) {
      let workspace: string | number | null = null
      try {
        if (row.metadata) {
          const meta = JSON.parse(row.metadata)
          workspace = meta.workspace_id ?? meta.workspace ?? null
        }
      } catch {
        // Skip
      }

      const fingerprint = getTaskFingerprint({
        title: row.title,
        description: row.description,
        agent: row.assigned_to,
        workspace,
      })

      const entry = fingerprintMap.get(fingerprint) ?? []
      entry.push({
        id: row.id,
        title: row.title,
        status: row.status,
        created_at: row.created_at,
        fingerprint,
      })
      fingerprintMap.set(fingerprint, entry)
    }

    // Return only groups with more than one task
    return Array.from(fingerprintMap.entries())
      .filter(([, tasks]) => tasks.length > 1)
      .map(([fingerprint, tasks]) => ({ fingerprint, tasks }))
  } catch {
    return []
  }
}
