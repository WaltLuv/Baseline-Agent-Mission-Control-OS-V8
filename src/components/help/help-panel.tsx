'use client'

import { useState, useMemo } from 'react'
import { useNavigateToPanel } from '@/lib/navigation'
import {
  GETTING_STARTED,
  USER_GUIDE,
  RUNTIME_SETUP,
  MEMORY_SETUP,
  TROUBLESHOOTING,
  DEMO_VS_LIVE,
  GLOSSARY,
  FAQ,
  HELP_INDEX,
  type Audience,
  type HelpStep,
  type HelpSection,
} from '@/lib/help/content'

interface NavEntry {
  id: string
  label: string
  description: string
}

const NAV: NavEntry[] = [
  { id: 'home', label: 'Help Home', description: 'Where to begin.' },
  { id: 'getting-started', label: 'Getting Started', description: '10 steps from zero to your first real workflow.' },
  { id: 'user-guide', label: 'User Guide', description: 'How to use every screen.' },
  { id: 'runtime-setup', label: 'Runtime Setup', description: 'Hermes, OpenClaw, and Claude Code.' },
  { id: 'memory-setup', label: 'Memory Setup', description: 'Obsidian, Notion, and Knowledge Intelligence.' },
  { id: 'demo-vs-live', label: 'Demo vs Live', description: 'Tell example data from real data.' },
  { id: 'troubleshooting', label: 'Troubleshooting', description: 'Common issues and how to fix them.' },
  { id: 'glossary', label: 'Glossary', description: 'Plain-English definitions of every term.' },
  { id: 'faq', label: 'FAQ', description: 'Quick answers to common questions.' },
]

const AUDIENCES: { id: Audience; label: string; description: string }[] = [
  { id: 'owner', label: 'Business Owner', description: 'Value, approvals, ROI, workforce health.' },
  { id: 'operator', label: 'Operator / Admin', description: 'Setup, workflows, employees, memory.' },
  { id: 'developer', label: 'Developer / Runtime', description: 'Hermes, OpenClaw, Claude Code hooks.' },
  { id: 'enterprise', label: 'Enterprise / Security', description: 'Permissions, audit, data privacy.' },
]

export function HelpPanel({ subroute }: { subroute: string }) {
  const [audience, setAudience] = useState<Audience>('owner')
  const navigateToPanel = useNavigateToPanel()
  const active = subroute || 'home'

  return (
    <div className="flex h-full" data-testid="help-panel">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/50 bg-card/30">
        <div className="p-4 border-b border-border/40">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Help & Guides</p>
          <p className="text-sm font-semibold text-foreground mt-1">Mission Control</p>
        </div>
        <div className="p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-2">Guide for</p>
          <div className="space-y-1" role="radiogroup" aria-label="Audience">
            {AUDIENCES.map((a) => (
              <button
                key={a.id}
                role="radio"
                aria-checked={audience === a.id}
                data-testid={`help-audience-${a.id}`}
                onClick={() => setAudience(a.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                  audience === a.id
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 border-t border-border/40" aria-label="Help navigation">
          {NAV.map((n) => (
            <button
              key={n.id}
              data-testid={`help-nav-${n.id}`}
              onClick={() => navigateToPanel(n.id === 'home' ? 'help' : `help/${n.id}`)}
              className={`w-full text-left px-2.5 py-2 rounded-md text-sm transition-colors ${
                active === n.id || (active === 'home' && n.id === 'home')
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-secondary/50'
              }`}
            >
              <div className="font-medium">{n.label}</div>
              <div className="text-[11px] text-muted-foreground/70 mt-0.5">{n.description}</div>
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 md:p-10">
          {/* Mobile audience selector */}
          <div className="md:hidden mb-6">
            <label htmlFor="help-audience-mobile" className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Guide for</label>
            <select
              id="help-audience-mobile"
              data-testid="help-audience-mobile"
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
              className="mt-1 w-full bg-card border border-border rounded-md px-3 py-2 text-sm"
            >
              {AUDIENCES.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>

          {active === 'home' && <HelpHome audience={audience} />}
          {active === 'getting-started' && <SectionGettingStarted />}
          {active === 'user-guide' && <SectionList sections={USER_GUIDE} audience={audience} testId="help-user-guide" />}
          {active === 'runtime-setup' && <SectionList sections={RUNTIME_SETUP} audience={audience} testId="help-runtime-setup" requireDev />}
          {active === 'memory-setup' && <SectionList sections={MEMORY_SETUP} audience={audience} testId="help-memory-setup" />}
          {active === 'demo-vs-live' && <SectionDemoVsLive />}
          {active === 'troubleshooting' && <SectionTroubleshooting />}
          {active === 'glossary' && <SectionGlossary />}
          {active === 'faq' && <SectionFAQ />}
        </div>
      </div>
    </div>
  )
}

function HelpHome({ audience }: { audience: Audience }) {
  const [query, setQuery] = useState('')
  const navigateToPanel = useNavigateToPanel()
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return [] as typeof HELP_INDEX
    return HELP_INDEX.filter((e) => e.title.toLowerCase().includes(q) || e.keywords.toLowerCase().includes(q))
  }, [query])

  const recommended = useMemo(() => {
    if (audience === 'developer') return ['runtime-setup', 'user-guide', 'troubleshooting']
    if (audience === 'enterprise') return ['user-guide', 'demo-vs-live', 'glossary']
    if (audience === 'operator') return ['getting-started', 'memory-setup', 'user-guide']
    return ['getting-started', 'user-guide', 'faq']
  }, [audience])

  return (
    <div data-testid="help-home" className="space-y-8">
      <header>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold">Help Center</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">Use Mission Control like an executive</h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          Mission Control runs an AI workforce on your behalf. These guides take you from first login to a real workflow,
          step by step, in plain English. No jargon. No surprises.
        </p>
      </header>

      <div>
        <label htmlFor="help-search" className="sr-only">Search help</label>
        <input
          id="help-search"
          type="search"
          data-testid="help-search-input"
          placeholder="Search the guides — e.g. memory, approvals, runtime…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-card border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary/50"
        />
        {matches.length > 0 && (
          <ul data-testid="help-search-results" className="mt-2 border border-border/50 bg-card/40 rounded-lg overflow-hidden">
            {matches.map((m) => (
              <li key={m.id}>
                <button
                  data-testid={`help-search-result-${m.id}`}
                  onClick={() => navigateToPanel(m.panel)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary/50"
                >
                  <div className="font-medium text-foreground">{m.title}</div>
                  <div className="text-[11px] text-muted-foreground/70 mt-0.5">{m.keywords.split(' ').slice(0, 8).join(' · ')}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Recommended for you</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recommended.map((id) => {
            const n = NAV.find((x) => x.id === id)
            if (!n) return null
            return (
              <button
                key={id}
                data-testid={`help-recommended-${id}`}
                onClick={() => navigateToPanel(`help/${id}`)}
                className="text-left rounded-lg border border-border/50 bg-card/30 p-4 hover:border-primary/30 hover:bg-card/50 transition-colors"
              >
                <div className="text-sm font-medium text-foreground">{n.label}</div>
                <div className="mt-1 text-xs text-muted-foreground/80">{n.description}</div>
                <div className="mt-3 text-[11px] text-primary">Open →</div>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">All guides</h2>
        <div className="mt-4 divide-y divide-border/40 rounded-lg border border-border/40 bg-card/20">
          {NAV.filter((n) => n.id !== 'home').map((n) => (
            <button
              key={n.id}
              data-testid={`help-all-${n.id}`}
              onClick={() => navigateToPanel(`help/${n.id}`)}
              className="w-full flex items-start justify-between px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
            >
              <div>
                <div className="text-sm font-medium text-foreground">{n.label}</div>
                <div className="text-xs text-muted-foreground/80 mt-0.5">{n.description}</div>
              </div>
              <span className="text-muted-foreground/50 text-sm">→</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function SectionGettingStarted() {
  const navigateToPanel = useNavigateToPanel()
  return (
    <div data-testid="help-getting-started">
      <Header eyebrow="Getting Started" title="From zero to your first real workflow" subtitle="Ten steps, in order. Each step is small and finishable." />
      <ol className="mt-8 space-y-5">
        {GETTING_STARTED.map((s, idx) => (
          <li key={s.id} data-testid={`gs-step-${s.id}`} className="rounded-lg border border-border/50 bg-card/30 p-5">
            <div className="flex items-baseline gap-3">
              <span className="text-2xs font-mono text-muted-foreground/60">{String(idx + 1).padStart(2, '0')}</span>
              <h3 className="text-base font-semibold text-foreground">{s.title}</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            {s.cta && (
              <button
                data-testid={`gs-cta-${s.id}`}
                onClick={() => {
                  if (s.cta?.panel) navigateToPanel(s.cta.panel)
                  else if (s.cta?.href) window.location.href = s.cta.href
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                {s.cta.label} →
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function SectionList({
  sections,
  audience,
  testId,
  requireDev = false,
}: {
  sections: HelpSection[]
  audience: Audience
  testId: string
  requireDev?: boolean
}) {
  // Filter steps that aren't relevant to the chosen audience
  const visible = useMemo(() => {
    return sections
      .map((section) => ({
        ...section,
        steps: section.steps.filter((step: HelpStep) => {
          if (!step.audiences || step.audiences.length === 0) return true
          return step.audiences.includes(audience)
        }),
      }))
      .filter((s) => s.steps.length > 0)
  }, [sections, audience])

  return (
    <div data-testid={testId}>
      {requireDev && audience !== 'developer' && (
        <div className="mb-6 rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/80">
          This guide is for the person installing the runtime. Switch the audience to “Developer / Runtime” for full detail.
        </div>
      )}
      {visible.map((section) => (
        <section key={section.id} className="mb-10" data-testid={`${testId}-section-${section.id}`}>
          <h2 className="text-xl font-semibold text-foreground tracking-tight">{section.title}</h2>
          {section.intro && <p className="mt-2 text-sm text-muted-foreground">{section.intro}</p>}
          <div className="mt-5 space-y-3">
            {section.steps.map((step) => (
              <div key={step.id} className="rounded-md border border-border/40 bg-card/20 p-4">
                <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function SectionDemoVsLive() {
  return (
    <div data-testid="help-demo-vs-live">
      <Header eyebrow="Demo vs Live" title="Tell example data from real data" subtitle="Mission Control never blends the two." />
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <article className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-5">
          <h2 className="text-base font-semibold text-amber-200">Demo Mode</h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-100/80">
            {DEMO_VS_LIVE.demo.map((line, i) => (
              <li key={i} className="flex gap-2"><span>—</span><span>{line}</span></li>
            ))}
          </ul>
        </article>
        <article className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h2 className="text-base font-semibold text-emerald-200">Live Mode</h2>
          <ul className="mt-3 space-y-2 text-sm text-emerald-100/80">
            {DEMO_VS_LIVE.live.map((line, i) => (
              <li key={i} className="flex gap-2"><span>—</span><span>{line}</span></li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  )
}

function SectionTroubleshooting() {
  const navigateToPanel = useNavigateToPanel()
  return (
    <div data-testid="help-troubleshooting">
      <Header eyebrow="Troubleshooting" title="Common issues, fixed in minutes" subtitle="Each entry tells you what it means, why it usually happens, and how to fix it." />
      <div className="mt-8 space-y-3">
        {TROUBLESHOOTING.map((t) => (
          <details key={t.id} data-testid={`ts-${t.id}`} className="group rounded-lg border border-border/50 bg-card/30 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground flex items-center justify-between">
              <span>{t.symptom}</span>
              <span className="text-muted-foreground/60 text-xs group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="mt-3 text-sm text-muted-foreground space-y-2">
              <p><span className="text-foreground font-medium">What it means: </span>{t.meaning}</p>
              <p><span className="text-foreground font-medium">Likely cause: </span>{t.likelyCause}</p>
              <div>
                <p className="text-foreground font-medium">Fix:</p>
                <ol className="mt-1 list-decimal pl-5 space-y-1">
                  {t.fix.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              </div>
              {t.link && (
                <button
                  data-testid={`ts-${t.id}-link`}
                  onClick={() => t.link?.panel && navigateToPanel(t.link.panel)}
                  className="text-xs text-primary hover:underline"
                >
                  {t.link.label} →
                </button>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}

function SectionGlossary() {
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return GLOSSARY
    return GLOSSARY.filter(
      (t) => t.term.toLowerCase().includes(q) || t.short.toLowerCase().includes(q) || t.long.toLowerCase().includes(q),
    )
  }, [query])
  return (
    <div data-testid="help-glossary">
      <Header eyebrow="Glossary" title="Every term, in plain English" subtitle="If a word sounds technical, it does not have to be." />
      <input
        type="search"
        data-testid="glossary-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter terms…"
        className="mt-6 w-full bg-card border border-border rounded-lg px-4 py-2 text-sm"
      />
      <dl className="mt-6 space-y-4">
        {visible.map((g) => (
          <div key={g.term} data-testid={`glossary-${g.term.replace(/\s+/g, '-').toLowerCase()}`} className="rounded-md border border-border/40 bg-card/20 p-4">
            <dt className="text-sm font-semibold text-foreground">
              {g.term} <span className="font-normal text-muted-foreground/80">— {g.short}</span>
            </dt>
            <dd className="mt-1 text-sm text-muted-foreground">{g.long}</dd>
          </div>
        ))}
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground/70">No terms match “{query}”.</p>
        )}
      </dl>
    </div>
  )
}

function SectionFAQ() {
  return (
    <div data-testid="help-faq">
      <Header eyebrow="FAQ" title="Quick answers" />
      <div className="mt-6 space-y-3">
        {FAQ.map((f, i) => (
          <details key={i} data-testid={`faq-${i}`} className="rounded-md border border-border/40 bg-card/20 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-foreground">{f.q}</summary>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}

function Header({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <header>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold">{eyebrow}</p>
      <h1 className="mt-2 text-2xl md:text-3xl font-semibold text-foreground tracking-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
    </header>
  )
}
