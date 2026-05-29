'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Dynamic Workflow Demo (Swarm Mode) — simulated walk-through of the
 * five-stage supervision contract, framed against the real product
 * architecture:
 *
 *   Operator → Mission Control → Baseline OS → {Hermes,
 *              OpenClaw/OpenCode, Claude Code} → External systems
 *
 * Mission Control supervises. Baseline OS coordinates. Hermes,
 * OpenClaw/OpenCode and Claude Code execute. This panel is not a
 * generic agent framework — it shows Baseline OS routing one mission
 * across those three runtimes as first-class participants.
 *
 * Demo-grade data only; the production orchestrator is documented in
 * docs/architecture/DYNAMIC_WORKFLOWS.md.
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

/**
 * The three first-class runtimes Baseline OS coordinates. The
 * orchestrator (and any judge) is itself a Mission Control concern,
 * not a runtime.
 */
type RuntimeLane = 'hermes' | 'openclaw' | 'claude' | 'mission-control'

const LANE_LABELS: Record<RuntimeLane, string> = {
  hermes: 'Hermes',
  openclaw: 'OpenClaw / OpenCode',
  claude: 'Claude Code',
  'mission-control': 'Mission Control',
}

interface SwarmAgent {
  id: string
  /** Display label for the participant (e.g. "Hermes \u2014 Strategy"). */
  name: string
  /** Which runtime owns this work in the demo architecture. */
  lane: RuntimeLane
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
      { id: 'hermes-strategy', name: 'Hermes \u2014 Strategy', lane: 'hermes', role: 'Memory + plan', output: 'Recalled 14 prior follow-up wins; drafted 4-touch cadence (0h, 24h, 72h, 7d). Warm-signal = 2 opens + 1 site visit OR direct reply.' },
      { id: 'openclaw-data', name: 'OpenClaw \u2014 Data wiring', lane: 'openclaw', role: 'CRM + integrations', output: 'Mapped inbound source \u2192 contact record; dedup by phone + email; staged in lead pipeline.' },
      { id: 'claude-copy', name: 'Claude Code \u2014 Sequence drafts', lane: 'claude', role: 'Copy generation', output: 'Wrote 4 SMS + 4 email variants, A/B groups, opt-out compliant per TCPA.' },
      { id: 'opencode-workflow', name: 'OpenCode \u2014 Workflow wiring', lane: 'openclaw', role: 'Trigger orchestration', output: 'Wired lead.created \u2192 cadence.start; cadence.complete \u2192 rep.handoff in Baseline OS.' },
      { id: 'mc-judge', name: 'Mission Control \u2014 Verification judge', lane: 'mission-control', role: 'Acceptance proof', output: 'Verified opt-out, dedupe, warm-signal handoff. Flagged: no fallback when rep offline > 4h.' },
      { id: 'mc-launch', name: 'Mission Control \u2014 Launch supervisor', lane: 'mission-control', role: 'Go-live + approvals', output: 'Generated 11-item launch checklist; held approval for SMS provider switch.' },
    ],
    verification: [
      { question: 'Does the system capture every inbound lead?', verdict: 'pass', detail: 'Two intake paths covered (web form + inbound voice).' },
      { question: 'Is opt-out compliant?', verdict: 'pass', detail: 'STOP / HELP keywords supported per TCPA.' },
      { question: 'Is there a fallback when no rep is available?', verdict: 'attention', detail: 'Add overflow voicemail to manager after 4h idle.' },
    ],
    deliverables: ['4-touch cadence', 'Compliant copy variants', 'Baseline OS workflow', 'Mission Control approval queue', '11-item launch checklist'],
  },
  {
    id: 'audit-repo',
    label: 'Inspect this repo and identify production blockers',
    prompt: 'Inspect this repo and identify production blockers. Group findings by severity and propose the smallest safe slice to ship first.',
    agents: [
      { id: 'hermes-recall', name: 'Hermes \u2014 Memory recall', lane: 'hermes', role: 'Prior runs + decisions', output: 'Surfaced 3 prior audits; flagged 2 recurring \u201cgateway-not-local\u201d findings now resolved.' },
      { id: 'claude-code-audit', name: 'Claude Code \u2014 Static audit', lane: 'claude', role: 'tsc + lint + tests', output: 'tsc 0 errors, eslint 0 errors, vitest 1205/1205. Two files > 800 lines (refactor candidates).' },
      { id: 'openclaw-security', name: 'OpenClaw \u2014 Security audit', lane: 'openclaw', role: 'Cookies, hosts, secrets', output: 'Preflight enforces MC_COOKIE_SECURE, MC_ALLOWED_HOSTS without wildcards, gateway local-only.' },
      { id: 'openclaw-db', name: 'OpenClaw \u2014 Database audit', lane: 'openclaw', role: 'Schema + migrations', output: 'SQLite WAL; forward-only migrations under src/lib/migrations.' },
      { id: 'mc-judge', name: 'Mission Control \u2014 Verification judge', lane: 'mission-control', role: 'Acceptance proof', output: 'All acceptance criteria green. One backlog item: native Dynamic Workflow backend.' },
    ],
    verification: [
      { question: 'Is the deployment package complete?', verdict: 'pass', detail: '.do/app.yaml + deploy workflow + runbooks + preflight in place.' },
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
      { id: 'hermes-strategy', name: 'Hermes \u2014 Outcome map', lane: 'hermes', role: 'Plan + memory', output: 'Defined 4 outcomes: weekly visits, event fill rate, low-stock alerts, review count.' },
      { id: 'openclaw-data', name: 'OpenClaw \u2014 Member model', lane: 'openclaw', role: 'Data + integrations', output: 'Member tier, last visit, favorite SKUs, opt-in channels.' },
      { id: 'openclaw-inventory', name: 'OpenClaw \u2014 Inventory + alerts', lane: 'openclaw', role: 'Threshold + reorder', output: 'Below-par threshold per SKU; alert + reorder suggestion.' },
      { id: 'claude-copy', name: 'Claude Code \u2014 Member messaging', lane: 'claude', role: 'Sequences + RSVPs', output: 'Wrote loyalty cadence, event RSVP confirmations (48h + 1h reminders), review nudges.' },
      { id: 'claude-voice', name: 'Claude Code \u2014 VoiceOps script', lane: 'claude', role: 'Voice + SMS flow', output: 'Wired RSVP via SMS short-code; opt-in capture during checkout.' },
      { id: 'mc-judge', name: 'Mission Control \u2014 Verification judge', lane: 'mission-control', role: 'Acceptance proof', output: 'Verified opt-in, frequency caps, member privacy. No PII leakage in short URLs.' },
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
      <header className="space-y-3">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Swarm Mode &middot; Baseline OS Orchestration</div>
        <h1 className="text-2xl font-semibold">Assign a mission. Watch Baseline OS coordinate Hermes, OpenClaw, and Claude Code.</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Mission Control supervises. Baseline OS coordinates. Hermes, OpenClaw / OpenCode, and
          Claude Code execute. One operator mission becomes a plan, fans across the three
          runtimes as first-class participants, runs verification judges before completion,
          and persists the result with full memory and approval trail.
        </p>
        <div className="rounded-md border border-border bg-card/30 p-3 text-[11px] text-foreground/80" data-testid="workflow-architecture">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Architecture</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono">
            <span>Operator</span><span className="text-muted-foreground">&rarr;</span>
            <span className="text-primary">Mission Control</span><span className="text-muted-foreground">&rarr;</span>
            <span className="text-primary">Baseline OS</span><span className="text-muted-foreground">&rarr;</span>
            <span>Hermes</span><span className="text-muted-foreground">+</span>
            <span>OpenClaw / OpenCode</span><span className="text-muted-foreground">+</span>
            <span>Claude Code</span><span className="text-muted-foreground">&rarr;</span>
            <span>External systems</span>
          </div>
        </div>
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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${
                      a.lane === 'hermes' ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' :
                      a.lane === 'openclaw' ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' :
                      a.lane === 'claude' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' :
                      'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    }`} data-testid={`workflow-agent-lane-${a.id}`}>{LANE_LABELS[a.lane]}</span>
                    <span className="font-medium">{a.name}</span>
                  </div>
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
