'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'
import {
  CONSOLE_DIRECTIVES,
  directivesByGroup,
  INDUSTRIES,
  type ConsoleDirective,
} from '@/lib/workforce-console'

function ArrowRight() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

// ─── Interactive Workforce OS Console (landing simulation — labeled DEMO) ───
function WorkforceConsole() {
  const [directiveId, setDirectiveId] = useState<string>(CONSOLE_DIRECTIVES[0].directiveId)
  const [running, setRunning] = useState(false)
  const [doneStep, setDoneStep] = useState(-1)
  const [elapsed, setElapsed] = useState(0)
  const [finished, setFinished] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const directive = CONSOLE_DIRECTIVES.find((d) => d.directiveId === directiveId) as ConsoleDirective

  function reset() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setRunning(false); setDoneStep(-1); setElapsed(0); setFinished(false)
  }

  function selectDirective(id: string) {
    reset()
    setDirectiveId(id)
  }

  function run() {
    if (running) return
    reset()
    setRunning(true)
    const stepMs = 700
    directive.steps.forEach((_, i) => {
      timers.current.push(setTimeout(() => {
        setDoneStep(i)
        setElapsed(Number(((i + 1) * (stepMs / 1000)).toFixed(1)))
        if (i === directive.steps.length - 1) { setRunning(false); setFinished(true) }
      }, (i + 1) * stepMs))
    })
  }

  const tokenEstimate = directive.steps.length * 1200 + directive.agentMap.length * 400

  return (
    <section className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24" id="console" data-testid="workforce-console">
      <div className="text-center mb-8">
        <span className="inline-block text-xs font-mono uppercase tracking-widest text-violet-300/70 mb-3">Interactive Workforce OS Console</span>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Pick a directive. Watch the workforce run.</h2>
        <p className="mt-3 text-white/55 max-w-2xl mx-auto text-sm">
          Choose a directive below and run the simulation to see how Baseline dispatches workers, tracks tools, and triggers human gates.{' '}
          <span className="text-amber-300/80" data-testid="console-demo-label">This is a simulation/demo — no live work is executed.</span>
        </p>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
        {/* Directive selector (grouped) */}
        <div className="space-y-5">
          {(['general', 'industry'] as const).map((group) => (
            <div key={group}>
              <div className="text-[11px] font-mono uppercase tracking-widest text-white/40 mb-2">
                {group === 'general' ? 'General Builder Directives' : 'Industry Workforce Directives'}
              </div>
              <div className="grid gap-2">
                {directivesByGroup(group).map((d) => {
                  const active = d.directiveId === directiveId
                  return (
                    <button
                      key={d.directiveId}
                      type="button"
                      data-testid={`directive-${d.directiveId}`}
                      onClick={() => selectDirective(d.directiveId)}
                      className={`text-left rounded-xl border px-4 py-3 transition-colors ${active ? 'border-violet-400/50 bg-violet-500/[0.08]' : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]'}`}
                    >
                      <div className="text-[13px] font-semibold text-white">{d.label}</div>
                      <div className="text-[11px] text-white/50 mt-0.5">{d.description}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Agent map + run + log */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0b0b0f] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-[11px] font-mono text-white/45">baseline-core@automations · {directive.directiveId}</span>
            <span className="text-[11px] font-mono text-white/45" data-testid="console-tokens">~{tokenEstimate.toLocaleString()} tokens · {elapsed.toFixed(1)}s</span>
          </div>

          {/* Agent Map (changes per directive) */}
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Agent Map</div>
            <div className="flex flex-wrap gap-1.5" data-testid="console-agent-map">
              {directive.agentMap.map((a, i) => {
                const thinking = running && i <= doneStep
                const done = finished
                return (
                  <span key={a} data-testid="agent-node" className="text-[11px] rounded-md border px-2 py-1"
                    style={{ borderColor: done ? 'rgba(16,185,129,0.4)' : thinking ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.1)', color: done ? '#34d399' : thinking ? '#c4b5fd' : 'rgba(255,255,255,0.65)' }}>
                    {a} · {done ? 'done' : thinking ? 'thinking' : 'idle'}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Log */}
          <div className="flex-1 px-4 py-3 font-mono text-[11px] min-h-[180px] space-y-1" data-testid="console-log">
            {doneStep < 0 && !running && <div className="text-white/40">Kernel idling. Click Run Mission to start the simulation.</div>}
            {directive.steps.map((s, i) => (i <= doneStep ? (
              <div key={i} className="text-white/75"><span className="text-emerald-400">✓</span> {s}</div>
            ) : null))}
            {finished && (
              <>
                <div className="mt-2 text-amber-300/90" data-testid="console-human-gate">⛔ Human gate: {directive.humanGates.join('; ')}</div>
                <div className="mt-1 text-violet-300/90" data-testid="console-proof">proof: {directive.proofSummary}</div>
              </>
            )}
          </div>

          {/* Controls + post-run CTA */}
          <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
            <button type="button" onClick={run} disabled={running} data-testid="console-run"
              className="h-9 px-4 rounded-lg bg-white text-[#09090b] text-[13px] font-semibold hover:bg-white/90 disabled:opacity-50">
              {running ? 'Running…' : 'Run Mission'}
            </button>
            {finished && (
              <Link href={directive.ctaRoute} data-testid="console-cta"
                className="h-9 px-4 rounded-lg bg-violet-500 text-white text-[13px] font-semibold hover:bg-violet-400 inline-flex items-center gap-1.5">
                {directive.ctaLabel} <ArrowRight />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function LayerSection({ title, blurb, tiles }: { title: string; blurb: string; tiles: Array<{ label: string; href?: string; desc: string }> }) {
  return (
    <div className="mb-10" data-testid={`layer-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="text-sm text-white/50 mt-1 mb-4">{blurb}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => {
          const inner = (
            <>
              <div className="text-[13px] font-semibold text-white">{t.label}</div>
              <div className="text-[11px] text-white/50 mt-1">{t.desc}</div>
            </>
          )
          return t.href ? (
            <Link key={t.label} href={t.href} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors block">{inner}</Link>
          ) : (
            <div key={t.label} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">{inner}</div>
          )
        })}
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] antialiased overflow-x-hidden">
      {/* Global glow */}
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-violet-600/15 blur-[140px] rounded-full" />
        <div className="absolute top-[200px] right-[15%] w-[400px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full" />
      </div>

      {/* ─── HEADER ─── */}
      <header className="relative z-10 border-b border-white/[0.06] backdrop-blur-xl bg-[#09090b]/70">
        <div className="mx-auto max-w-screen-xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <img src="/brand/mc-logo-128.png" alt="Baseline Automations" width={28} height={28} className="w-7 h-7 rounded-md object-contain" />
            Baseline Automations
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#industries" className="text-sm text-white/65 hover:text-white transition-colors" data-testid="nav-industries">Industries</a>
            <a href="#console" className="text-sm text-white/65 hover:text-white transition-colors" data-testid="nav-console">Console</a>
            <Link href="/marketplace" data-testid="nav-marketplace" className="text-sm text-white/65 hover:text-white transition-colors">Marketplace</Link>
            <Link href="/login" data-testid="nav-mission-control" className="text-sm text-white/65 hover:text-white transition-colors">Mission Control</Link>
            <Link href="/pricing" className="text-sm text-white/45 hover:text-white transition-colors" data-testid="nav-pricing">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" data-testid="header-sign-in" className="text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5">Sign In</Link>
            <Link href="/signup" data-testid="header-start-free" className="text-sm font-medium bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] rounded-lg px-3.5 py-1.5 transition-colors">Get Started</Link>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── Workforce OS, templates as the hero ─── */}
      <section className="relative z-10 mx-auto max-w-screen-xl px-6 pt-20 pb-12 md:pt-28 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 px-3.5 py-1 text-[13px] font-medium text-violet-300 mb-8" data-testid="hero-badge">
          Introducing Baseline Automations AI Workforce OS
        </div>
        <h1 className="mx-auto max-w-4xl text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
          <span className="bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent">Workforce OS</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg md:text-xl text-white/70 leading-relaxed">
          Install a complete AI workforce in minutes.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-sm md:text-base text-white/50 leading-relaxed">
          Choose your industry, install the workforce, connect your agents, and operate your company — runtimes, creative studio, knowledge, and orchestration in one OS.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="#industries" data-testid="hero-choose-industry" className="h-11 px-6 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90 transition-colors flex items-center gap-2">
            Choose your industry <ArrowRight />
          </a>
          <Link href="/login" data-testid="hero-sign-in" className="h-11 px-6 rounded-lg bg-white/[0.06] text-white/80 text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1] hover:text-white transition-colors">Sign In</Link>
        </div>
      </section>

      {/* ─── INDUSTRIES (HERO) — what workforce do you want to install? ─── */}
      <section id="industries" className="relative z-10 mx-auto max-w-screen-xl px-6 pb-20" data-testid="industries">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">What workforce do you want to install?</h2>
          <p className="mt-2 text-white/55 text-sm">Production-ready workforce templates — each a full team of AI employees, workflows, and approvals.</p>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {INDUSTRIES.map((ind) => (
            <Link key={ind.slug} href={`/signup?vertical=${ind.slug}`} data-testid={`industry-${ind.slug}`}
              className="group rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 hover:-translate-y-0.5 hover:border-violet-400/40 transition-all">
              <div className="text-[14px] font-semibold text-white">{ind.label}</div>
              <div className="text-[11px] text-violet-300/70 mt-2 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">Install <ArrowRight /></div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── INTERACTIVE CONSOLE ─── */}
      <WorkforceConsole />

      {/* ─── LAYERS — Build / Operate / Scale / Knowledge / Creative ─── */}
      <section className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24">
        <LayerSection title="Build" blurb="Compose the workforce and its tools."
          tiles={[
            { label: 'Claude Code Studio', desc: 'Unified creative operating system + video team.' },
            { label: 'Higgsfield', desc: 'Creative supercomputer provider control center.' },
            { label: 'Skills Marketplace', href: '/marketplace', desc: 'Premium skills + workflows for your workforce.' },
            { label: 'Runtime Marketplace', href: '/login', desc: 'Connect Claude Code, Codex, Hermes, OpenClaw, OMP.' },
            { label: 'Knowledge OS', desc: 'Obsidian / Notion / Pinecone / NotebookLM brain layers.' },
          ]} />
        <LayerSection title="Operate" blurb="Run the company day to day."
          tiles={[
            { label: 'Mission Control', href: '/login', desc: 'The cloud command center for your workforce.' },
            { label: 'Workforce Orchestration', href: '/login', desc: 'Route tasks across specialized agent squads.' },
            { label: 'Agent Directory', href: '/login', desc: 'Every AI employee, status, and assignment.' },
            { label: 'Runtime Directory', href: '/login', desc: 'Connected runtimes + health.' },
            { label: 'Activity Center', href: '/login', desc: 'Live, auditable workforce activity.' },
          ]} />
        <LayerSection title="Scale" blurb="Deploy beyond the browser."
          tiles={[
            { label: 'Flight Deck', href: '/flight-deck', desc: 'Desktop terminal connecting local runtimes.' },
            { label: 'Deployment', href: '/flight-deck', desc: 'Ship to your own infrastructure.' },
            { label: 'VPS Pairing', desc: 'Pair a production controller securely (no SSH in-app).' },
            { label: 'Local Install', href: '/flight-deck', desc: 'Run the workforce on your hardware.' },
            { label: 'Enterprise Rollout', href: '/pricing', desc: 'Org-wide deployment + guardrails.' },
          ]} />
        <LayerSection title="Knowledge Layer" blurb="The four-brain memory architecture."
          tiles={[
            { label: 'Obsidian', desc: 'Brain 1 — working memory + daily ops.' },
            { label: 'Notion', desc: 'Brain 2 — structured business memory + SOPs.' },
            { label: 'Pinecone', desc: 'Brain 3 — long-term semantic retrieval.' },
            { label: 'NotebookLM', desc: 'Brain 4 — research synthesis + audio/video/slides.' },
            { label: 'PI Agent', desc: 'Chief Memory Officer across the brain layers.' },
          ]} />
        <LayerSection title="Creative Layer" blurb="Provider-sovereign creative production — assets stay in Baseline OS."
          tiles={[
            { label: 'Claude Code Studio', desc: 'Canonical creative workspace + render queue + proof.' },
            { label: 'Video Team', desc: '8 specialized creative agents.' },
            { label: 'Higgsfield', desc: 'Image/video provider with agent orchestration.' },
            { label: 'HyperFrames', desc: 'HTML-to-video rendering pipeline.' },
            { label: 'Soul IDs', desc: 'Consent-gated identity models (high approval).' },
            { label: 'Asset Library', desc: 'Every asset/proof owned by Baseline OS, not the provider.' },
          ]} />
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-screen-xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sm text-white/40">
            <div className="w-5 h-5 rounded bg-violet-600 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5L8 2z" />
              </svg>
            </div>
            &copy; {new Date().getFullYear()} Baseline Automations. All rights reserved.
          </div>
          <div className="flex items-center gap-6 text-sm text-white/30 flex-wrap justify-center">
            <Link href="/marketplace" data-testid="footer-link-marketplace" className="hover:text-white/80 transition-colors">Marketplace</Link>
            <Link href="/pricing" data-testid="footer-link-pricing" className="hover:text-white/80 transition-colors">Pricing</Link>
            <Link href="/flight-deck" data-testid="footer-link-flight-deck" className="hover:text-white/80 transition-colors">Flight Deck</Link>
            <Link href="/help" data-testid="footer-link-help" className="hover:text-white/80 transition-colors">Help</Link>
            <Link href="/login" data-testid="footer-link-mission-control" className="hover:text-white/80 transition-colors">Mission Control</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
