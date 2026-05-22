import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { enrichAgentConfigFromWorkspace } from '@/lib/agent-sync'

/**
 * Derive an operating-style label and icon from the agent's role.
 */
function deriveOperatingStyle(role: string): { label: string; icon: string; description: string } {
  const r = role.toLowerCase()
  if (r.includes('operator') || r.includes('orchestrat')) {
    return { label: 'Orchestrator', icon: '◈', description: 'Coordinates tasks, delegates to specialists, manages workflows.' }
  }
  if (r.includes('research') || r.includes('analyst') || r.includes('investigator')) {
    return { label: 'Analytical', icon: '◇', description: 'Deep analysis, data synthesis, evidence-based reasoning.' }
  }
  if (r.includes('assistant') || r.includes('helper') || r.includes('support')) {
    return { label: 'Helpful', icon: '◉', description: 'Task execution, user requests, quick turnarounds.' }
  }
  if (r.includes('review') || r.includes('qa') || r.includes('quality') || r.includes('audit')) {
    return { label: 'Quality-focused', icon: '◆', description: 'Code review, quality checks, standards enforcement.' }
  }
  if (r.includes('security') || r.includes('guard') || r.includes('shield')) {
    return { label: 'Guardian', icon: '⬡', description: 'Security scanning, threat detection, policy enforcement.' }
  }
  if (r.includes('deploy') || r.includes('release') || r.includes('ops')) {
    return { label: 'Operations', icon: '⬢', description: 'Infrastructure, deployment pipelines, system reliability.' }
  }
  return { label: 'Generalist', icon: '○', description: 'Versatile agent handling diverse task types.' }
}

/**
 * Generate summon-phrase examples from agent name and operating style.
 */
function generateSummonPhrases(name: string, style: string): string[] {
  const firstName = name.split(/\s+/)[0]
  const phrases: Record<string, string[]> = {
    Orchestrator: [
      `"${firstName}, orchestrate a plan for {task}."`,
      `"${firstName}, give me the CEO read on {topic}."`,
      `"${firstName}, delegate {task} to the right agent."`,
    ],
    Analytical: [
      `"${firstName}, deep-dive into {topic}."`,
      `"${firstName}, analyze {data} and flag patterns."`,
      `"${firstName}, what's the evidence for {claim}?"`,
    ],
    Helpful: [
      `"${firstName}, help me with {task}."`,
      `"${firstName}, quick handle on {topic}."`,
      `"${firstName}, take care of {task} now."`,
    ],
    'Quality-focused': [
      `"${firstName}, review {code} for quality."`,
      `"${firstName}, audit {deliverable} before release."`,
      `"${firstName}, check {output} against standards."`,
    ],
    Guardian: [
      `"${firstName}, scan {target} for vulnerabilities."`,
      `"${firstName}, assess security posture for {project}."`,
    ],
    Operations: [
      `"${firstName}, deploy {service} to production."`,
      `"${firstName}, check health of {system}."`,
    ],
    Generalist: [
      `"${firstName}, handle {task}."`,
      `"${firstName}, give me a read on {topic}."`,
    ],
  }
  return phrases[style] || phrases.Generalist
}

/**
 * GET /api/agents/[id]/persona - Get enhanced persona data for an agent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const db = getDatabase()
    const { id } = await params
    const workspaceId = auth.user.workspace_id ?? 1

    // Fetch agent
    let agent: any
    if (isNaN(Number(id))) {
      agent = db.prepare('SELECT * FROM agents WHERE name = ? AND workspace_id = ?').get(id, workspaceId)
    } else {
      agent = db.prepare('SELECT * FROM agents WHERE id = ? AND workspace_id = ?').get(Number(id), workspaceId)
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const config = agent.config ? enrichAgentConfigFromWorkspace(JSON.parse(agent.config)) : {}

    // ── Mission statement from soul_content ──
    const missionStatement = (agent.soul_content as string) || null

    // ── Operating style derived from role ──
    const operatingStyle = deriveOperatingStyle(agent.role)

    // ── Summon phrases ──
    const summonPhrases = generateSummonPhrases(agent.name, operatingStyle.label)

    // ── Model preferences from config ──
    const modelPrefs = (() => {
      const primary = config.model?.primary
      const fallback = config.model?.fallback
      const primaryName = typeof primary === 'string' ? primary : primary?.primary || null
      const fallbackName = typeof fallback === 'string' ? fallback : fallback?.primary || null
      return {
        primary: primaryName,
        fallback: fallbackName,
      }
    })()

    // ── Assigned skills (from config) ──
    const assignedSkills = (() => {
      const tools = config.tools
      if (Array.isArray(tools)) {
        return tools
          .filter((t: any) => typeof t === 'object' && t.enabled !== false)
          .map((t: any) => t.name || t.id || String(t))
      }
      if (config.skills && Array.isArray(config.skills)) {
        return config.skills
      }
      return [] as string[]
    })()

    // ── Trust score ──
    const trustRow = db.prepare(
      'SELECT trust_score, auth_failures, injection_attempts, rate_limit_hits, secret_exposures, successful_tasks, failed_tasks, last_anomaly_at FROM agent_trust_scores WHERE agent_name = ? AND workspace_id = ?'
    ).get(agent.name, workspaceId) as
      | { trust_score: number; auth_failures: number; injection_attempts: number; rate_limit_hits: number; secret_exposures: number; successful_tasks: number; failed_tasks: number; last_anomaly_at: number | null }
      | undefined

    const trustScore = trustRow
      ? {
          score: trustRow.trust_score,
          authFailures: trustRow.auth_failures,
          injectionAttempts: trustRow.injection_attempts,
          rateLimitHits: trustRow.rate_limit_hits,
          secretExposures: trustRow.secret_exposures,
          successfulTasks: trustRow.successful_tasks,
          failedTasks: trustRow.failed_tasks,
          lastAnomalyAt: trustRow.last_anomaly_at,
        }
      : {
          score: 1.0,
          authFailures: 0,
          injectionAttempts: 0,
          rateLimitHits: 0,
          secretExposures: 0,
          successfulTasks: 0,
          failedTasks: 0,
          lastAnomalyAt: null,
        }

    // ── Workload (in_progress tasks count) ──
    const workloadRow = db.prepare(
      "SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ? AND status = 'in_progress' AND workspace_id = ?"
    ).get(agent.name, workspaceId) as { count: number }
    const workload = workloadRow?.count ?? 0

    // ── Credits used (from usage_events) ──
    const creditsRow = db.prepare(
      'SELECT COALESCE(SUM(retail_cost_cents), 0) as total_cents, COALESCE(SUM(credits_charged), 0) as total_credits, COUNT(*) as event_count FROM usage_events WHERE agent_id = ? AND workspace_id = ?'
    ).get(agent.id, workspaceId) as { total_cents: number; total_credits: number; event_count: number }
    const creditsUsed = {
      totalCents: creditsRow?.total_cents ?? 0,
      totalCredits: creditsRow?.total_credits ?? 0,
      eventCount: creditsRow?.event_count ?? 0,
    }

    // ── Quality trend (approval rate from quality_reviews linked to agent's tasks) ──
    const qualityRow = db.prepare(`
      SELECT
        COUNT(*) as total_reviews,
        SUM(CASE WHEN qr.status IN ('approved', 'passed', 'accepted') THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN qr.status IN ('rejected', 'failed', 'needs_revision') THEN 1 ELSE 0 END) as rejected
      FROM quality_reviews qr
      JOIN tasks t ON t.id = qr.task_id
      WHERE t.assigned_to = ? AND t.workspace_id = ?
    `).get(agent.name, workspaceId) as { total_reviews: number; approved: number; rejected: number } | undefined
    const totalReviews = qualityRow?.total_reviews ?? 0
    const approvedReviews = qualityRow?.approved ?? 0
    const rejectedReviews = qualityRow?.rejected ?? 0
    const qualityTrend = totalReviews > 0
      ? {
          approvalRate: Math.round((approvedReviews / totalReviews) * 100),
          totalReviews,
          approvedReviews,
          rejectedReviews,
        }
      : { approvalRate: null, totalReviews: 0, approvedReviews: 0, rejectedReviews: 0 }

    // ── Last activity ──
    const lastActivity = (agent.last_activity as string) || null
    const lastSeen = (agent.last_seen as number) || null

    return NextResponse.json({
      persona: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        status: agent.status,
        missionStatement,
        operatingStyle,
        summonPhrases,
        modelPrefs,
        assignedSkills,
        trustScore,
        workload,
        creditsUsed,
        qualityTrend,
        lastActivity,
        lastSeen,
        createdAt: agent.created_at,
        updatedAt: agent.updated_at,
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/agents/[id]/persona error')
    return NextResponse.json({ error: 'Failed to fetch agent persona' }, { status: 500 })
  }
}
