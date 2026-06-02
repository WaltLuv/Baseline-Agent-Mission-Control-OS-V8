import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { listTemplates } from '@/lib/baseline-os/workforce-templates/catalog'
import { listInstalledTemplates, getInstallStatus } from '@/lib/baseline-os/workforce-templates/install'

/**
 * GET /api/workforce/templates
 *   Returns the catalog (Property Management deep, others "coming soon")
 *   along with each template's installed state for the calling workspace.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  const installed = new Set(listInstalledTemplates(workspaceId))
  const templates = listTemplates().map((t) => {
    const detail = installed.has(t.slug) ? getInstallStatus(workspaceId, t.slug) : { installed: false, meta: null }
    return {
      slug: t.slug,
      vertical: t.vertical,
      headline: t.headline,
      tagline: t.tagline,
      install_seconds: t.install_seconds,
      status: t.status,
      persona_count: t.personas.length,
      workflow_count: t.workflows.length,
      tool_count: t.tools.length,
      personas: t.personas.map(({ slug, name, role, description }) => ({ slug, name, role, description })),
      workflows: t.workflows.map(({ slug, title, description, approval_policy, owner_persona }) => ({
        slug,
        title,
        description,
        approval_policy,
        owner_persona,
      })),
      tools: t.tools,
      approval_summary: t.approval_summary,
      install_state: detail,
    }
  })
  return NextResponse.json({ templates })
}

export const dynamic = 'force-dynamic'
