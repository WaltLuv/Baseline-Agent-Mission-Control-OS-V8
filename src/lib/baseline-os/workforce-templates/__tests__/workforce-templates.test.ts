/**
 * Workforce Template installer regression tests.
 *
 * Covers:
 *  - Catalog returns the 8-vertical list with Property Management 'ready'
 *    and the other 7 'coming_soon' (Walt's directive).
 *  - Installing Property Management creates 6 personas + 12 tasks.
 *  - Re-installing is idempotent — same row IDs, no duplicates.
 *  - Coming-soon templates refuse to install.
 *  - Audit + activity rows land for both install + reinstall.
 */
import { describe, it, expect, beforeAll } from 'vitest'

process.env.MC_DISABLE_RATE_LIMIT = '1'

import { GET as templatesGET } from '@/app/api/workforce/templates/route'
import { POST as installPOST } from '@/app/api/workforce/install/route'
import { POST as signupPOST } from '@/app/api/auth/signup/route'
import { getDatabase } from '@/lib/db'
import '@/lib/migrations'
import { runMigrations } from '@/lib/migrations'

async function adminSession(): Promise<{ cookie: string; workspaceId: number }> {
  const ts = Date.now() + Math.floor(Math.random() * 10000)
  const res = await signupPOST(
    new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.${ts % 250}.${(ts >> 8) % 250}` },
      body: JSON.stringify({
        email: `wf_${ts}@acme.test`,
        password: 'CorrectHorseBattery42',
        full_name: 'Workforce Tester',
        company_name: `WorkforceCo ${ts}`,
        business_type: 'pm',
      }),
    }),
  )
  expect(res.status).toBe(200)
  const data = (await res.json()) as { workspace: { id: number } }
  const setCookie = res.headers.get('set-cookie') || ''
  const m = setCookie.match(/(?:mc-session|__Secure-mc-session)=([^;]+)/i)
  if (!m) throw new Error('no session cookie')
  // Email-verify the user so the verification gate on /api/workforce/install
  // (a sensitive action) admits this admin.
  getDatabase().prepare('UPDATE users SET email_verified_at = unixepoch() WHERE email = ?').run(`wf_${ts}@acme.test`)
  return { cookie: `mc-session=${m[1]}`, workspaceId: data.workspace.id }
}

function authedReq(cookie: string, url: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${url}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', cookie, ...(init.headers || {}) },
  })
}

describe('Workforce Templates — catalog + installer', () => {
  beforeAll(() => {
    runMigrations(getDatabase())
  })

  // Phase 3 — Production Vertical Completion: 11 verticals, ALL production-ready.
  // No coming_soon shells appear in the customer-facing catalog.
  it('catalog: exactly 11 production-ready verticals, zero coming-soon shells', async () => {
    const { cookie } = await adminSession()
    const res = await templatesGET(authedReq(cookie, '/api/workforce/templates') as never)
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      templates: Array<{ slug: string; vertical: string; status: string; persona_count: number; workflow_count: number }>
    }
    const EXPECTED = [
      'property-management', 'insurance', 'ai-product-launch',
      'real-estate', 'mortgage', 'cpa', 'law-firm',
      'general-contractor', 'home-services', 'marketing-agency', 'ai-agency',
    ]
    expect(data.templates.length).toBe(EXPECTED.length)
    for (const slug of EXPECTED) {
      const t = data.templates.find((x) => x.slug === slug)
      expect(t, `missing vertical ${slug}`).toBeDefined()
    }
    // Every visible template is ready and meets the production minimum bar.
    for (const t of data.templates) {
      expect(t.status, `${t.slug} not ready`).toBe('ready')
      expect(t.persona_count, `${t.slug} <6 personas`).toBeGreaterThanOrEqual(6)
      expect(t.workflow_count, `${t.slug} <10 workflows`).toBeGreaterThanOrEqual(10)
    }
    // No coming-soon anywhere.
    expect(data.templates.some((t) => t.status === 'coming_soon')).toBe(false)
  })

  // Agency split — Marketing Agency and AI Agency are distinct verticals.
  it('agency split: marketing-agency and ai-agency are separate, no generic "agency"', async () => {
    const { cookie } = await adminSession()
    const res = await templatesGET(authedReq(cookie, '/api/workforce/templates') as never)
    const data = (await res.json()) as { templates: Array<{ slug: string; vertical: string }> }
    const mktg = data.templates.find((t) => t.slug === 'marketing-agency')!
    const ai = data.templates.find((t) => t.slug === 'ai-agency')!
    expect(mktg).toBeDefined()
    expect(ai).toBeDefined()
    expect(mktg.vertical).toBe('Marketing Agencies')
    expect(ai.vertical).toBe('AI Agencies')
    expect(data.templates.some((t) => t.slug === 'agency')).toBe(false)
  })

  // Each new vertical installs to real personas + tasks, idempotently.
  it.each(['real-estate', 'mortgage', 'cpa', 'law-firm', 'general-contractor', 'home-services', 'marketing-agency', 'ai-agency'])(
    'installs %s with 6 personas + 10+ tasks, idempotently',
    async (slug) => {
      const { cookie, workspaceId } = await adminSession()
      const first = await installPOST(
        authedReq(cookie, '/api/workforce/install', { method: 'POST', body: JSON.stringify({ template: slug }) }) as never,
      )
      expect(first.status).toBe(201)
      const data = (await first.json()) as { status: string; personas: unknown[]; workflows: unknown[] }
      expect(data.status).toBe('installed')
      expect(data.personas.length).toBe(6)
      expect(data.workflows.length).toBeGreaterThanOrEqual(10)
      const db = getDatabase()
      const agents = db.prepare(`SELECT COUNT(*) n FROM agents WHERE workspace_id=? AND source=?`).get(workspaceId, `workforce-template:${slug}`) as { n: number }
      expect(agents.n).toBe(6)
      // reinstall → idempotent
      const second = await installPOST(
        authedReq(cookie, '/api/workforce/install', { method: 'POST', body: JSON.stringify({ template: slug }) }) as never,
      )
      expect(second.status).toBe(200)
      const data2 = (await second.json()) as { status: string }
      expect(data2.status).toBe('already_installed')
      const agentsAfter = db.prepare(`SELECT COUNT(*) n FROM agents WHERE workspace_id=? AND source=?`).get(workspaceId, `workforce-template:${slug}`) as { n: number }
      expect(agentsAfter.n).toBe(6) // no duplicates
    },
  )

  // Every vertical defines a non-empty approval matrix (all four tiers present).
  it('every vertical has a complete approval matrix + required credentials', async () => {
    const { cookie } = await adminSession()
    const res = await templatesGET(authedReq(cookie, '/api/workforce/templates') as never)
    const data = (await res.json()) as {
      templates: Array<{ slug: string; approval_summary: { auto: string[]; medium: string[]; high: string[]; blocked: string[] }; tools: Array<{ state: string }> }>
    }
    for (const t of data.templates) {
      expect(t.approval_summary.high.length, `${t.slug} no high-approval gate`).toBeGreaterThan(0)
      expect(t.approval_summary.blocked.length, `${t.slug} no blocked actions`).toBeGreaterThan(0)
      // at least one credential to connect (required credentials surface)
      expect(t.tools.some((x) => x.state === 'needs_connect'), `${t.slug} no required credentials`).toBe(true)
    }
  })

  it('install Property Management creates 6 personas + 12 tasks + audit rows', async () => {
    const { cookie, workspaceId } = await adminSession()
    const res = await installPOST(
      authedReq(cookie, '/api/workforce/install', {
        method: 'POST',
        body: JSON.stringify({ template: 'property-management' }),
      }) as never,
    )
    expect(res.status).toBe(201)
    const data = (await res.json()) as {
      status: string
      personas: Array<unknown>
      workflows: Array<unknown>
      tools: Array<unknown>
      deep_links: Record<string, string>
    }
    expect(data.status).toBe('installed')
    expect(data.personas.length).toBe(6)
    expect(data.workflows.length).toBe(12)
    expect(data.tools.length).toBeGreaterThanOrEqual(10)
    expect(data.deep_links.tasks).toBe('/app/tasks')

    const db = getDatabase()
    const agents = db
      .prepare(
        `SELECT COUNT(*) as n FROM agents WHERE workspace_id = ? AND source = ?`,
      )
      .get(workspaceId, 'workforce-template:property-management') as { n: number }
    expect(agents.n).toBe(6)
    const tasks = db
      .prepare(
        `SELECT COUNT(*) as n FROM tasks
         WHERE workspace_id = ? AND metadata LIKE '%"workforce_template":"property-management"%'`,
      )
      .get(workspaceId) as { n: number }
    expect(tasks.n).toBe(12)
    const audit = db
      .prepare(
        `SELECT COUNT(*) as n FROM audit_log
         WHERE action = 'workforce_template_installed' AND target_type = 'workforce_template'`,
      )
      .get() as { n: number }
    expect(audit.n).toBeGreaterThanOrEqual(1)
  })

  it('reinstall is idempotent: no duplicates, status="already_installed"', async () => {
    const { cookie, workspaceId } = await adminSession()
    await installPOST(
      authedReq(cookie, '/api/workforce/install', {
        method: 'POST',
        body: JSON.stringify({ template: 'property-management' }),
      }) as never,
    )
    const res2 = await installPOST(
      authedReq(cookie, '/api/workforce/install', {
        method: 'POST',
        body: JSON.stringify({ template: 'property-management' }),
      }) as never,
    )
    expect(res2.status).toBe(200)
    const data = (await res2.json()) as { status: string; personas: Array<{ id: number }>; workflows: Array<{ id: number }> }
    expect(data.status).toBe('already_installed')
    expect(data.personas.length).toBe(6)
    expect(data.workflows.length).toBe(12)

    const db = getDatabase()
    const dupAgents = db
      .prepare(
        `SELECT COUNT(*) as n FROM agents
         WHERE workspace_id = ? AND source = 'workforce-template:property-management'`,
      )
      .get(workspaceId) as { n: number }
    expect(dupAgents.n).toBe(6) // still 6, not 12
    const dupTasks = db
      .prepare(
        `SELECT COUNT(*) as n FROM tasks
         WHERE workspace_id = ? AND metadata LIKE '%"workforce_template":"property-management"%'`,
      )
      .get(workspaceId) as { n: number }
    expect(dupTasks.n).toBe(12) // still 12, not 24
  })

  it('unknown / non-catalog templates refuse to install', async () => {
    const { cookie } = await adminSession()
    const res = await installPOST(
      authedReq(cookie, '/api/workforce/install', {
        method: 'POST',
        body: JSON.stringify({ template: 'nonexistent-vertical' }),
      }) as never,
    )
    expect(res.status).toBe(400)
    const data = (await res.json()) as { error?: string; status?: string }
    // install route returns either {status:'unavailable'} or an error for unknown slugs
    expect(data.status === 'unavailable' || !!data.error).toBe(true)
  })

  it('every workflow has owner_persona pointing to a real persona slug', async () => {
    const { cookie } = await adminSession()
    const res = await templatesGET(authedReq(cookie, '/api/workforce/templates') as never)
    const data = (await res.json()) as {
      templates: Array<{
        slug: string
        personas: Array<{ slug: string }>
        workflows: Array<{ owner_persona: string }>
      }>
    }
    for (const slug of ['property-management', 'insurance', 'ai-product-launch']) {
      const tmpl = data.templates.find((t) => t.slug === slug)!
      const personaSlugs = new Set(tmpl.personas.map((p) => p.slug))
      for (const w of tmpl.workflows) {
        expect(personaSlugs.has(w.owner_persona)).toBe(true)
      }
    }
  })

  it('Insurance template installs 6 personas + the seeded task count Walt specified', async () => {
    const { cookie, workspaceId } = await adminSession()
    const res = await installPOST(
      authedReq(cookie, '/api/workforce/install', {
        method: 'POST',
        body: JSON.stringify({ template: 'insurance' }),
      }) as never,
    )
    expect(res.status).toBe(201)
    const data = (await res.json()) as {
      status: string
      personas: Array<unknown>
      workflows: Array<{ slug: string; title: string }>
    }
    expect(data.status).toBe('installed')
    expect(data.personas.length).toBe(6)

    // 12 workflows with demo_seed_count of: 4+4+5+3+1+1+4+1+2+1+1+1 = 28 task instances.
    expect(data.workflows.length).toBe(28)

    const db = getDatabase()
    const agents = db
      .prepare(
        `SELECT COUNT(*) as n FROM agents WHERE workspace_id = ? AND source = ?`,
      )
      .get(workspaceId, 'workforce-template:insurance') as { n: number }
    expect(agents.n).toBe(6)

    // demo_seed_count > 1 → individually addressable task instances.
    const claimIntakeRows = db
      .prepare(
        `SELECT COUNT(*) as n FROM tasks
         WHERE workspace_id = ? AND metadata LIKE '%"workforce_workflow_slug":"ins-wf-new-claim-intake#%'`,
      )
      .get(workspaceId) as { n: number }
    expect(claimIntakeRows.n).toBe(4) // demo_seed_count: 4

    const docCollectionRows = db
      .prepare(
        `SELECT COUNT(*) as n FROM tasks
         WHERE workspace_id = ? AND metadata LIKE '%"workforce_workflow_slug":"ins-wf-doc-collection#%'`,
      )
      .get(workspaceId) as { n: number }
    expect(docCollectionRows.n).toBe(5) // demo_seed_count: 5

    // Workflows without demo_seed_count keep the original slug (no '#') for backward compat.
    const coverageVerifRows = db
      .prepare(
        `SELECT COUNT(*) as n FROM tasks
         WHERE workspace_id = ? AND metadata LIKE '%"workforce_workflow_slug":"ins-wf-coverage-verification"%'`,
      )
      .get(workspaceId) as { n: number }
    expect(coverageVerifRows.n).toBe(1)
  })

  it('Insurance reinstall is idempotent across seeded instances', async () => {
    const { cookie, workspaceId } = await adminSession()
    await installPOST(
      authedReq(cookie, '/api/workforce/install', {
        method: 'POST',
        body: JSON.stringify({ template: 'insurance' }),
      }) as never,
    )
    const res2 = await installPOST(
      authedReq(cookie, '/api/workforce/install', {
        method: 'POST',
        body: JSON.stringify({ template: 'insurance' }),
      }) as never,
    )
    expect(res2.status).toBe(200)
    const db = getDatabase()
    const total = db
      .prepare(
        `SELECT COUNT(*) as n FROM tasks
         WHERE workspace_id = ? AND metadata LIKE '%"workforce_template":"insurance"%'`,
      )
      .get(workspaceId) as { n: number }
    expect(total.n).toBe(28) // unchanged after reinstall
  })

  it('Insurance approval_summary covers AUTO / MEDIUM / HIGH / BLOCKED tiers (Walt’s spec)', async () => {
    const { cookie } = await adminSession()
    const res = await templatesGET(authedReq(cookie, '/api/workforce/templates') as never)
    const data = (await res.json()) as {
      templates: Array<{
        slug: string
        approval_summary: { auto: string[]; medium: string[]; high: string[]; blocked: string[] }
      }>
    }
    const ins = data.templates.find((t) => t.slug === 'insurance')!
    expect(ins.approval_summary.auto.length).toBeGreaterThan(0)
    expect(ins.approval_summary.medium.length).toBeGreaterThan(0)
    expect(ins.approval_summary.high.length).toBeGreaterThan(0)
    expect(ins.approval_summary.blocked.length).toBeGreaterThan(0)
    // High-risk tier names the customer-facing claim updates path Walt called out.
    expect(ins.approval_summary.high.join(' ')).toMatch(/claim/i)
    // Blocked tier denies unauthorized claim approval/denial.
    expect(ins.approval_summary.blocked.join(' ')).toMatch(/unauthorized claim/i)
  })

  it('AI Product Launch template installs 8 personas + the seeded task count Walt specified', async () => {
    const { cookie, workspaceId } = await adminSession()
    const res = await installPOST(
      authedReq(cookie, '/api/workforce/install', {
        method: 'POST',
        body: JSON.stringify({ template: 'ai-product-launch' }),
      }) as never,
    )
    expect(res.status).toBe(201)
    const data = (await res.json()) as {
      status: string
      personas: Array<unknown>
      workflows: Array<{ slug: string; title: string }>
    }
    expect(data.status).toBe('installed')
    expect(data.personas.length).toBe(8)

    // 12 workflows with demo_seed_count of: 5+1+1+1+4+1+1+2+3+2+3+2 = 26 task instances.
    expect(data.workflows.length).toBe(26)

    const db = getDatabase()
    const agents = db
      .prepare(
        `SELECT COUNT(*) as n FROM agents WHERE workspace_id = ? AND source = ?`,
      )
      .get(workspaceId, 'workforce-template:ai-product-launch') as { n: number }
    expect(agents.n).toBe(8)

    // Per-slug seed densities match Walt's spec.
    const counts: Record<string, number> = {}
    for (const slug of [
      'ipt-wf-idea-intake',
      'ipt-wf-fullstack-scaffold',
      'ipt-wf-stripe-checkout',
      'ipt-wf-qa-test-sweep',
      'ipt-wf-deployment-env',
      'ipt-wf-seo-landing',
      'ipt-wf-github-export',
    ]) {
      const row = db
        .prepare(
          `SELECT COUNT(*) as n FROM tasks
           WHERE workspace_id = ? AND metadata LIKE ?`,
        )
        .get(workspaceId, `%"workforce_workflow_slug":"${slug}#%`) as { n: number }
      counts[slug] = row.n
    }
    expect(counts['ipt-wf-idea-intake']).toBe(5)
    expect(counts['ipt-wf-fullstack-scaffold']).toBe(4)
    expect(counts['ipt-wf-stripe-checkout']).toBe(2)
    expect(counts['ipt-wf-qa-test-sweep']).toBe(3)
    expect(counts['ipt-wf-deployment-env']).toBe(2)
    expect(counts['ipt-wf-seo-landing']).toBe(3)
    expect(counts['ipt-wf-github-export']).toBe(2)

    // Single-instance workflows still keep the bare slug (no '#').
    const singleSlug = db
      .prepare(
        `SELECT COUNT(*) as n FROM tasks
         WHERE workspace_id = ? AND metadata LIKE '%"workforce_workflow_slug":"ipt-wf-market-research"%'`,
      )
      .get(workspaceId) as { n: number }
    expect(singleSlug.n).toBe(1)
  })

  it('AI Product Launch reinstall is idempotent (28 task instances stay 28… wait, 26)', async () => {
    const { cookie, workspaceId } = await adminSession()
    await installPOST(
      authedReq(cookie, '/api/workforce/install', {
        method: 'POST',
        body: JSON.stringify({ template: 'ai-product-launch' }),
      }) as never,
    )
    const res2 = await installPOST(
      authedReq(cookie, '/api/workforce/install', {
        method: 'POST',
        body: JSON.stringify({ template: 'ai-product-launch' }),
      }) as never,
    )
    expect(res2.status).toBe(200)
    const db = getDatabase()
    const total = db
      .prepare(
        `SELECT COUNT(*) as n FROM tasks
         WHERE workspace_id = ? AND metadata LIKE '%"workforce_template":"ai-product-launch"%'`,
      )
      .get(workspaceId) as { n: number }
    expect(total.n).toBe(26)
  })

  it('AI Product Launch approval_summary covers all four risk tiers per Walt\'s spec verbatim', async () => {
    const { cookie } = await adminSession()
    const res = await templatesGET(authedReq(cookie, '/api/workforce/templates') as never)
    const data = (await res.json()) as {
      templates: Array<{
        slug: string
        approval_summary: { auto: string[]; medium: string[]; high: string[]; blocked: string[] }
      }>
    }
    const apl = data.templates.find((t) => t.slug === 'ai-product-launch')!
    expect(apl.approval_summary.auto.length).toBeGreaterThan(0)
    expect(apl.approval_summary.medium.length).toBeGreaterThan(0)
    expect(apl.approval_summary.high.length).toBeGreaterThan(0)
    expect(apl.approval_summary.blocked.length).toBeGreaterThan(0)
    // High tier names the production deploy + Stripe pricing + push to main path Walt specified.
    const high = apl.approval_summary.high.join(' ').toLowerCase()
    expect(high).toContain('production deployment')
    expect(high).toContain('stripe pricing')
    expect(high).toContain('push to main')
    expect(high).toContain('customer-facing launch')
    // Blocked tier denies unauthorized customer-charging and production DB deletion.
    const blocked = apl.approval_summary.blocked.join(' ').toLowerCase()
    expect(blocked).toContain('deleting production database')
    expect(blocked).toContain('charging customers without approval')
  })

  it('AI Product Launch template avoids every forbidden marketing claim Walt named', async () => {
    const { cookie } = await adminSession()
    const res = await templatesGET(authedReq(cookie, '/api/workforce/templates') as never)
    const data = (await res.json()) as {
      templates: Array<{
        slug: string
        headline: string
        tagline: string
        personas: Array<{ description: string }>
        workflows: Array<{ description: string; success_criteria: string }>
      }>
    }
    const apl = data.templates.find((t) => t.slug === 'ai-product-launch')!
    // Roll every customer-facing string in the template into one haystack.
    const haystack = [
      apl.headline,
      apl.tagline,
      ...apl.personas.map((p) => p.description),
      ...apl.workflows.flatMap((w) => [w.description, w.success_criteria]),
    ].join(' \n ').toLowerCase()

    const forbiddenPhrases = [
      'guaranteed revenue',
      'guaranteed seo',
      'guaranteed ranking',
      'guaranteed success',
      'no bugs ever',
      'fully autonomous',
      'fully automatic launch',
      'deployment always works',
    ]
    for (const phrase of forbiddenPhrases) {
      expect(haystack).not.toContain(phrase)
    }
  })
})
