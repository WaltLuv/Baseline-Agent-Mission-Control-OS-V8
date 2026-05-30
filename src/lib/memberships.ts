/**
 * Workspace membership helpers.
 *
 * Multi-workspace memberships sit on top of the legacy `users.workspace_id`
 * column. We dual-read during the rollout:
 *
 *   1. Prefer rows in `workspace_memberships` (per-workspace role).
 *   2. Fall back to `users.workspace_id` + `users.role` for users that have not
 *      yet been backfilled (the migration backfills all existing users on
 *      schema upgrade, so this fallback is purely defensive).
 *
 * All mutation helpers maintain BOTH stores (memberships row + users column)
 * for now. A future migration will drop the legacy column once we are
 * confident every caller has switched to memberships.
 */

import type Database from 'better-sqlite3'
import { getDatabase } from './db'

export type WorkspaceRole = 'owner' | 'admin' | 'operator' | 'viewer'

const ROLE_LEVEL: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  operator: 2,
  viewer: 1,
}

export interface MembershipRow {
  user_id: number
  workspace_id: number
  role: WorkspaceRole
  status: 'active' | 'invited' | 'suspended'
  joined_at: number
  invited_by: number | null
}

export interface WorkspaceWithRole {
  id: number
  slug: string
  name: string
  tenant_id: number
  role: WorkspaceRole
  status: string
}

function dbFrom(db?: Database.Database): Database.Database {
  return db ?? getDatabase()
}

/** Return every workspace the user belongs to, with their role in each. */
export function listMembershipsForUser(userId: number, db?: Database.Database): WorkspaceWithRole[] {
  return dbFrom(db).prepare(`
    SELECT w.id, w.slug, w.name, w.tenant_id, m.role, m.status
    FROM workspace_memberships m
    JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = ? AND m.status = 'active'
    ORDER BY CASE WHEN w.slug = 'default' THEN 1 ELSE 0 END, w.name COLLATE NOCASE
  `).all(userId) as WorkspaceWithRole[]
}

export function getMembership(userId: number, workspaceId: number, db?: Database.Database): MembershipRow | null {
  return (dbFrom(db).prepare(`
    SELECT user_id, workspace_id, role, status, joined_at, invited_by
    FROM workspace_memberships
    WHERE user_id = ? AND workspace_id = ?
    LIMIT 1
  `).get(userId, workspaceId) as MembershipRow | undefined) ?? null
}

/**
 * Resolve the effective role for a user in a workspace.
 *
 * Order:
 *   1. Active membership row → its role
 *   2. Legacy `users.workspace_id` matching this workspace → `users.role`
 *   3. null (no access)
 */
export function resolveRole(userId: number, workspaceId: number, db?: Database.Database): WorkspaceRole | null {
  const conn = dbFrom(db)
  const membership = getMembership(userId, workspaceId, conn)
  if (membership) return membership.role
  const legacy = conn.prepare(`SELECT workspace_id, role FROM users WHERE id = ?`).get(userId) as { workspace_id: number; role: string } | undefined
  if (legacy && legacy.workspace_id === workspaceId) {
    return (legacy.role as WorkspaceRole) || 'operator'
  }
  return null
}

/** True if role is at least `min`. */
export function hasMinRole(role: WorkspaceRole | null, min: WorkspaceRole): boolean {
  if (!role) return false
  return ROLE_LEVEL[role] >= ROLE_LEVEL[min]
}

/**
 * Add or update a membership idempotently.
 * If the user previously had no `users.workspace_id`, set it for backward compat.
 */
export function upsertMembership(
  userId: number,
  workspaceId: number,
  role: WorkspaceRole,
  options: { invitedBy?: number | null; status?: MembershipRow['status'] } = {},
  db?: Database.Database,
): void {
  const conn = dbFrom(db)
  conn.prepare(`
    INSERT INTO workspace_memberships (user_id, workspace_id, role, invited_by, status, joined_at)
    VALUES (?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(user_id, workspace_id) DO UPDATE SET
      role = excluded.role,
      status = excluded.status,
      invited_by = COALESCE(excluded.invited_by, workspace_memberships.invited_by)
  `).run(userId, workspaceId, role, options.invitedBy ?? null, options.status ?? 'active')

  // Maintain legacy column for users that have no primary workspace yet.
  const legacy = conn.prepare(`SELECT workspace_id FROM users WHERE id = ?`).get(userId) as { workspace_id: number | null } | undefined
  if (!legacy?.workspace_id) {
    conn.prepare(`UPDATE users SET workspace_id = ?, updated_at = unixepoch() WHERE id = ?`).run(workspaceId, userId)
  }
}

/** List members of a workspace. */
export function listWorkspaceMembers(workspaceId: number, db?: Database.Database): Array<{ user_id: number; username: string; display_name: string; email: string | null; role: WorkspaceRole; status: string; joined_at: number }> {
  return dbFrom(db).prepare(`
    SELECT u.id as user_id, u.username, u.display_name, u.email, m.role, m.status, m.joined_at
    FROM workspace_memberships m
    JOIN users u ON u.id = m.user_id
    WHERE m.workspace_id = ?
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'operator' THEN 2 ELSE 3 END, u.created_at
  `).all(workspaceId) as Array<{ user_id: number; username: string; display_name: string; email: string | null; role: WorkspaceRole; status: string; joined_at: number }>
}
