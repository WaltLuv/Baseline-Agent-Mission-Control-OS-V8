import { NextRequest, NextResponse } from 'next/server'
import { requireVerifiedEmail } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import { installWorkforceTemplate } from '@/lib/baseline-os/workforce-templates/install'
import { generateOrgFromTemplate } from '@/lib/org-chart/store'
import { startReplay, recordReplayEvent, endReplay } from '@/lib/replay/store'

/**
 * POST /api/workforce/install
 *
 * One-click install of a workforce template (vertical bundle). Idempotent:
 * re-calling for the same workspace + template returns
 * { status: 'already_installed' } with the same persona + workflow IDs.
 *
 * Customer-facing: this is the surface the "Install Property Management
 * Workforce" button on the Activation Hub hits. Latency budget: 60s as
 * advertised. Real-world: < 200ms because everything is local SQLite.
 */
export async function POST(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireVerifiedEmail(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  let body: { template?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const slug = body.template?.toString().toLowerCase().trim()
  if (!slug) {
    return NextResponse.json({ error: 'template is required' }, { status: 400 })
  }

  const result = installWorkforceTemplate(
    workspaceId,
    slug,
    auth.user.username || `user:${auth.user.id}`,
  )
  if (result.status === 'unavailable') {
    return NextResponse.json(
      { error: `template "${slug}" is not available for install yet`, ...result },
      { status: 400 },
    )
  }

  // Phase 1 wiring: auto-generate the org chart for the installed workforce.
  // Idempotent — a reinstall creates 0 duplicate org nodes.
  // Phase 3 wiring: capture the whole thing as a replayable mission.
  const now = Date.now()
  let orgChart = { created: 0, skipped: 0, leadId: null as string | null }
  let replayId: string | null = null
  try {
    const replay = startReplay(workspaceId, `Install workforce: ${slug}`, `Workforce install + org generation (${slug})`, now)
    replayId = replay.id
    recordReplayEvent(workspaceId, replay.id, { ts: now, kind: 'tool_call', label: 'workforce.install', detail: slug })
    orgChart = generateOrgFromTemplate(workspaceId, slug, now)
    recordReplayEvent(workspaceId, replay.id, { ts: Date.now(), kind: 'output', label: `org chart generated: ${orgChart.created} agents`, detail: `${orgChart.skipped} existing` })
    endReplay(workspaceId, replay.id, 'completed', Date.now())
  } catch {
    /* org generation is additive — never block the install on it */
  }

  return NextResponse.json(
    {
      ...result,
      orgChart,
      replayId,
      ui: {
        message: orgChart.created > 0 ? 'Org chart generated' : 'Org chart already up to date',
        agentsCreated: orgChart.created,
        openOrgChart: '/app/org-chart',
      },
    },
    { status: result.status === 'installed' ? 201 : 200 },
  )
}

export const dynamic = 'force-dynamic'
