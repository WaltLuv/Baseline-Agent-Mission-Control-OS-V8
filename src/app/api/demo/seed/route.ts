/**
 * POST /api/demo/seed → one-click Demo Mode: seed a populated PM workspace.
 * GET  /api/demo/seed → current demo data counts + credential mode.
 * operator+ to seed. Workspace-scoped, idempotent.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { seedDemo, demoStatus } from '@/lib/pm/demo-seed'
import { credentialChecklist } from '@/lib/pm/comms'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return NextResponse.json({ status: demoStatus(auth.user.workspace_id ?? 1), credentials: credentialChecklist() })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const result = await seedDemo(auth.user.workspace_id ?? 1, Date.now())
  return NextResponse.json({ ok: true, seeded: result, credentials: credentialChecklist() }, { status: 201 })
}
