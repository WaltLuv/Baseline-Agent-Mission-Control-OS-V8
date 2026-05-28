import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { skillsInventory } from '@/lib/baseline-os/trace-derivation'

/**
 * GET /api/baseline-os/skills-inventory
 *
 * Live, derived view of which skills are actually being used across the
 * AI Workforce in this workspace. Reads only from `usage_events`. No
 * fabrication — when there's no usage, returns `{ skills: [] }` and the
 * UI surfaces an honest empty state.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  const skills = skillsInventory(workspaceId)
  return NextResponse.json({ skills })
}

export const dynamic = 'force-dynamic'
