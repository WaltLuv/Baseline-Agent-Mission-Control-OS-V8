/**
 * GET /api/runtimes  — Phase 1-shaped list of runtimes for the calling
 * workspace. Mirrors what Baseline OS's local registry sends via
 * /api/runtime/handshake, but projects to the field shape the directive
 * specifies (runtime_id, runtime_type, status, health_score,
 * installed_tools, installed_skills, active_tasks, heartbeat_age, …).
 *
 * Mission Control supervises — does NOT host a second registry.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { runtimeRegistrySnapshot, toProjection } from '@/lib/baseline-os/runtime-registry'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  const snapshot = runtimeRegistrySnapshot(workspaceId)
  const now = Math.floor(Date.now() / 1000)
  return NextResponse.json({ runtimes: snapshot.map((r) => toProjection(r, now)), as_of: now })
}

export const dynamic = 'force-dynamic'
