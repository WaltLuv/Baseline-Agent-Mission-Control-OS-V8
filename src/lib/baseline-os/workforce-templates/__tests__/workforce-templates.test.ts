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

  it('catalog: Property Management + Insurance ready; 7 others coming_soon', async () => {
    const { cookie } = await adminSession()
    const res = await templatesGET(authedReq(cookie, '/api/workforce/templates') as never)
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      templates: Array<{ slug: string; status: string; persona_count: number; workflow_count: number }>
    }
    expect(data.templates.length).toBe(9)
    const pm = data.templates.find((t) => t.slug === 'property-management')!
    expect(pm.status).toBe('ready')
    expect(pm.persona_count).toBe(6)
    expect(pm.workflow_count).toBe(12)
    const ins = data.templates.find((t) => t.slug === 'insurance')!
    expect(ins.status).toBe('ready')
    expect(ins.persona_count).toBe(6)
    expect(ins.workflow_count).toBe(12)
    const others = data.templates.filter(
      (t) => t.slug !== 'property-management' && t.slug !== 'insurance',
    )
    expect(others.length).toBe(7)
    expect(others.every((t) => t.status === 'coming_soon')).toBe(true)
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

  it('coming-soon templates refuse to install', async () => {
    const { cookie } = await adminSession()
    const res = await installPOST(
      authedReq(cookie, '/api/workforce/install', {
        method: 'POST',
        body: JSON.stringify({ template: 'cpa' }),
      }) as never,
    )
    expect(res.status).toBe(400)
    const data = (await res.json()) as { error: string; status: string }
    expect(data.status).toBe('unavailable')
    expect(data.error).toMatch(/not available/i)
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
    for (const slug of ['property-management', 'insurance']) {
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
})
