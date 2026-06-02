'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RuntimeConnectWizard } from './runtime-connect-wizard'
import { InviteTeamStep } from './invite-team-step'
import { WorkforceInstaller } from './workforce-installer'

// Activation Hub — the post-signup customer journey.
//
// Steps:
//   1. Connect a Runtime          (RuntimeConnectWizard)
//   2. Install Your First System  (already done in /onboarding — shown as ✓)
//   3. Invite Your Team           (InviteTeamStep)
//
// The hub never dumps the user into the raw dashboard. After all three
// steps the operator gets a single, clear "Go to Mission Control" CTA.

type StepId = 'runtime' | 'system' | 'invite'
type StepState = 'pending' | 'active' | 'done' | 'skipped'

const STEPS: Array<{ id: StepId; title: string; subtitle: string }> = [
  { id: 'system', title: 'Install your first system', subtitle: 'AI employees + skills + a 5-minute starter task — pre-configured for your business.' },
  { id: 'runtime', title: 'Connect a runtime', subtitle: 'Plug Claude / Codex / OpenClaw / Hermes into Mission Control with one command.' },
  { id: 'invite', title: 'Invite your team', subtitle: 'Bring in operators and admins so the platform is more than a personal tool.' },
]

export function ActivationHub() {
  const router = useRouter()
  const [state, setState] = useState<Record<StepId, StepState>>({
    // The "Install your first system" step is now a real, clickable
    // workforce installer (Property Management today, others soon). We
    // start it as 'active' so the customer sees the catalog immediately.
    // The check in the useEffect below flips it to 'done' if the workspace
    // already has a workforce template installed.
    system: 'active',
    runtime: 'pending',
    invite: 'pending',
  })
  const [workspaceId, setWorkspaceId] = useState<number | null>(null)
  const [workspaceName, setWorkspaceName] = useState<string>('')

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.workspace_id) setWorkspaceId(d.user.workspace_id as number)
      })
      .catch(() => {})
    fetch('/api/workspaces', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const ws = d?.workspaces?.[0]
        if (ws?.name) setWorkspaceName(String(ws.name))
      })
      .catch(() => {})
    // If a workforce template is already installed, advance past the
    // install step so returning customers don't see the catalog again.
    fetch('/api/workforce/templates', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const installed = (d?.templates || []).some((t: { install_state?: { installed?: boolean } }) => t.install_state?.installed)
        if (installed) setStepState('system', 'done')
      })
      .catch(() => {})
  }, [])

  const completed = Object.values(state).filter((s) => s === 'done').length
  const total = STEPS.length
  const percent = Math.round((completed / total) * 100)

  function setStepState(id: StepId, s: StepState) {
    setState((prev) => {
      const next = { ...prev, [id]: s }
      // Auto-advance to the next pending step IF nothing is currently active.
      const order: StepId[] = ['system', 'runtime', 'invite']
      const hasActive = order.some((step) => next[step] === 'active')
      if (!hasActive) {
        const upcoming = order.find((step) => next[step] === 'pending')
        if (upcoming) next[upcoming] = 'active'
      }
      return next
    })
  }

  const allDone = completed === total

  // Safeguard: if no step is active and not all done, activate the next pending.
  // (Covers the case where async detection on mount races with onComplete callbacks.)
  useEffect(() => {
    const order: StepId[] = ['system', 'runtime', 'invite']
    const hasActive = order.some((step) => state[step] === 'active')
    if (!hasActive && !allDone) {
      const upcoming = order.find((step) => state[step] === 'pending')
      if (upcoming) setState((prev) => ({ ...prev, [upcoming]: 'active' }))
    }
  }, [state, allDone])

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] antialiased" data-testid="activation-hub">
      <header className="border-b border-white/[0.06] backdrop-blur-xl bg-[#09090b]/70">
        <div className="mx-auto max-w-screen-md px-6 h-16 flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <span>Baseline Mission Control</span>
          </Link>
          <Link href="/help" className="text-sm text-white/55 hover:text-white">
            Need help?
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-screen-md px-6 py-12">
        {/* Welcome + workspace summary */}
        <section className="mb-8" data-testid="activation-welcome">
          <p className="text-xs uppercase tracking-wider text-violet-300/80 font-mono mb-2">
            Welcome to Mission Control
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            {workspaceName ? <>Three steps to activate <span className="text-violet-300">{workspaceName}</span>.</> : <>Three steps to activate your workspace.</>}
          </h1>
          <p className="mt-3 text-white/55 leading-relaxed">
            We pre-configured your AI workforce when you signed up. Finish these three quick steps and you'll be running real work in under 10 minutes.
          </p>
        </section>

        {/* Progress */}
        <section className="mb-6" data-testid="activation-progress-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-white/45 font-mono">Activation progress</span>
            <span className="text-xs text-white/65 font-mono" data-testid="activation-progress-text">
              {completed} of {total} complete
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full bg-violet-500 transition-all duration-500"
              style={{ width: `${percent}%` }}
              data-testid="activation-progress-bar"
            />
          </div>
        </section>

        {/* Step list */}
        <section className="space-y-3 mb-10">
          {STEPS.map((step, idx) => {
            const s = state[step.id]
            return (
              <div
                key={step.id}
                data-testid={`activation-step-${step.id}`}
                data-state={s}
                className={`rounded-xl border p-5 transition-colors ${
                  s === 'active'
                    ? 'border-violet-400/40 bg-violet-500/[0.04]'
                    : s === 'done'
                    ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
                    : s === 'skipped'
                    ? 'border-white/[0.06] bg-white/[0.01] opacity-70'
                    : 'border-white/[0.06] bg-white/[0.02]'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`shrink-0 mt-0.5 w-7 h-7 rounded-full grid place-items-center text-xs font-semibold border ${
                      s === 'done'
                        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                        : s === 'active'
                        ? 'bg-violet-500/20 border-violet-400/40 text-violet-100'
                        : s === 'skipped'
                        ? 'bg-white/[0.04] border-white/[0.08] text-white/40'
                        : 'bg-white/[0.04] border-white/[0.08] text-white/50'
                    }`}
                  >
                    {s === 'done' ? '✓' : s === 'skipped' ? '–' : idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-white">{step.title}</h3>
                    <p className="text-sm text-white/55 mt-0.5">{step.subtitle}</p>
                    {step.id === 'system' && s === 'done' && (
                      <p className="text-xs text-emerald-200/70 font-mono mt-2" data-testid="step-system-summary">
                        ✓ Workforce installed · starter tasks queued
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </section>

        {/* Active step body */}
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6" data-testid="activation-active-step">
          {state.system === 'active' && (
            <WorkforceInstaller
              onComplete={() => setStepState('system', 'done')}
              onSkip={() => setStepState('system', 'skipped')}
            />
          )}
          {state.runtime === 'active' && (
            <RuntimeConnectWizard
              onComplete={() => setStepState('runtime', 'done')}
              onSkip={() => setStepState('runtime', 'skipped')}
            />
          )}
          {state.invite === 'active' && workspaceId !== null && (
            <InviteTeamStep
              workspaceId={workspaceId}
              onComplete={() => setStepState('invite', 'done')}
              onSkip={() => setStepState('invite', 'skipped')}
            />
          )}
          {allDone && (
            <div className="text-center space-y-4 py-4" data-testid="activation-complete">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-1.5 text-sm text-emerald-200 font-medium">
                Activation complete
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">Your AI workforce is live.</h2>
              <p className="text-white/55 max-w-md mx-auto">
                A starter task is queued. Open Mission Control to see your employees pick it up.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  data-testid="activation-go-to-mc"
                  onClick={() => router.push('/app/overview')}
                  className="h-10 px-5 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90"
                >
                  Open Mission Control →
                </button>
                <Link
                  href="/help"
                  data-testid="activation-help-link"
                  className="h-10 px-5 rounded-lg bg-white/[0.06] text-white/80 text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1] flex items-center"
                >
                  Visit Help Center
                </Link>
              </div>
            </div>
          )}
          {state.system !== 'active' && state.runtime !== 'active' && state.invite !== 'active' && !allDone && (
            <div className="text-center py-6 text-white/45 text-sm" data-testid="activation-idle">
              No active step. Skipped steps can be resumed any time from the dashboard.
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
