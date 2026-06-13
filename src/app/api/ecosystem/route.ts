/**
 * GET /api/ecosystem — ecosystem app integration model (resolved per workspace
 * env config) + browser action counts. viewer+. The execution layer (api /
 * browser / visible-only) and the iframe shells read this. No fake connected
 * states — status is derived from configured URLs only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { ECOSYSTEM_APPS, resolveEcosystemApp, resolveExecutionMode } from '@/lib/ecosystem/apps'
import { listBrowserActions } from '@/lib/ecosystem/browser-actions'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const apps = ECOSYSTEM_APPS.map((app) => {
    const resolved = resolveEcosystemApp(app)
    const actions = listBrowserActions(app.id)
    return {
      id: resolved.id,
      name: resolved.name,
      description: resolved.description,
      note: resolved.note ?? null,
      iframeUrl: resolved.iframeUrl,
      hasApi: resolved.hasApi,
      allowedDomains: resolved.allowedDomains,
      executionModesAvailable: resolved.executionModesAvailable,
      defaultExecutionMode: resolved.defaultExecutionMode,
      resolvedExecutionMode: resolveExecutionMode(resolved),
      status: resolved.status,
      setupNeeded: resolved.setupNeeded,
      proofSupported: resolved.proofSupported,
      replaySupported: resolved.replaySupported,
      agentAccess: resolved.agentAccess,
      browserActions: actions.map((a) => ({ actionId: a.actionId, description: a.description, requiredPermission: a.requiredPermission, approvalRequired: a.approvalRequired })),
    }
  })
  return NextResponse.json({ apps })
}
