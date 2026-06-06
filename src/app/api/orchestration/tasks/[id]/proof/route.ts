/**
 * GET  /api/orchestration/tasks/[id]/proof — list proofs attached to task
 * POST /api/orchestration/tasks/[id]/proof — runtime or operator attaches one
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { attachProof, listProofs } from '@/lib/orchestration/store'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  const taskId = Number(id)
  if (!Number.isFinite(taskId)) return NextResponse.json({ error: 'bad_task_id' }, { status: 400 })
  return NextResponse.json({ proofs: listProofs(auth.user.workspace_id, taskId) })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const taskId = Number(id)
  if (!Number.isFinite(taskId)) return NextResponse.json({ error: 'bad_task_id' }, { status: 400 })

  const body = (await request.json().catch(() => ({}))) as {
    proof_type?: string
    proof_uri?: string
    proof_sha256?: string
    metadata?: Record<string, unknown>
  }
  if (!body.proof_type) return NextResponse.json({ error: 'proof_type_required' }, { status: 400 })

  const runtimeKeyId = auth.user.id < 0 ? -auth.user.id : null
  try {
    const proof = attachProof({
      workspaceId: auth.user.workspace_id,
      taskId,
      proofType: String(body.proof_type).slice(0, 64),
      proofUri: body.proof_uri ? String(body.proof_uri).slice(0, 1024) : undefined,
      proofSha256: body.proof_sha256 ? String(body.proof_sha256).slice(0, 128) : undefined,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
      runtimeKeyId,
      userId: auth.user.id > 0 ? auth.user.id : null,
    })
    return NextResponse.json({ proof }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'attach_failed'
    const status = msg === 'runtime_key_mismatch' ? 403 : msg === 'task not found' ? 404 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
