'use client'

/**
 * BaselineSystemIdentityStrip — single-row, calm, persistent reminder of
 * what each layer of the system does. Keeps customer mental model clean:
 *
 *   Mission Control (supervision) ← Baseline OS (intelligence) ← AI Workforce (execution)
 *
 * Rendered once at the top of `/app/overview`. Not noisy, not animated,
 * not interactive. It's the executive-software equivalent of the
 * "Powered by" footer — present but never in the way.
 */
export function BaselineSystemIdentityStrip() {
  return (
    <div
      data-testid="baseline-identity-strip"
      className="flex flex-wrap items-center gap-2 rounded-full border border-border/30 bg-card/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground"
    >
      <span className="font-semibold text-primary/90">Mission Control</span>
      <span className="text-muted-foreground/40">supervises</span>
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">Baseline OS</span>
      <span className="text-muted-foreground/40">directs</span>
      <span className="font-semibold text-emerald-400/90">AI Workforce</span>
      <span className="ml-auto hidden text-[9px] normal-case tracking-normal text-muted-foreground/70 sm:inline">
        Dashboard · Intelligence · Execution
      </span>
    </div>
  )
}
