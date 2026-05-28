'use client'

import { useState } from 'react'

/**
 * Marketplace install/hire modal — premium deployment experience.
 *
 * When the operator clicks "Hire AI Employee" or "Install Skill", we open
 * this modal which:
 *   1. Confirms the role, expected hours saved, monthly cost, integrations
 *   2. Animates through 5 deployment steps:
 *      - Provisioning workforce unit
 *      - Initializing memory layer
 *      - Attaching workflows
 *      - Queueing first assignment
 *      - Updating executive briefing
 *   3. Calls POST /api/marketplace/purchase to actually fulfill / start
 *      Stripe checkout
 *   4. On Stripe-live mode: redirects to checkout
 *      On test/mock mode: lands the operator on /app/agents with the new
 *      employee/skill visible immediately
 *
 * Operational, enterprise-feeling — no gamification, no childish FX.
 */

type ProductType = 'skill' | 'employee' | 'bundle'

interface InstallTarget {
  type: ProductType
  slug: string
  title: string
  subtitle: string
  priceLine: string
  outcome: string
  forWhom: string
  expectedHoursSaved?: string
  estimatedValueLine?: string
  requiredIntegrations?: string[]
}

const STEPS = [
  { key: 'provision', label: 'Provisioning workforce unit', detail: 'Allocating compute, identity, and audit log.' },
  { key: 'memory', label: 'Initializing memory layer', detail: 'Loading business context and SOPs.' },
  { key: 'workflows', label: 'Attaching workflows', detail: 'Wiring this employee into your daily operations.' },
  { key: 'first-task', label: 'Queueing first assignment', detail: 'Generating an introduction task you can review.' },
  { key: 'briefing', label: 'Updating executive briefing', detail: 'Workforce health, ROI, and labor savings recalculated.' },
] as const

interface State {
  status: 'idle' | 'deploying' | 'done' | 'redirecting' | 'error'
  step: number
  message?: string
  redirectUrl?: string
}

export function MarketplaceInstallModal({
  target,
  onClose,
  onComplete,
}: {
  target: InstallTarget
  onClose: () => void
  onComplete?: (slug: string) => void
}) {
  const [state, setState] = useState<State>({ status: 'idle', step: -1 })

  const startDeploy = async () => {
    setState({ status: 'deploying', step: 0 })
    // Animate the staging steps over ~3.5s while the API call runs in parallel
    const stepDuration = 700
    let cancelled = false
    const interval = setInterval(() => {
      setState((s) => {
        if (s.status !== 'deploying') return s
        const next = s.step + 1
        if (next >= STEPS.length) {
          clearInterval(interval)
          return s
        }
        return { ...s, step: next }
      })
    }, stepDuration)

    try {
      const r = await fetch('/api/marketplace/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `${target.type}-${target.slug}-${Date.now()}`,
        },
        credentials: 'include',
        body: JSON.stringify({ type: target.type, slug: target.slug }),
      })
      const data = await r.json()
      if (cancelled) return
      // Let the stages finish playing before flipping to done
      await new Promise((res) => setTimeout(res, Math.max(0, STEPS.length * stepDuration - 200)))
      clearInterval(interval)
      if (!r.ok) {
        setState({ status: 'error', step: STEPS.length - 1, message: data.error || 'Install failed.' })
        return
      }
      if (data.mode === 'stripe' && data.checkoutUrl) {
        setState({ status: 'redirecting', step: STEPS.length, redirectUrl: data.checkoutUrl })
        window.location.href = data.checkoutUrl
        return
      }
      setState({ status: 'done', step: STEPS.length })
      onComplete?.(target.slug)
    } catch (e) {
      if (cancelled) return
      clearInterval(interval)
      setState({ status: 'error', step: STEPS.length - 1, message: String(e).slice(0, 200) })
    }
  }

  const ctaLabel =
    target.type === 'employee'
      ? 'Hire AI Employee'
      : target.type === 'bundle'
      ? 'Deploy Team'
      : 'Install Skill'

  return (
    <div
      data-testid="marketplace-install-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && state.status !== 'deploying') onClose()
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
              {target.type === 'employee' ? 'Hire AI Employee' : target.type === 'bundle' ? 'Deploy Team' : 'Install Skill'}
            </p>
            <h3 className="mt-1 text-lg font-bold text-foreground">{target.title}</h3>
            <p className="text-xs text-muted-foreground">{target.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={state.status === 'deploying' || state.status === 'redirecting'}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            data-testid="install-modal-close"
          >
            ×
          </button>
        </div>

        {/* Pre-deployment summary */}
        {state.status === 'idle' && (
          <div className="mt-4 space-y-3" data-testid="install-summary">
            <Row label={target.type === 'employee' ? 'Role' : 'Capability'} value={target.outcome} />
            <Row label="For" value={target.forWhom} />
            {target.expectedHoursSaved && <Row label="Estimated time saved" value={target.expectedHoursSaved} />}
            {target.estimatedValueLine && <Row label="Estimated labor value" value={target.estimatedValueLine} />}
            <Row label={target.type === 'employee' ? 'Monthly cost' : 'One-time'} value={target.priceLine} highlight />
            {target.requiredIntegrations && target.requiredIntegrations.length > 0 && (
              <Row label="Required integrations" value={target.requiredIntegrations.join(' · ')} />
            )}

            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
              <p className="font-semibold uppercase tracking-wider text-foreground">What happens next</p>
              <ul className="mt-1 space-y-0.5">
                {STEPS.map((s) => (
                  <li key={s.key}>· {s.label}</li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={startDeploy}
              data-testid="install-deploy-button"
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {ctaLabel} →
            </button>
          </div>
        )}

        {/* Deploying stages */}
        {(state.status === 'deploying' || state.status === 'done' || state.status === 'error' || state.status === 'redirecting') && (
          <ol className="mt-5 space-y-2" data-testid="install-stages">
            {STEPS.map((s, i) => {
              const done = i < state.step || state.status === 'done' || state.status === 'redirecting'
              const active = i === state.step && state.status === 'deploying'
              return (
                <li
                  key={s.key}
                  data-testid={`install-stage-${s.key}`}
                  data-state={done ? 'done' : active ? 'active' : 'pending'}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2 transition-all duration-500 ${
                    done
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : active
                      ? 'border-primary/40 bg-primary/5 scale-[1.01]'
                      : 'border-border/40 bg-card/20 opacity-50'
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                      done ? 'bg-emerald-500/30 text-emerald-300' : active ? 'bg-primary/30 text-primary' : 'bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    {done ? (
                      <svg className="h-2.5 w-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="13 3 6 11 3 8" />
                      </svg>
                    ) : active ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${done ? 'text-emerald-300' : active ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {s.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{s.detail}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {/* Status footer */}
        {state.status === 'done' && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-200" data-testid="install-success">
            <p className="font-semibold">{target.type === 'employee' ? '✓ Welcome aboard' : '✓ Installed'}</p>
            <p className="mt-1 text-xs">
              {target.type === 'employee'
                ? 'They\u2019re in your workforce now with a first assignment queued. Visit the AI Employees panel to meet them.'
                : 'Capability attached. Your AI workforce can now use this skill.'}
            </p>
            <a
              href="/app/agents"
              className="mt-2 inline-flex rounded bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200"
              data-testid="install-success-cta"
            >
              View workforce →
            </a>
          </div>
        )}
        {state.status === 'redirecting' && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary" data-testid="install-redirecting">
            Redirecting to checkout…
          </div>
        )}
        {state.status === 'error' && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300" data-testid="install-error">
            <p className="font-semibold">Install failed</p>
            <p className="mt-1 text-xs">{state.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-right ${highlight ? 'font-bold text-primary' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}
