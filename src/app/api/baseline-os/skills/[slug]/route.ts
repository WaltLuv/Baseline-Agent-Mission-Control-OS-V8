import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { skillDetail } from '@/lib/baseline-os/trace-derivation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  const { slug } = await params
  const detail = skillDetail(workspaceId, decodeURIComponent(slug))
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ detail })
}

export const dynamic = 'force-dynamic'
