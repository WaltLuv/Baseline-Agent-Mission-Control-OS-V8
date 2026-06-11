/**
 * Star Employee — the workspace's top-performing AI employee.
 *
 * Honest ranking over real data: each agent's completed work
 * (agent_trust_scores.successful_tasks) and accuracy (successful /
 * (successful + failed)) are combined into a composite score
 * (completed × accuracy) so the top performer is the one who did the most
 * work AND produced the most accurate results — not just the busiest.
 *
 * Workspace-scoped. Returns null when there is no performance data yet
 * (e.g. a brand-new empty workspace), so the UI can hide the card.
 */
import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'

export interface StarEmployee {
  name: string
  role: string
  status: string
  activity: string
  completed: number
  accuracy: number // 0..1
  score: number
}

export function getStarEmployee(workspaceId: number): StarEmployee | null {
  const db = getDatabase()
  runMigrations(db)

  // Join the workforce roster (agents) to their trust/performance row.
  // LEFT JOIN agents so role/status/activity come from the live roster.
  const rows = db
    .prepare(
      `SELECT ts.agent_name        AS name,
              ts.successful_tasks  AS completed,
              ts.failed_tasks      AS failed,
              a.role               AS role,
              a.status             AS status,
              a.last_activity      AS activity
         FROM agent_trust_scores ts
         LEFT JOIN agents a
           ON a.name = ts.agent_name AND a.workspace_id = ts.workspace_id
        WHERE ts.workspace_id = ?
          AND ts.successful_tasks > 0`,
    )
    .all(workspaceId) as Array<{
    name: string
    completed: number
    failed: number
    role: string | null
    status: string | null
    activity: string | null
  }>

  if (rows.length === 0) return null

  let best: StarEmployee | null = null
  for (const r of rows) {
    const total = r.completed + (r.failed ?? 0)
    const accuracy = total > 0 ? r.completed / total : 0
    const score = r.completed * accuracy
    if (!best || score > best.score) {
      best = {
        name: r.name,
        role: r.role || 'AI Employee',
        status: r.status || 'idle',
        // last_activity may hold a human "currently working on" line (PM demo)
        // or a numeric timestamp from generic agents — only surface text.
        activity: r.activity && !/^\d+$/.test(r.activity) ? r.activity : '',
        completed: r.completed,
        accuracy: Number(accuracy.toFixed(3)),
        score: Number(score.toFixed(2)),
      }
    }
  }
  return best
}
