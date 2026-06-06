/**
 * OAuth state store — CSRF protection for the consent → callback round-trip.
 *
 * Rules:
 *   · State token is 32 random bytes, base64url-encoded.
 *   · Single-use: consume() deletes the row on success.
 *   · Time-limited: rows expire after STATE_TTL_SECONDS (default 600 = 10min).
 *   · Workspace-scoped: callback must verify the row's workspace_id matches
 *     the session calling it.
 *   · Sweep on read: every consume() call prunes expired rows so the table
 *     doesn't grow unbounded.
 */

import { randomBytes } from 'crypto'
import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'

const STATE_TTL_SECONDS = 600

export type OAuthStateRow = {
  state: string
  provider: string
  service: string | null
  workspace_id: number
  user_id: number | null
  return_to: string | null
  created_at: number
  expires_at: number
}

export type CreateStateInput = {
  provider: string
  service?: string
  workspaceId: number
  userId?: number
  returnTo?: string
}

export function createState(input: CreateStateInput): { state: string; expires_at: number } {
  const db = getDatabase()
  runMigrations(db)
  const state = randomBytes(32).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const expires_at = now + STATE_TTL_SECONDS
  db.prepare(
    `INSERT INTO oauth_states (state, provider, service, workspace_id, user_id, return_to, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    state,
    input.provider,
    input.service ?? null,
    input.workspaceId,
    input.userId ?? null,
    input.returnTo ?? null,
    now,
    expires_at,
  )
  return { state, expires_at }
}

/**
 * Atomic single-use consumption. Returns the row if the state exists, is
 * fresh, and was created for the same provider — otherwise null. Always
 * deletes the row before returning the snapshot so a replay attempt with
 * the same token never succeeds.
 */
export function consumeState(state: string, expectProvider: string): OAuthStateRow | null {
  if (!state || typeof state !== 'string' || state.length < 16) return null
  const db = getDatabase()
  runMigrations(db)
  const now = Math.floor(Date.now() / 1000)
  // Sweep expired rows on every consume so the table stays small.
  db.prepare(`DELETE FROM oauth_states WHERE expires_at <= ?`).run(now)
  const row = db
    .prepare(
      `SELECT state, provider, service, workspace_id, user_id, return_to, created_at, expires_at
         FROM oauth_states
        WHERE state = ?`,
    )
    .get(state) as OAuthStateRow | undefined
  if (!row) return null
  db.prepare(`DELETE FROM oauth_states WHERE state = ?`).run(state)
  if (row.provider !== expectProvider) return null
  if (row.expires_at <= now) return null
  return row
}

/**
 * Clears all state rows for a workspace. Used by the disconnect path so a
 * pending consent flow can't smuggle in a token after the operator
 * intentionally severed the link.
 */
export function deleteStatesForWorkspace(workspaceId: number): number {
  const db = getDatabase()
  runMigrations(db)
  const res = db.prepare(`DELETE FROM oauth_states WHERE workspace_id = ?`).run(workspaceId)
  return res.changes
}

export const __test = { STATE_TTL_SECONDS }
