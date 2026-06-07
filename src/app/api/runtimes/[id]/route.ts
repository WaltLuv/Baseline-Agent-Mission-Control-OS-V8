/**
 * GET /api/runtimes/:id  — single runtime detail, workspace-scoped.
 * :id is the numeric `runtime_registry.id`. Returns the Phase 1 projection
 * shape used by Mission Control UI surfaces.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { deleteRuntimeByInternalId, getRuntimeByInternalId, toProjection } from '@/lib/baseline-os/runtime-registry'

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const params = await ctx.params
  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  const workspaceId = auth.user.workspace_id ?? 1
  const rec = getRuntimeByInternalId(workspaceId, id)
  if (!rec) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ runtime: toProjection(rec) })
}

/**
 * DELETE /api/runtimes/:id — revoke a runtime (kill switch). Admin-only.
 * Removes the runtime_registry row AND revokes the matching runtime's API
 * keys (agent named after the runtime's installation_id in this workspace) so
 * subsequent handshakes get 401. No raw key material is touched or logged.
 */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const params = await ctx.params
  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  const workspaceId = auth.user.workspace_id ?? 1

  const rec = getRuntimeByInternalId(workspaceId, id)
  if (!rec) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const db = getDatabase()
  const now = Math.floor(Date.now() / 1000)
  // Revoke the runtime's API keys (agent name === installation_id for the
  // singleton pairing flow, e.g. 'hermes-vps').
  let revokedKeys = 0
  try {
    const agent = db
      .prepare('SELECT id FROM agents WHERE name = ? AND workspace_id = ? LIMIT 1')
      .get(rec.installationId, workspaceId) as { id: number } | undefined
    if (agent) {
      const info = db
        .prepare(
          `UPDATE agent_api_keys SET revoked_at = ?, updated_at = ?
           WHERE agent_id = ? AND workspace_id = ? AND revoked_at IS NULL`,
        )
        .run(now, now, agent.id, workspaceId)
      revokedKeys = info.changes
    }
  } catch {
    /* key revocation is best-effort; registry removal is the hard guarantee */
  }

  const removed = deleteRuntimeByInternalId(workspaceId, id)
  return NextResponse.json({ ok: true, removed, revoked_keys: revokedKeys, runtime_id: rec.installationId })
}

export const dynamic = 'force-dynamic'
