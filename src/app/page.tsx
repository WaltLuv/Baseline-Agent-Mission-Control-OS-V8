'use client'

import Link from 'next/link'

function ArrowRight() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <path d="M22 4L12 14.01l-3-3" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  )
}

function FeatureIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
      {children}
    </div>
  )
}

// Cost-of-chaos examples — concrete things a business owner already loses sleep over.
const problems = [
  'Leads that never get followed up.',
  'Invoices that don\'t get chased.',
  'Approvals that sit in someone\'s inbox for days.',
  'Customer communication that\'s inconsistent across the team.',
  'Repetitive work eating hours your team should spend with customers.',
]

// Outcome-led capabilities. Technology is the engine, not the headline.
const features = [
  {
    title: 'Work that doesn\'t fall through the cracks',
    desc: 'Every lead, invoice, approval, and follow-up has an owner and a deadline. Nothing waits for someone to remember.',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    title: 'Consistent execution, every day',
    desc: 'Your best process runs the same way whether it\'s a Monday or a holiday weekend. No drift, no exceptions, no guesswork.',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
      </svg>
    ),
  },
  {
    title: 'Visibility into who did what',
    desc: 'See every task that ran, who owned it, what it cost, and what came out the other side. Accountability built in.',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" rx="2" width="20" height="14" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    title: 'Approval before anything risky',
    desc: 'Define what needs a human signoff — a refund over $500, a contract update, a customer escalation — and the system pauses for you.',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22,4 12,14.01 9,11" />
      </svg>
    ),
  },
  {
    title: 'Costs you can actually see',
    desc: 'Cost-per-task, cost-per-customer, cost-per-department. Know what each piece of your operation actually costs to run.',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
  {
    title: 'Separate workspaces for each part of the business',
    desc: 'Locations, departments, clients, or properties — each one gets its own clean workspace. No spillover, no cross-contamination.',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" rx="2" width="20" height="14" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
]

// "How It Works" — outcome (Install / Automate / Monitor) on the surface,
// technology (AI Employees / Skills / Workflows / Baseline OS) introduced
// only here, after the value is already understood.
const steps = [
  {
    num: '01',
    title: 'Install Systems',
    desc: 'We map how your business actually runs today, then install the workflows, rules, and approval gates that make work happen on time and in order.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Automate Work',
    desc: 'AI employees and automated workflows pick up the repetitive jobs — intake, follow-ups, dispatch, status updates, reporting — and run them every day without being asked.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Monitor Results',
    desc: 'One executive view — Baseline OS — shows what ran, what got stuck, what saved time, and what each part of the operation is costing you.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" rx="2" width="20" height="14" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
]

export default function LandingPage() {
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
            <img
              src="/brand/mc-logo-128.png"
              alt="Baseline Automations"
              width={28}
              height={28}
              className="w-7 h-7 rounded-md object-contain"
            />
            Baseline Automations
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#problem" className="text-sm text-white/50 hover:text-white transition-colors" data-testid="nav-problem">The Problem</a>
            <a href="#how-it-works" className="text-sm text-white/50 hover:text-white transition-colors" data-testid="nav-how-it-works">How It Works</a>
            <a href="#features" className="text-sm text-white/50 hover:text-white transition-colors" data-testid="nav-features">What You Get</a>
            <a href="#pricing" className="text-sm text-white/50 hover:text-white transition-colors" data-testid="nav-pricing">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" data-testid="header-sign-in" className="text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5">
              Sign In
            </Link>
            <Link
              href="/signup"
              data-testid="header-start-free"
              className="text-sm font-medium bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] rounded-lg px-3.5 py-1.5 transition-colors"
            >
              Start Free
            </Link>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── outcome-first headline; technology mentioned only as the engine */}
      <section className="relative z-10 mx-auto max-w-screen-xl px-6 pt-20 pb-24 md:pt-32 md:pb-36 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 px-3.5 py-1 text-[13px] font-medium text-violet-300 mb-8">
          AI Workforce OS
        </div>
        <h1 className="mx-auto max-w-4xl text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
          <span className="bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent">
            We install systems into your business so work gets done{' '}
          </span>
          <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
            faster, more consistently, and at a lower cost.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base md:text-lg text-white/55 leading-relaxed">
          Powered by automation, workflows, AI employees, and operational systems managed through Baseline&nbsp;OS.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#how-it-works"
            data-testid="hero-see-how-it-works"
            className="h-11 px-6 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90 transition-colors flex items-center gap-2"
          >
            See How It Works
            <ArrowRight />
          </a>
          <Link
            href="/signup"
            data-testid="hero-start-free"
            className="h-11 px-6 rounded-lg bg-white/[0.06] text-white/80 text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1] hover:text-white transition-colors"
          >
            Start Free
          </Link>
        </div>
      </section>

      {/* ─── PROBLEM ─── */}
      <section id="problem" className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24 md:pb-32">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <span className="inline-block text-xs font-mono uppercase tracking-widest text-white/40 mb-4">The Problem</span>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
            Most businesses lose money because{' '}
            <span className="bg-gradient-to-r from-orange-300 to-amber-300 bg-clip-text text-transparent">
              work falls through the cracks.
            </span>
          </h2>
          <p className="mt-5 text-white/45 max-w-xl mx-auto">
            You hire good people, but the work still doesn&apos;t get done on time. Sound familiar?
          </p>
        </div>
        <ul className="mx-auto max-w-2xl space-y-3">
          {problems.map((p) => (
            <li
              key={p}
              className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              data-testid="problem-item"
            >
              <div className="text-amber-300/80 mt-0.5">
                <AlertIcon />
              </div>
              <p className="text-[15px] text-white/80 leading-relaxed">{p}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ─── SOLUTION ─── */}
      <section className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24 md:pb-32">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block text-xs font-mono uppercase tracking-widest text-violet-300/80 mb-4">The Solution</span>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
            We install systems that make sure the{' '}
            <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              right work gets done at the right time.
            </span>
          </h2>
          <p className="mt-5 text-white/55 leading-relaxed max-w-2xl mx-auto">
            Your team stops being the bottleneck. Repetitive work runs in the background. Critical decisions still come to you — only when they need to.
          </p>
        </div>
      </section>

      {/* ─── HOW IT WORKS — Install → Automate → Monitor ─── */}
      <section
        id="how-it-works"
        className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24 md:pb-36"
      >
        <div className="text-center mb-14">
          <span className="inline-block text-xs font-mono uppercase tracking-widest text-white/40 mb-3">How It Works</span>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Three steps from chaos to{' '}
            <span className="text-violet-400">running on rails</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-12">
          {steps.map((step, i) => (
            <div key={step.num} className="relative" data-testid={`how-step-${step.num}`}>
              {/* Connector line between steps (hidden on mobile) */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[60%] right-[-2.5rem] h-px bg-gradient-to-r from-white/10 to-transparent" />
              )}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center pt-1">
                  <div className="w-14 h-14 rounded-full border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-white/70">
                    {step.icon}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-mono text-violet-400/80 tracking-widest">
                    STEP {step.num}
                  </span>
                  <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-white/50 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* The "engine" callout — AI is acknowledged as how, not what */}
        <div className="mt-14 mx-auto max-w-3xl rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-5 text-center">
          <p className="text-sm text-white/55 leading-relaxed">
            <span className="text-white/85 font-medium">Under the hood:</span>{' '}
            AI employees, installable skills, supervised teams, defined workflows, and Baseline&nbsp;OS as the executive command center. You see outcomes; the engine handles the rest.
          </p>
        </div>
      </section>

      {/* ─── WHAT YOU GET (features) ─── */}
      <section id="features" className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24 md:pb-36">
        <div className="mb-14 text-center">
          <span className="inline-block text-xs font-mono uppercase tracking-widest text-white/40 mb-3">What You Get</span>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Operations that{' '}
            <span className="text-violet-400">actually run themselves</span>
          </h2>
          <p className="mt-3 text-white/45 max-w-xl mx-auto">
            Built for teams that depend on execution, not effort.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(f => (
            <div
              key={f.title}
              data-testid="feature-card"
              className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-violet-500/20 hover:bg-violet-500/[0.03] transition-colors"
            >
              <FeatureIcon>{f.icon}</FeatureIcon>
              <h3 className="mt-4 text-sm font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-white/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── VERTICALS — built for businesses that depend on execution ─── */}
      <section className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24 md:pb-32">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Built for Businesses That{' '}
            <span className="text-violet-400">Depend on Execution</span>
          </h2>
          <p className="mt-4 text-white/45">
            If your business runs on follow-ups, dispatch, approvals, intake, and reporting — this is for you.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-white/35 font-medium tracking-wide uppercase">
          {[
            'Property Management',
            'Real Estate',
            'Mortgage',
            'CPA Firms',
            'Law Firms',
            'General Contractors',
            'Home Services',
            'Marketing Agencies',
            'AI Agencies',
          ].map((label, i, arr) => (
            <span key={label} className="flex items-center gap-x-6" data-testid="vertical-item">
              <span>{label}</span>
              {i < arr.length - 1 && <span className="w-1 h-1 rounded-full bg-white/20" aria-hidden />}
            </span>
          ))}
        </div>
      </section>

      {/* ─── ROI / TESTIMONIAL — outcome-focused quote; same metrics ─── */}
      <section className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24 md:pb-36">
        <div className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-violet-500/[0.06] to-blue-500/[0.04] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-transparent to-blue-500/10 opacity-40" />
          <div className="relative px-8 py-14 md:px-16 md:py-20 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 mb-6">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23,6 13.5,15.5 8.5,10.5 1,18" />
                <polyline points="17,6 23,6 23,12" />
              </svg>
            </div>
            <blockquote className="mx-auto max-w-2xl text-xl md:text-2xl font-light leading-relaxed text-white/85">
              &ldquo;Baseline Automations helped us install systems that{' '}
              <span className="text-white font-medium">eliminated bottlenecks, improved accountability, and gave our team back over 20 hours per week</span>{' '}
              — across maintenance, intake, dispatch, and reporting.&rdquo;
            </blockquote>
            <div className="mt-8 grid grid-cols-3 gap-6 max-w-md mx-auto">
              <div data-testid="metric-hours-saved">
                <div className="text-2xl md:text-3xl font-bold text-white">20+</div>
                <div className="text-xs text-white/40 mt-1 uppercase tracking-wide font-medium">Hours Saved / Week</div>
              </div>
              <div data-testid="metric-faster-dispatch">
                <div className="text-2xl md:text-3xl font-bold text-white">3.2×</div>
                <div className="text-xs text-white/40 mt-1 uppercase tracking-wide font-medium">Faster Dispatch</div>
              </div>
              <div data-testid="metric-cost-reduction">
                <div className="text-2xl md:text-3xl font-bold text-white">40%</div>
                <div className="text-xs text-white/40 mt-1 uppercase tracking-wide font-medium">Cost Reduction</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TWO DEPLOYMENT MODES — honest about where it runs ─── */}
      <section className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24 md:pb-32" data-testid="deployment-modes">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <span className="inline-block text-xs font-mono uppercase tracking-widest text-white/40 mb-3">Two Ways To Run It</span>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Same workforce.{' '}
            <span className="text-violet-400">Local or cloud.</span>
          </h2>
          <p className="mt-4 text-white/55 leading-relaxed">
            Mission Control is the same product in both modes — only the host changes. Run it on your own machine for on-prem control, or in the cloud for shared team workspaces.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5" data-testid="mode-local">
            <div className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold text-emerald-300 mb-3">
              Mode 1 · Local
            </div>
            <h3 className="text-base font-semibold text-white">Baseline OS</h3>
            <p className="mt-2 text-sm text-white/55 leading-relaxed">
              Self-host on a Mac mini, VPS, or workstation. Your runtimes, files, and memory stay on the box. No vendor lock-in.
            </p>
          </div>
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-5" data-testid="mode-cloud">
            <div className="inline-flex items-center rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold text-violet-300 mb-3">
              Mode 2 · Cloud
            </div>
            <h3 className="text-base font-semibold text-white">Mission Control</h3>
            <p className="mt-2 text-sm text-white/55 leading-relaxed">
              Run it as a hosted workspace your team shares. Connect runtimes from any machine. Start free, top up with credits when you need paid work.
            </p>
          </div>
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/flight-deck"
            data-testid="deployment-modes-flight-deck"
            className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white transition-colors"
          >
            Or install the Flight Deck desktop terminal — works with both modes
            <ArrowRight />
          </Link>
        </div>
      </section>

      {/* ─── PRICING TEASER — credit-pack model, honest about free vs paid ─── */}
      <section id="pricing" className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24 md:pb-36">
        <div className="text-center mb-14">
          <span className="inline-block text-xs font-mono uppercase tracking-widest text-white/40 mb-3">Pricing</span>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Free to start.{' '}
            <span className="text-violet-400">Top up with credits when you need paid work.</span>
          </h2>
          <p className="mt-4 text-white/55 max-w-2xl mx-auto leading-relaxed">
            Mission Control is free. Buy credit packs when your workforce runs paid work or when you unlock premium marketplace items. No subscription.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto">
          {/* Starter Pack */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6" data-testid="pricing-card-pack-starter">
            <span className="inline-block text-xs font-medium uppercase tracking-wider text-white/40 mb-2">Starter Pack</span>
            <div className="text-3xl font-bold">$10</div>
            <p className="mt-2 text-sm text-white/40">1,000 credits — try the workforce on one or two recurring jobs.</p>
            <ul className="mt-5 space-y-2 text-sm text-white/55">
              <li className="flex items-center gap-2"><CheckCircleIcon /> One-time purchase</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> Credits never expire</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> Buys premium skills, workflows, employees</li>
            </ul>
          </div>

          {/* Power Pack — highlighted */}
          <div className="relative rounded-xl border border-violet-500/25 bg-violet-500/[0.04] p-6" data-testid="pricing-card-pack-power">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-wider text-violet-300 bg-violet-500/20 border border-violet-500/30 rounded-full px-3 py-0.5">
              Most Popular
            </span>
            <span className="inline-block text-xs font-medium uppercase tracking-wider text-violet-300/80 mb-2">Power Pack</span>
            <div className="mt-1 text-3xl font-bold">$25</div>
            <p className="mt-2 text-sm text-white/40">2,750 credits (250 bonus) — sustains a small workforce on real workflows.</p>
            <ul className="mt-5 space-y-2 text-sm text-white/55">
              <li className="flex items-center gap-2"><CheckCircleIcon /> 10% bonus credits</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> Credits never expire</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> Paid AI/API usage at 2.5× markup</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> Unlocks all marketplace items</li>
            </ul>
          </div>

          {/* Pro Pack */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6" data-testid="pricing-card-pack-pro">
            <span className="inline-block text-xs font-medium uppercase tracking-wider text-white/40 mb-2">Pro Pack</span>
            <div className="text-3xl font-bold">$50</div>
            <p className="mt-2 text-sm text-white/40">6,000 credits (500 bonus) — for operators running multiple agents daily.</p>
            <ul className="mt-5 space-y-2 text-sm text-white/55">
              <li className="flex items-center gap-2"><CheckCircleIcon /> 10% bonus credits</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> Credits never expire</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> Best per-credit price</li>
            </ul>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-white/40 max-w-xl mx-auto leading-relaxed" data-testid="pricing-credit-disclosure">
          1 credit = $0.10 customer price. Paid AI / API usage debits credits at a 2.5× markup on raw provider cost.
          Free workforce templates, demo employees, and free marketplace items debit nothing.
        </p>

        <div className="text-center mt-8">
          <Link
            href="/pricing"
            data-testid="pricing-view-full"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
          >
            View Full Pricing
            <ArrowRight />
          </Link>
        </div>
      </section>

      {/* ─── FINAL CTA — outcome-focused ─── */}
      <section className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24 md:pb-36">
        <div className="text-center rounded-2xl border border-white/[0.06] bg-white/[0.02] px-8 py-14 md:px-16 md:py-20">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Ready to deploy your{' '}
            <span className="text-violet-400">first AI employee?</span>
          </h2>
          <p className="mt-4 text-white/45 max-w-md mx-auto">
            Set up in minutes. Mission Control is free to start — credits only when you run paid work.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              data-testid="footer-cta-start-free"
              className="h-11 px-6 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90 transition-colors flex items-center gap-2"
            >
              Start Free
              <ArrowRight />
            </Link>
            <a
              href="#how-it-works"
              data-testid="footer-cta-learn-more"
              className="h-11 px-6 rounded-lg bg-white/[0.06] text-white/80 text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1] hover:text-white transition-colors"
            >
              See How It Works
            </a>
          </div>
        </div>
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
            <a
              href="https://rehab-vision.emergent.host"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-link-visionops"
              className="hover:text-white/80 transition-colors"
            >
              VisionOps
            </a>
            <a
              href="https://propcontrolempire.com"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="footer-link-propcontrol"
              className="hover:text-white/80 transition-colors"
            >
              PropControl
            </a>
            <Link href="/login" data-testid="footer-link-mission-control" className="hover:text-white/80 transition-colors">Mission Control</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
