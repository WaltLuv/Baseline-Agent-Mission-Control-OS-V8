'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Workforce Activation Sequence — the cinematic moment after a new operator
 * finishes onboarding (or hits the "Activate Workforce" CTA). Plays an
 * ~8-second initialization sequence with progressive reveals and operational
 * energy, then drops the operator into the dashboard.
 *
 * Sequence:
 *   1. Mission Control Connected
 *   2. AI Workforce Online
 *   3. Daily Optimization Ready
 *   4. Memory Layer Synced
 *   5. Operator Systems Active
 *
 * Rules:
 *   - Always skippable (Esc / Skip button) — never traps the user.
 *   - Respects `prefers-reduced-motion` — collapses to a 700ms fade and
 *     skips straight to the dashboard for motion-sensitive operators.
 *   - On unrecoverable error, falls back safely to `/app/overview`.
 *   - Does NOT trigger router.refresh — no full-page reload, no demo reset.
 */
const STEPS = [
  { key: 'mc', label: 'Mission Control Connected', detail: 'Operator console online · session secured' },
  { key: 'workforce', label: 'AI Workforce Online', detail: 'Provisioning workforce units · attaching skills' },
  { key: 'optimization', label: 'Daily Optimization Ready', detail: 'Cost & routing intelligence calibrated' },
  { key: 'memory', label: 'Memory Layer Synced', detail: 'Long-term context indexed · business rules loaded' },
  { key: 'operator', label: 'Operator Systems Active', detail: 'Ready for executive command' },
] as const

export function WorkforceActivationSequence() {
  const router = useRouter()
  const params = useSearchParams()
  const source = params?.get('source') ?? 'manual'
  const reducedMotion = useReducedMotion()

  const [step, setStep] = useState(reducedMotion ? STEPS.length : 0)
  const target = useMemo(() => '/app/overview', [])

  // Esc to skip
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.push(target)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, target])

  // Sequence driver — gated, no router.refresh.
  useEffect(() => {
    if (reducedMotion) {
      const t = setTimeout(() => router.push(target), 700)
      return () => clearTimeout(t)
    }
    if (step >= STEPS.length) {
      const t = setTimeout(() => router.push(target), 900)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setStep((s) => s + 1), 1400)
    return () => clearTimeout(t)
  }, [step, router, target, reducedMotion])

  return (
    <div
      data-testid="workforce-activation-sequence"
      data-source={source}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black"
    >
      {/* Background sweep — radial pulse + scanline */}
      {!reducedMotion && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[140vmin] w-[140vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-radial from-primary/15 via-primary/5 to-transparent animate-pulse" />
          <div className="absolute inset-x-0 top-0 h-px bg-primary/40 animate-[scan_3s_linear_infinite]" />
        </div>
      )}

      {/* Skip — top right, always available */}
      <button
        type="button"
        data-testid="activation-skip"
        onClick={() => router.push(target)}
        className="absolute right-4 top-4 z-20 rounded-full border border-border/40 bg-card/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
      >
        Skip activation →
      </button>

      <div className="relative z-10 w-full max-w-xl px-6">
        <div className="text-center">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.4em] text-primary/80"
            data-testid="activation-eyebrow"
          >
            Workforce Activation · Powered by Baseline OS
          </p>
          <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
            Bringing your AI workforce online.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Securing systems, attaching skills, provisioning operator authority.
          </p>
          {source === 'setup' && (
            <p className="mt-1 text-[11px] text-emerald-400">
              Account created. Workforce initialization in progress.
            </p>
          )}
          {source === 'onboarding' && (
            <p className="mt-1 text-[11px] text-emerald-400">
              Template deployed. Workforce initialization in progress.
            </p>
          )}
        </div>

        <ol className="mt-8 space-y-2.5" data-testid="activation-steps">
          {STEPS.map((s, i) => {
            const done = i < step
            const active = i === step
            const pending = i > step
            return (
              <li
                key={s.key}
                data-testid={`activation-step-${s.key}`}
                data-state={done ? 'done' : active ? 'active' : 'pending'}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-500 ${
                  done
                    ? 'border-emerald-500/40 bg-emerald-500/5 opacity-100'
                    : active
                    ? 'border-primary/40 bg-primary/5 opacity-100 scale-[1.01]'
                    : 'border-border/40 bg-card/20 opacity-50'
                }`}
              >
                <span
                  className={`relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    done
                      ? 'bg-emerald-500/30 text-emerald-300'
                      : active
                      ? 'bg-primary/30 text-primary'
                      : 'bg-muted/40 text-muted-foreground'
                  }`}
                >
                  {done ? (
                    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="13 3 6 11 3 8" />
                    </svg>
                  ) : active ? (
                    <span className={`h-2 w-2 rounded-full bg-primary ${reducedMotion ? '' : 'animate-ping'}`} />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      done ? 'text-emerald-300' : active ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {s.label}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{s.detail}</p>
                </div>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    done ? 'text-emerald-400' : active ? 'text-primary' : 'text-muted-foreground/40'
                  }`}
                >
                  {done ? 'Online' : active ? 'Activating…' : pending ? 'Standby' : ''}
                </span>
              </li>
            )
          })}
        </ol>

        {/* Progress bar */}
        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-muted/20">
          <div
            className="h-full bg-gradient-to-r from-primary/70 via-primary to-emerald-400 transition-all duration-700 ease-out"
            style={{ width: `${(Math.min(step, STEPS.length) / STEPS.length) * 100}%` }}
            data-testid="activation-progress"
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

function useReducedMotion(): boolean {
  const [v, setV] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setV(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setV(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return v
}
