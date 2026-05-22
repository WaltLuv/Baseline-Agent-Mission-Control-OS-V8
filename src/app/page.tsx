'use client'

import Link from 'next/link'

function SparkIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  )
}

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

function FeatureIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
      {children}
    </div>
  )
}

const features = [
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" rx="2" ry="2" width="18" height="18" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
    title: 'Deploy AI Agents',
    desc: 'Spin up autonomous workers for maintenance dispatch, tenant communication, invoice processing, and more — in seconds.',
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
      </svg>
    ),
    title: 'Supervise Workflows',
    desc: 'Real-time visibility into every agent task, approval queue, and escalation — with human intervention when it matters.',
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    title: 'Track Costs',
    desc: 'Per-agent, per-property, per-workspace cost tracking. Know exactly what each AI employee costs down to the cent.',
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22,4 12,14.01 9,11" />
      </svg>
    ),
    title: 'Quality Gates',
    desc: 'Define approval thresholds, validation rules, and quality checks that every agent output must pass before delivery.',
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" rx="2" width="20" height="14" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
    title: 'Multi-Tenant Workspaces',
    desc: 'Isolated workspaces per property, team, or client. Share agents across portfolios without cross-contamination.',
  },
  {
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
    title: 'Security Scanning',
    desc: 'Automated vulnerability detection, prompt injection defense, and role-based access controls for every deployment.',
  },
]

const steps = [
  {
    num: '01',
    title: 'Setup',
    desc: 'Connect your property management tools, define team roles, and configure your workspace in under 5 minutes.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Deploy',
    desc: 'Choose from pre-built agent templates or create custom AI employees. Assign them to workflows with one click.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Supervise',
    desc: 'Monitor, approve, and steer your AI workforce from a single command center. Real-time logs, metrics, and alerts.',
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
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] antialiased overflow-hidden">
      {/* Global glow */}
      <div className="pointer-events-none fixed inset-0 -z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-violet-600/15 blur-[140px] rounded-full" />
        <div className="absolute top-[200px] right-[15%] w-[400px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full" />
      </div>

      {/* ─── HEADER ─── */}
      <header className="relative z-10 border-b border-white/[0.06] backdrop-blur-xl bg-[#09090b]/70">
        <div className="mx-auto max-w-screen-xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <div className="w-7 h-7 rounded-md bg-violet-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5L8 2z" />
              </svg>
            </div>
            Baseline Automations
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-white/50 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-white/50 hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="text-sm text-white/50 hover:text-white transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors px-3 py-1.5">
              Sign In
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] rounded-lg px-3.5 py-1.5 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative z-10 mx-auto max-w-screen-xl px-6 pt-20 pb-24 md:pt-32 md:pb-36 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 px-3.5 py-1 text-[13px] font-medium text-violet-300 mb-8">
          <SparkIcon />
          AI Workforce OS for Property Management
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
          <span className="bg-gradient-to-b from-white via-white to-white/50 bg-clip-text text-transparent">
            The AI Workforce
          </span>
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Operating System
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base md:text-lg text-white/45 leading-relaxed">
          Property managers, contractors, and service businesses deploy AI employees and supervise them in one command center.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="h-11 px-6 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90 transition-colors flex items-center gap-2"
          >
            Book a Demo
            <ArrowRight />
          </Link>
          <a
            href="#pricing"
            className="h-11 px-6 rounded-lg bg-white/[0.06] text-white/80 text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1] hover:text-white transition-colors"
          >
            View Pricing
          </a>
        </div>

        {/* Trust line */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-white/25 font-medium tracking-wide uppercase">
          <span>Property Managers</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>General Contractors</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>Service Businesses</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>Facilities Teams</span>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24 md:pb-36">
        <div className="mb-14">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Everything to manage your{' '}
            <span className="text-violet-400">AI workforce</span>
          </h2>
          <p className="mt-3 text-white/40 max-w-lg">
            One platform for deployment, supervision, cost control, and security — built for teams that operate at scale.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(f => (
            <div
              key={f.title}
              className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-violet-500/20 hover:bg-violet-500/[0.03] transition-colors"
            >
              <FeatureIcon>{f.icon}</FeatureIcon>
              <h3 className="mt-4 text-sm font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-white/40 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section
        id="how-it-works"
        className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24 md:pb-36"
      >
        <div className="text-center mb-14">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Three steps to <span className="text-violet-400">full autonomy</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-12">
          {steps.map((step, i) => (
            <div key={step.num} className="relative">
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
                  <p className="mt-2 text-sm text-white/40 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── ROI / TESTIMONIAL ─── */}
      <section className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24 md:pb-36">
        <div className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-br from-violet-500/[0.06] to-blue-500/[0.04] overflow-hidden">
          {/* Subtle inner border glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-transparent to-blue-500/10 opacity-40" />
          <div className="relative px-8 py-14 md:px-16 md:py-20 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 mb-6">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23,6 13.5,15.5 8.5,10.5 1,18" />
                <polyline points="17,6 23,6 23,12" />
              </svg>
            </div>
            <blockquote className="mx-auto max-w-2xl text-xl md:text-2xl font-light leading-relaxed text-white/80">
              &ldquo;We save{' '}
              <span className="text-white font-medium">20+ hours per week</span>{' '}
              on property maintenance workflows. Baseline Automations turned our reactive operations into a proactive AI-driven machine.&rdquo;
            </blockquote>
            <div className="mt-8 grid grid-cols-3 gap-6 max-w-md mx-auto">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-white">20+</div>
                <div className="text-xs text-white/40 mt-1 uppercase tracking-wide font-medium">Hours Saved / Week</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-bold text-white">3.2×</div>
                <div className="text-xs text-white/40 mt-1 uppercase tracking-wide font-medium">Faster Dispatch</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-bold text-white">40%</div>
                <div className="text-xs text-white/40 mt-1 uppercase tracking-wide font-medium">Cost Reduction</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PRICING TEASER ─── */}
      <section id="pricing" className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24 md:pb-36">
        <div className="text-center mb-14">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Pricing that <span className="text-violet-400">scales with you</span>
          </h2>
          <p className="mt-3 text-white/40 max-w-lg mx-auto">
            Start free. Upgrade as your AI workforce grows. No hidden fees, no surprises.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto">
          {/* Free */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <span className="inline-block text-xs font-medium uppercase tracking-wider text-white/40 mb-2">Starter</span>
            <div className="text-3xl font-bold">Free</div>
            <p className="mt-2 text-sm text-white/35">For evaluating the platform.</p>
            <ul className="mt-5 space-y-2 text-sm text-white/50">
              <li className="flex items-center gap-2"><CheckCircleIcon /> 1 AI Agent</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> Basic workflows</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> 7-day log history</li>
            </ul>
          </div>

          {/* Pro — highlighted */}
          <div className="relative rounded-xl border border-violet-500/25 bg-violet-500/[0.04] p-6">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-wider text-violet-300 bg-violet-500/20 border border-violet-500/30 rounded-full px-3 py-0.5">
              Popular
            </span>
            <span className="inline-block text-xs font-medium uppercase tracking-wider text-violet-300/80 mb-2">Professional</span>
            <div className="mt-1 text-3xl font-bold">$49<span className="text-base font-normal text-white/40">/mo</span></div>
            <p className="mt-2 text-sm text-white/35">For growing teams.</p>
            <ul className="mt-5 space-y-2 text-sm text-white/50">
              <li className="flex items-center gap-2"><CheckCircleIcon /> Up to 10 Agents</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> All workflows</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> Quality gates</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> 90-day log history</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> Priority support</li>
            </ul>
          </div>

          {/* Enterprise */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <span className="inline-block text-xs font-medium uppercase tracking-wider text-white/40 mb-2">Enterprise</span>
            <div className="text-3xl font-bold">Custom</div>
            <p className="mt-2 text-sm text-white/35">For large portfolios.</p>
            <ul className="mt-5 space-y-2 text-sm text-white/50">
              <li className="flex items-center gap-2"><CheckCircleIcon /> Unlimited Agents</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> Multi-tenant</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> Security scanning</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> SSO &amp; audit logs</li>
              <li className="flex items-center gap-2"><CheckCircleIcon /> Dedicated support</li>
            </ul>
          </div>
        </div>

        <div className="text-center mt-10">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
          >
            View Full Pricing
            <ArrowRight />
          </Link>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative z-10 mx-auto max-w-screen-xl px-6 pb-24 md:pb-36">
        <div className="text-center rounded-2xl border border-white/[0.06] bg-white/[0.02] px-8 py-14 md:px-16 md:py-20">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Ready to deploy your <span className="text-violet-400">first AI employee</span>?
          </h2>
          <p className="mt-4 text-white/40 max-w-md mx-auto">
            Get started in minutes. No credit card required.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="h-11 px-6 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90 transition-colors flex items-center gap-2"
            >
              Start Free
              <ArrowRight />
            </Link>
            <a
              href="#features"
              className="h-11 px-6 rounded-lg bg-white/[0.06] text-white/80 text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1] hover:text-white transition-colors"
            >
              Learn More
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
          <div className="flex items-center gap-6 text-sm text-white/30">
            <a href="#" className="hover:text-white/60 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/60 transition-colors">Terms</a>
            <Link href="/login" className="hover:text-white/60 transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
