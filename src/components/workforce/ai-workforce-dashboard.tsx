'use client'

import { useMemo, useState } from 'react'
import {
  DEPARTMENTS,
  AI_EMPLOYEES,
  SKILL_PACKS,
  VERTICAL_TEMPLATES,
  ACTIVE_WORKFLOWS,
  BUSINESS_OUTCOMES,
  employeesByDepartment,
  type DepartmentId,
  type VerticalId,
  type EmployeeStatus,
} from '@/lib/ai-workforce-taxonomy'

/**
 * AI Workforce Dashboard — the single executive surface that proves
 * Mission Control supervises an AI workforce, not a property-management
 * tool. Pure data + UI; no API dependency.
 */

const STATUS_DOT: Record<EmployeeStatus, string> = {
  working: 'bg-emerald-500',
  idle: 'bg-muted-foreground/40',
  'needs-attention': 'bg-amber-500',
  offline: 'bg-rose-500/70',
}

function Pill({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'primary' | 'amber' | 'emerald' }) {
  const map: Record<string, string> = {
    muted: 'border-border bg-muted/30 text-foreground/70',
    primary: 'border-primary/30 bg-primary/10 text-primary',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${map[tone]}`}>
      {children}
    </span>
  )
}

function SectionHeader({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground" data-testid={`workforce-section-${kicker.replace(/\s+/g, '-').toLowerCase()}`}>{kicker}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {sub && <p className="text-sm text-muted-foreground max-w-2xl">{sub}</p>}
    </div>
  )
}

export function AiWorkforceDashboard() {
  const [selectedVertical, setSelectedVertical] = useState<VerticalId>('pm')

  const vertical = useMemo(
    () => VERTICAL_TEMPLATES.find((v) => v.id === selectedVertical),
    [selectedVertical],
  )

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-6" data-testid="ai-workforce-dashboard">
      <header className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">AI Workforce OS</div>
        <h1 className="text-3xl font-semibold">Workforce Dashboard</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          One executive command center for AI employees, AI skills, AI teams, workflows, and
          measurable business outcomes &mdash; across every vertical Mission Control supervises.
        </p>
      </header>

      {/* ── Business outcomes ──────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4" data-testid="workforce-outcomes">
        {BUSINESS_OUTCOMES.map((o) => (
          <div key={o.id} className="rounded-lg border border-border bg-card/40 p-4" data-testid={`workforce-outcome-${o.id}`}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{o.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-semibold">{o.value}</span>
              {o.trend === 'up' && <span className="text-xs text-emerald-400">&uarr;</span>}
              {o.trend === 'down' && <span className="text-xs text-rose-400">&darr;</span>}
            </div>
          </div>
        ))}
      </section>

      {/* ── Departments ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          kicker="Departments"
          title="Where your AI workforce reports"
          sub="Same departments your human team works in &mdash; vertical-agnostic."
        />
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4" data-testid="workforce-departments">
          {DEPARTMENTS.map((d) => {
            const count = employeesByDepartment(d.id).length
            return (
              <div key={d.id} className="rounded-lg border border-border bg-card/40 p-3" data-testid={`workforce-dept-${d.id}`}>
                <div className="font-medium">{d.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{d.description}</div>
                <div className="mt-3"><Pill>{count} agent{count === 1 ? '' : 's'}</Pill></div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── AI Employee Directory ──────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          kicker="AI Employees"
          title="Your AI workforce roster"
          sub="Roles, departments, assigned skills, and what each employee is working on right now."
        />
        <div className="grid gap-3 md:grid-cols-2" data-testid="workforce-employees">
          {AI_EMPLOYEES.map((e) => (
            <article key={e.id} className="rounded-lg border border-border bg-card/40 p-4" data-testid={`workforce-employee-${e.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[e.status]}`} aria-hidden />
                    <span className="font-medium">{e.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{e.role}</div>
                </div>
                <Pill tone={e.status === 'needs-attention' ? 'amber' : e.status === 'working' ? 'emerald' : 'muted'}>
                  {e.status}
                </Pill>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Department</div>
                  <div>{DEPARTMENTS.find((d) => d.id === e.department)?.name}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Workflow</div>
                  <div>{e.currentWorkflow || <span className="text-muted-foreground">\u2014</span>}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {e.skills.map((s) => <Pill key={s}>{s}</Pill>)}
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                {e.lastActivity}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Active workflows (mini-Kanban) ─────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          kicker="Active Workflows"
          title="Work in motion right now"
          sub="A live snapshot of workflows your AI workforce is moving forward."
        />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="workforce-workflows">
          {ACTIVE_WORKFLOWS.map((w) => (
            <div key={w.id} className="rounded-lg border border-border bg-card/40 p-3" data-testid={`workforce-workflow-${w.id}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{w.title}</span>
                <Pill tone={w.status === 'needs-approval' ? 'amber' : w.status === 'completed' ? 'emerald' : 'muted'}>
                  {w.status}
                </Pill>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {DEPARTMENTS.find((d) => d.id === w.department)?.name} &middot;{' '}
                {VERTICAL_TEMPLATES.find((v) => v.id === w.vertical)?.name}
              </div>
              <div className="mt-2 text-[11px] text-foreground/80">
                {w.assignedAgents.join(' \u00b7 ')}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Vertical templates ─────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          kicker="Vertical Templates"
          title="Pre-built AI workforces by business"
          sub="Property Management is one vertical &mdash; the same operating system supports nine more."
        />
        <div className="flex flex-wrap gap-2" data-testid="workforce-vertical-picker">
          {VERTICAL_TEMPLATES.map((v) => (
            <button
              key={v.id}
              type="button"
              data-testid={`workforce-vertical-btn-${v.id}`}
              onClick={() => setSelectedVertical(v.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                selectedVertical === v.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card/40 text-foreground/70 hover:bg-card'
              }`}
            >
              <span aria-hidden className="mr-1">{v.icon}</span>{v.name}
            </button>
          ))}
        </div>
        {vertical && (
          <article className="rounded-lg border border-border bg-card/40 p-5" data-testid={`workforce-vertical-detail-${vertical.id}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden>{vertical.icon}</span>
              <div>
                <h3 className="text-lg font-semibold">{vertical.name}</h3>
                <div className="text-xs text-muted-foreground">Vertical template &middot; installed for the demo workspace</div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Installed AI Employees</div>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {vertical.installedEmployees.map((e) => <li key={e}>{e}</li>)}
                </ul>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Installed Skills</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {vertical.installedSkills.map((s) => <Pill key={s}>{s}</Pill>)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Workflows</div>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {vertical.workflows.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Expected outcomes</div>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {vertical.outcomes.map((o) => <li key={o}>{o}</li>)}
                </ul>
              </div>
            </div>
          </article>
        )}
      </section>

      {/* ── Installed Skills Registry ──────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          kicker="Skills Registry"
          title="Skill packs installable in any vertical"
          sub="The marketplace catalog projected as a skills registry. Installed packs are live; available ones are one click away."
        />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="workforce-skill-packs">
          {SKILL_PACKS.map((s) => (
            <article key={s.id} className="rounded-lg border border-border bg-card/40 p-4" data-testid={`workforce-skill-${s.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg" aria-hidden>{s.icon}</span>
                  <span className="font-medium">{s.name}</span>
                </div>
                <Pill tone={s.status === 'installed' ? 'emerald' : 'muted'}>{s.status}</Pill>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{s.description}</p>
              <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                Used by {s.employees.length} employee{s.employees.length === 1 ? '' : 's'} &middot;{' '}
                supports {s.verticals.length} vertical{s.verticals.length === 1 ? '' : 's'}
              </div>
            </article>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Browse the full catalog at <code className="rounded bg-muted px-1 py-0.5">/marketplace</code>.
        </p>
      </section>

      <footer className="pt-4 text-xs text-muted-foreground">
        Need a tailored prospect demo? Open <code className="rounded bg-muted px-1 py-0.5">/app/share?vertical=&lt;id&gt;&amp;prospect=&lt;name&gt;</code>.
      </footer>
    </div>
  )
}

export default AiWorkforceDashboard
