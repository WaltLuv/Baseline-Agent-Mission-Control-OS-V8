'use client'

/**
 * AI Agent Workforce Setup — the spec/sales/factory system, surfaced in MC.
 * Customer-safe informational panel: offers, strategic model, build process,
 * positioning, and the public build/spec repos.
 */
import {
  SERVICE_OFFERS,
  STRATEGIC_PILLARS,
  BUILD_PROCESS,
  WORKFORCE_REPOS,
  POSITIONING,
} from '@/lib/agent-workforce-setup'

export function AgentWorkforceSetupPanel() {
  return (
    <div className="p-4 space-y-4" data-testid="agent-workforce-setup">
      <div className="rounded-lg border border-border bg-card p-4">
        <h1 className="text-lg font-semibold text-foreground">AI Agent Workforce Setup</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          A repeatable factory for building client AI agents, AI employees, AI teams, skills, and
          workflow packages — spec-driven, productized, and proof-backed.
        </p>
        <p className="text-sm text-foreground/90 mt-2 italic">“{POSITIONING}”</p>
      </div>

      {/* Service offers */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Service offers</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {SERVICE_OFFERS.map((o) => (
            <div key={o.id} className="rounded-lg border border-border bg-card p-4" data-testid={`offer-${o.id}`}>
              <h3 className="text-sm font-semibold text-foreground">{o.name}</h3>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">{o.price}</span>
                <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{o.timeline}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{o.outcome}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Strategic model */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Strategic model — 5 pillars</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {STRATEGIC_PILLARS.map((p) => (
            <div key={p.id} className="rounded-md border border-border bg-card p-3" data-testid={`pillar-${p.id}`}>
              <span className="text-sm font-medium text-foreground">{p.name}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{p.role}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Build process */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Build process — Constitution → Maintain</h2>
        <ol className="grid gap-2 md:grid-cols-3" data-testid="build-process">
          {BUILD_PROCESS.map((s) => (
            <li key={s.step} className="rounded-md border border-border bg-card p-3">
              <span className="text-xs font-mono text-muted-foreground">{s.step}.</span>{' '}
              <span className="text-sm font-medium text-foreground">{s.name}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{s.detail}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Repos */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Build / spec sources</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {WORKFORCE_REPOS.map((r) => (
            <a key={r.name} href={r.url} target="_blank" rel="noreferrer" className="rounded-md border border-border bg-card p-3 hover:bg-muted" data-testid={`repo-${r.name}`}>
              <span className="text-sm font-medium text-foreground">{r.name} ↗</span>
              <p className="text-xs text-muted-foreground mt-0.5">{r.purpose}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AgentWorkforceSetupPanel
