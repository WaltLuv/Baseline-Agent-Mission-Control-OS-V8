import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { employeeTrace } from '@/lib/baseline-os/trace-derivation'

/**
 * GET /api/agents/[slug]/trace
 *
 * Read-only "one-click employee drill-down": unified view of what this
 * AI Employee did today, what they're doing now, what memory they used,
 * what skills, who they collaborated with, what's blocked, what needs
 * approval, and trust-trajectory data.
 *
 * Workspace-scoped — never leaks across tenants.
 * Honest empty shape — returns null when no agent matches.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  const { slug } = await params
  const decoded = decodeURIComponent(slug)

  const trace = employeeTrace(workspaceId, decoded)
  if (!trace) return NextResponse.json({ trace: null }, { status: 404 })
  return NextResponse.json({ trace })
}

export const dynamic = 'force-dynamic'
