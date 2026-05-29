'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Dynamic Workflow Demo (Swarm Mode) — a simulated, deterministic walk
 * through the five orchestration stages: Command, Plan, Swarm, Verify,
 * Keep. Demo-grade data only; the real backend orchestrator is
 * documented separately in docs/architecture/DYNAMIC_WORKFLOWS.md and
 * lives in the backlog.
 *
 * The component is purely client-side and has no API dependency. It
 * exists to make the Dynamic Workflow concept visible inside the demo
 * without committing to the persistence + agent execution surface
 * before that backend is implemented.
 */

type Stage = 'idle' | 'command' | 'plan' | 'swarm' | 'verify' | 'keep'

const STAGE_ORDER: Stage[] = ['command', 'plan', 'swarm', 'verify', 'keep']

const STAGE_LABELS: Record<Stage, string> = {
  idle: 'Idle',
  command: 'Command',
  plan: 'Plan',
  swarm: 'Swarm',
  verify: 'Verify',
  keep: 'Keep',
}

interface SwarmAgent {
  id: string
  name: string
  role: string
  status: 'queued' | 'running' | 'verified' | 'flagged'
  output: string
}

interface MissionTemplate {
  id: string
  label: string
  prompt: string
  agents: Omit<SwarmAgent, 'status'>[]
  verification: { question: string; verdict: 'pass' | 'attention'; detail: string }[]
  deliverables: string[]
}

const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id: 'sales-followup',
    label: 'Sales follow-up for a local service business',
    prompt: 'Build a sales follow-up system for a local service business that captures every inbound lead, runs a 4-touch cadence, hands off to a human rep on warm signal, and reports weekly.',
    agents: [
      { id: 'strategy', name: 'Strategy Agent', role: 'Architect the system', output: 'Drafted 4-touch cadence (0h, 24h, 72h, 7d). Defined warm-signal threshold = 2 opens + 1 site visit OR direct reply.' },
      { id: 'crm', name: 'CRM Agent', role: 'Map data + integrations', output: 'Maps inbound source \u2192 contact record, sets stage=lead, deduplicates by phone + email.' },
      { id: 'copy', name: 'Copywriting Agent', role: 'Draft sequences', output: 'Wrote 4 SMS + 4 email variants, A/B groups, opt-out compliant.' },
      { id: 'workflow', name: 'Workflow Builder Agent', role: 'Wire automations', output: 'Wired triggers in Mission Control: lead.created \u2192 cadence.start; cadence.complete \u2192 rep.handoff.' },
      { id: 'qa', name: 'QA Judge Agent', role: 'Verify acceptance', output: 'Verified opt-out, dedupe, warm-signal handoff. Flagged: no fallback if rep is offline > 4h.' },
      { id: 'launch', name: 'Launch Checklist Agent', role: 'Prep go-live', output: 'Generated 11-item launch checklist with owners and SLA.' },
    ],
    verification: [
      { question: 'Does the system capture every inbound lead?', verdict: 'pass', detail: 'Two intake paths covered (web form + inbound voice).' },
      { question: 'Is opt-out compliant?', verdict: 'pass', detail: 'STOP / HELP keywords supported per TCPA.' },
      { question: 'Is there a fallback when no rep is available?', verdict: 'attention', detail: 'Add overflow voicemail to manager after 4h idle.' },
    ],
    deliverables: ['4-touch cadence', 'Compliant copy variants', 'Mission Control workflow', '11-item launch checklist'],
  },
  {
    id: 'audit-repo',
    label: 'Inspect this repo and identify production blockers',
    prompt: 'Inspect this repo and identify production blockers. Group findings by severity and propose the smallest safe slice to ship first.',
    agents: [
      { id: 'code', name: 'Code Auditor', role: 'Static + tests', output: 'tsc 0 errors, eslint 0 errors, vitest 1187/1187. Two high-watermark files > 800 lines.' },
      { id: 'security', name: 'Security Auditor', role: 'Cookies, hosts, secrets', output: 'Preflight enforces MC_COOKIE_SECURE, MC_ALLOWED_HOSTS, gateway local-only.' },
      { id: 'db', name: 'Database Auditor', role: 'Schema + migrations', output: 'SQLite WAL, forward-only migrations under src/lib/migrations.' },
      { id: 'ux', name: 'UI/UX Auditor', role: 'Demo flow & language', output: 'Homepage AI Workforce OS aligned; verticals strip lists 9; demo flow verified end-to-end.' },
      { id: 'qa', name: 'Verification Judge', role: 'Acceptance proof', output: 'All acceptance criteria green. One backlog item: native Dynamic Workflow backend.' },
    ],
    verification: [
      { question: 'Is deployment package complete?', verdict: 'pass', detail: '.do/app.yaml + deploy workflow + runbooks + preflight in place.' },
      { question: 'Are core flows preserved?', verdict: 'pass', detail: 'Share preset, guest demo, watermark, runtime validation panel all green.' },
      { question: 'Are there destructive changes?', verdict: 'pass', detail: 'All changes additive; existing tests untouched.' },
    ],
    deliverables: ['Audit report', 'Production launch checklist', 'Preflight + runtime harness scripts'],
  },
  {
    id: 'cigar-retail',
    label: 'AI workforce for a cigar lounge / local retail',
    prompt: 'Build an AI employee team for a cigar lounge. Cover member loyalty, event RSVPs, inventory alerts, and post-visit review nudges.',
    agents: [
      { id: 'strategy', name: 'Strategy Agent', role: 'Outcome map', output: 'Defined 4 outcomes: weekly visits, event fill rate, low-stock alerts, review count.' },
      { id: 'crm', name: 'CRM Agent', role: 'Member model', output: 'Member tier, last visit, favorite SKUs, opt-in channels.' },
      { id: 'voice', name: 'VoiceOps Agent', role: 'Inbound + RSVP', output: 'Wired RSVP via SMS short-code, 48h reminder, 1h reminder.' },
      { id: 'inventory', name: 'Operations Agent', role: 'Low-stock alerts', output: 'Below-par threshold per SKU; alert + reorder suggestion.' },
      { id: 'review', name: 'Review Request Agent', role: 'Post-visit nudge', output: 'Triggered 2h after visit; review-link short URL; sentiment routing.' },
      { id: 'qa', name: 'QA Judge Agent', role: 'Verify', output: 'Verified opt-in, frequency caps, member privacy. No PII leakage in URLs.' },
    ],
    verification: [
      { question: 'Are messages frequency-capped?', verdict: 'pass', detail: 'Max 2/week per member.' },
      { question: 'Is PII excluded from short URLs?', verdict: 'pass', detail: 'Opaque token \u2192 server-side resolve.' },
      { question: 'Is the inventory alert actionable?', verdict: 'attention', detail: 'Add supplier auto-email for top 5 SKUs.' },
    ],
    deliverables: ['Member loyalty cadence', 'Event RSVP flow', 'Low-stock alert workflow', 'Review nudge sequence'],
  },
]

interface RunState {
  template: MissionTemplate
  stage: Stage
  agents: SwarmAgent[]
  startedAt: number
}

const STAGE_DURATIONS: Record<Stage, number> = {
  idle: 0,
  command: 600,
  plan: 1200,
  swarm: 3000,
  verify: 1800,
  keep: 800,
}

export function DynamicWorkflowDemo() {
  const [missionInput, setMissionInput] = useState('')
  const [run, setRun] = useState<RunState | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  function clearTimers() {
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current = []
  }

  useEffect(() => () => clearTimers(), [])

  function startMission(template: MissionTemplate) {
    clearTimers()
    setMissionInput(template.prompt)
    const initial: RunState = {
      template,
      stage: 'command',
      agents: template.agents.map((a) => ({ ...a, status: 'queued' })),
      startedAt: Date.now(),
    }
    setRun(initial)

    // Schedule deterministic stage transitions for the demo.
    let cumulative = 0
    STAGE_ORDER.forEach((s, idx) => {
      cumulative += STAGE_DURATIONS[s]
      const t = setTimeout(() => {
        setRun((prev) => {
          if (!prev) return prev
          const next = STAGE_ORDER[idx + 1] ?? 'keep'
          let agents = prev.agents
          if (s === 'swarm') {
            agents = agents.map((a) => ({ ...a, status: 'running' as const }))
          }
          if (s === 'verify') {
            agents = agents.map((a, i) => ({
              ...a,
              status: i === agents.length - 2 ? 'flagged' as const : 'verified' as const,
            }))
          }
          return { ...prev, stage: next, agents }
        })
      }, cumulative)
      timersRef.current.push(t)
    })
  }

  function resetMission() {
    clearTimers()
    setMissionInput('')
    setRun(null)
  }

  const currentStage = run?.stage ?? 'idle'
  const currentTemplate = run?.template

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6" data-testid="dynamic-workflow-demo">
      <header className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Swarm Mode &middot; Dynamic Workflow</div>
        <h1 className="text-2xl font-semibold">One mission &rarr; many specialist agents</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Enter a single plain-English mission. Mission Control breaks it into a plan, fans the work
          out to a swarm of specialist AI employees, runs verification judges before completion,
          and persists the result. This panel shows a simulated walk-through &mdash; the native
          orchestration engine ships as a follow-up.
        </p>
      </header>

      {/* ── Mission input + templates ──────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card/40 p-4 space-y-3" data-testid="workflow-input">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground" htmlFor="mission-input">Mission</label>
        <textarea
          id="mission-input"
          value={missionInput}
          onChange={(e) => setMissionInput(e.target.value)}
          placeholder="e.g. Build a sales follow-up system for a local service business..."
          rows={3}
          data-testid="workflow-mission-input"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
        />
        <div className="flex flex-wrap gap-2">
          {MISSION_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`workflow-template-${t.id}`}
              onClick={() => startMission(t)}
              className="rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-foreground/80 hover:bg-card"
            >
              {t.label}
            </button>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={resetMission}
            data-testid="workflow-reset"
            className="ml-auto"
          >
            Reset
          </Button>
        </div>
      </section>

      {/* ── Stage tracker ──────────────────────────────────────────── */}
      <section className="flex items-center gap-2" data-testid="workflow-stages">
        {STAGE_ORDER.map((s, i) => {
          const reached = STAGE_ORDER.indexOf(currentStage) >= i
          const active = currentStage === s
          return (
            <div key={s} className="flex flex-1 items-center gap-2" data-testid={`workflow-stage-${s}`} data-active={active}>
              <div className={`h-2 w-2 rounded-full ${reached ? 'bg-primary' : 'bg-muted-foreground/30'}`} aria-hidden />
              <span className={`text-xs uppercase tracking-wider ${active ? 'text-primary' : reached ? 'text-foreground' : 'text-muted-foreground'}`}>
                {STAGE_LABELS[s]}
              </span>
              {i < STAGE_ORDER.length - 1 && <div className={`h-px flex-1 ${reached ? 'bg-primary/40' : 'bg-muted-foreground/20'}`} />}
            </div>
          )
        })}
      </section>

      {!run && (
        <div className="rounded-md border border-dashed border-border bg-card/20 p-8 text-center text-sm text-muted-foreground" data-testid="workflow-empty">
          Pick a mission template above to watch the swarm assemble.
        </div>
      )}

      {/* ── Swarm map ───────────────────────────────────────────────── */}
      {run && (
        <section className="space-y-3" data-testid="workflow-swarm">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Swarm &middot; {run.agents.length} specialist agents</div>
          <div className="grid gap-2 md:grid-cols-2">
            {run.agents.map((a) => (
              <div
                key={a.id}
                data-testid={`workflow-agent-${a.id}`}
                data-status={a.status}
                className="rounded-md border border-border bg-card/40 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{a.name}</span>
                  <span className={`text-[10px] uppercase tracking-wider ${
                    a.status === 'verified' ? 'text-emerald-400' :
                    a.status === 'flagged' ? 'text-amber-400' :
                    a.status === 'running' ? 'text-primary' :
                    'text-muted-foreground'
                  }`}>{a.status}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{a.role}</div>
                {(currentStage === 'verify' || currentStage === 'keep') && (
                  <div className="mt-2 text-[12px] text-foreground/80">{a.output}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Verification ───────────────────────────────────────────── */}
      {run && (currentStage === 'verify' || currentStage === 'keep') && (
        <section className="rounded-lg border border-border bg-card/40 p-4 space-y-2" data-testid="workflow-verification">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Verification judges</div>
          {currentTemplate?.verification.map((v, i) => (
            <div key={i} className="flex items-start gap-3 text-sm" data-testid={`workflow-verification-${i}`}>
              <span className={`mt-1 inline-block h-2 w-2 rounded-full ${v.verdict === 'pass' ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden />
              <div>
                <div className="font-medium">{v.question}</div>
                <div className="text-xs text-muted-foreground">{v.detail}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Keep / deliverables ────────────────────────────────────── */}
      {run && currentStage === 'keep' && currentTemplate && (
        <section className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 space-y-2" data-testid="workflow-deliverables">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300">Persisted to workspace</div>
          <ul className="list-disc pl-5 text-sm">
            {currentTemplate.deliverables.map((d) => <li key={d}>{d}</li>)}
          </ul>
          <div className="pt-2 text-xs text-muted-foreground">
            Every run lives in <code className="rounded bg-muted px-1 py-0.5">workflow_runs</code> with its plan, swarm, judge results, and final summary.
            Risky actions (file mutations, deploys, billing changes) gate on operator approval before being persisted.
          </div>
        </section>
      )}
    </div>
  )
}

export default DynamicWorkflowDemo

// Exported for unit testing — pure data + helpers.
export { MISSION_TEMPLATES, STAGE_ORDER, STAGE_LABELS }
export type { MissionTemplate, SwarmAgent, Stage }
