'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ThemeBackground } from '@/components/ui/theme-background'
import { Button } from '@/components/ui/button'
import { LanguageSwitcherSelect } from '@/components/ui/language-switcher'
import { cn } from '@/lib/utils'

export default function PricingPage() {
  const router = useRouter()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  const plans = [
    {
      name: 'Starter',
      description: 'For small teams getting started with AI agents',
      setupFee: 1500,
      monthly: 499,
      annual: 399,
      features: [
        'Up to 3 AI Agents',
        '1 Workspace',
        '5,000 AI Workforce Credits/month',
        '5 Workflow Templates',
        'Email Support',
        'Basic Security Scanning',
        'Task Board + Quality Gates',
      ],
      cta: 'Start Pilot',
      highlighted: false,
      badge: '',
    },
    {
      name: 'Growth',
      description: 'For teams scaling their AI workforce',
      setupFee: 3000,
      monthly: 1499,
      annual: 1199,
      features: [
        'Up to 15 AI Agents',
        '5 Workspaces',
        '25,000 AI Workforce Credits/month',
        'Unlimited Workflow Templates',
        'Priority Support + Slack',
        'Advanced Security Scanning',
        'Cost Tracking + ROI Dashboard',
        'Multi-Gateway Support',
        'Webhooks + Cron Automation',
        'Soul ID + Character Consistency',
      ],
      cta: 'Get Started',
      highlighted: true,
      badge: 'Most Popular',
    },
    {
      name: 'Enterprise',
      description: 'For organizations running AI at scale',
      setupFee: null,
      monthly: null,
      annual: null,
      features: [
        'Unlimited AI Agents',
        'Unlimited Workspaces',
        'Custom AI Workforce Credits',
        'Custom Workflow Templates',
        'Dedicated Account Manager',
        'Full Security Suite + Audit Logs',
        'Custom Integrations',
        'SLA Guarantee',
        'On-Premise Deployment Option',
        'Custom Gateway Routing',
      ],
      cta: 'Book Enterprise Demo',
      highlighted: false,
      badge: '',
    },
  ]

  const roiStats = [
    { metric: 'Hours Saved/Week', value: '20+', label: 'Per property manager' },
    { metric: 'Setup Time', value: '&lt; 1 hour', label: 'From signup to first AI task' },
    { metric: 'Cost per Task', value: '80¢', label: 'vs $15+ manual processing' },
    { metric: 'Response Time', value: '&lt; 30s', label: 'For maintenance intake triage' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <ThemeBackground />

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="/" className="text-lg font-bold tracking-tight text-foreground">
            Baseline Automations
          </a>

          <nav className="hidden items-center gap-6 md:flex">
            <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
              Home
            </a>
            <a href="/pricing" className="text-sm font-medium text-foreground">
              Pricing
            </a>

            <Button variant="outline" size="sm" onClick={() => router.push('/login')}>
              Login
            </Button>
          </nav>
          <div className="block md:hidden">
            <LanguageSwitcherSelect />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        {/* Hero */}
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            We install AI employees into your business, and Mission Control is where you supervise
            them, track work, approve outputs, and see ROI.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <span
              className={cn(
                'cursor-pointer px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
                billingCycle === 'monthly'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly
            </span>
            <span
              className={cn(
                'cursor-pointer px-4 py-1.5 text-sm font-medium rounded-full transition-colors',
                billingCycle === 'annual'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
              onClick={() => setBillingCycle('annual')}
            >
              Annual <span className="text-xs opacity-70">(Save 20%)</span>
            </span>
          </div>
        </div>

        {/* Plans */}
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'relative flex flex-col rounded-2xl border p-6 transition-shadow hover:shadow-lg',
                plan.highlighted
                  ? 'border-primary/50 shadow-lg shadow-primary/10 ring-1 ring-primary/20'
                  : 'border-border/50',
              )}
            >
              {plan.badge && (
                <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  {plan.badge}
                </span>
              )}
              <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>

              <div className="mt-6">
                {plan.setupFee !== null ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">
                        ${billingCycle === 'annual' ? plan.annual : plan.monthly}
                      </span>
                      <span className="text-sm text-muted-foreground">/month</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      ${plan.setupFee.toLocaleString()} setup fee
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      Credit packs available at $0.10/credit
                    </p>
                  </>
                ) : (
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold text-foreground">Custom</span>
                  </div>
                )}
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="mt-0.5 text-green-500">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                className="mt-8 w-full"
                variant={plan.highlighted ? 'default' : 'outline'}
                onClick={() => window.location.href = '/login'}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>

        {/* ROI Stats */}
        <div className="mt-20">
          <h2 className="mb-8 text-center text-2xl font-semibold text-foreground">
            Proven ROI from Day One
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {roiStats.map((stat) => (
              <div
                key={stat.metric}
                className="rounded-xl border border-border/50 bg-card/50 p-6 text-center backdrop-blur-sm"
              >
                <div
                  className="text-3xl font-bold text-primary"
                  dangerouslySetInnerHTML={{ __html: stat.value }}
                />
                <div className="mt-1 text-sm font-medium text-foreground">{stat.metric}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-semibold text-foreground">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'What are AI Workforce Credits?',
                a: 'Credits measure AI agent activity — each task, workflow run, or API call consumes credits. You buy credits in packs and track usage per agent, per project, per workspace.',
              },
              {
                q: 'How long does setup take?',
                a: 'Under 1 hour from signup. Our wizard creates your workspace, provisions default agents, installs skills, and walks you through your first AI task.',
              },
              {
                q: 'Can I try before buying?',
                a: 'Yes. Every paid plan includes a 30-day pilot at discounted rates. You get full Mission Control access, 1–3 AI employees, weekly optimization, and a before/after ROI report.',
              },
              {
                q: 'Do I need to install anything?',
                a: 'No infrastructure required. Mission Control is fully hosted. We handle deployment, uptime, security updates, and backups. You just log in.',
              },
              {
                q: 'What happens if I run out of credits?',
                a: 'Your agents pause gracefully — nothing breaks. You can purchase additional credit packs anytime from the billing dashboard.',
              },
              {
                q: 'Can I export my data?',
                a: 'Always. Full data portability. Export workspace data, audit logs, task history, and billing records at any time.',
              },
            ].map((faq, i) => (
              <details
                key={i}
                className="group rounded-lg border border-border/50 bg-card/30 p-4 transition-colors hover:bg-card/50"
              >
                <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
                  {faq.q}
                  <span className="float-right text-muted-foreground group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 rounded-2xl bg-primary/5 p-10 text-center border border-primary/10">
          <h2 className="text-2xl font-semibold text-foreground">
            Ready to Deploy Your AI Workforce?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Book a demo or start a pilot — see ROI in 30 days, guaranteed.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Button size="lg" onClick={() => (window.location.href = '/login')}>
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => (window.location.href = 'mailto:hello@baselineautomations.com')}
            >
              Book a Demo
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          © 2026 Baseline Automations. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
