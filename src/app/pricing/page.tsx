'use client'

import { useRouter } from 'next/navigation'
import { ThemeBackground } from '@/components/ui/theme-background'
import { Button } from '@/components/ui/button'
import { LanguageSwitcherSelect } from '@/components/ui/language-switcher'

// ─────────────────────────────────────────────────────────────────────
// Mission Control pricing — Free platform · pay only for what you use.
//
// Walt's monetization rewrite (2026-06-04):
//   · No required monthly Mission Control subscription.
//   · No required Mission Control setup fee.
//   · No charge for installing workforce templates, employees, or
//     personas, or for the dashboards / Daily Brief / ROI / approvals.
//   · Customers pay for:
//       (1) AI usage credits  — Stripe checkout for credit packs
//       (2) Premium marketplace skills  — one-time purchase
//       (3) Premium marketplace workflows — one-time purchase
//
// Optional Baseline OS Done-For-You service packages live below the
// fold as a clearly-separate Baseline OS offer, not a Mission Control
// software fee.
// ─────────────────────────────────────────────────────────────────────

// These match the seeded `credit_packages` rows (see migrations.ts seed at
// id 031). If you add or rename a pack here, also update the seed migration
// and the in-app billing panel UI so the catalogue, pricing page, and
// purchase flow stay in sync.
const CREDIT_PACKS = [
  {
    packageId: 1,
    name: 'Starter',
    credits: 1_000,
    bonus: 0,
    price: 10,
    blurb: 'Try the workforce on one or two recurring jobs.',
    cta: 'Buy 1K credits',
  },
  {
    packageId: 2,
    name: 'Power',
    credits: 2_500,
    bonus: 250,
    price: 25,
    blurb: 'Sustains a small workforce on real workflows.',
    cta: 'Buy 2.75K credits',
    badge: 'Most popular',
  },
  {
    packageId: 3,
    name: 'Pro',
    credits: 5_500,
    bonus: 500,
    price: 50,
    blurb: 'For operators running multiple agents daily.',
    cta: 'Buy 6K credits',
  },
]

const INCLUDED_FREE = [
  'Mission Control dashboard',
  'Free demo employees + workforce templates',
  'Task board + approval queue',
  'Daily Brief',
  'ROI dashboard',
  'Marketplace browsing',
  'Runtime / API key management',
  'Activity feed + audit trail',
]

const MARKETPLACE_NOTES = [
  { label: 'Free skill / workflow', desc: 'Install with one click. No credits debited.' },
  { label: 'Free / demo employee', desc: 'Available without credits — clearly labelled in the marketplace.' },
  { label: 'Premium skill', desc: 'Buy with credits. Unlocks instantly after the ledger debit.' },
  { label: 'Premium workflow', desc: 'Buy with credits. Same unlock contract as premium skills.' },
  { label: 'Premium employee', desc: 'Buy with credits. One-time unlock — no Stripe per-employee checkout.' },
  { label: 'Bundle', desc: 'Buy with credits. Price is the sum of every paid item in the bundle.' },
]

const FAQ = [
  {
    q: 'Is Mission Control really free to use?',
    a: 'Yes. The platform, dashboard, agent roster, templates, Daily Brief, and ROI page are free. You pay only for AI usage (credits) and any premium marketplace items you choose to buy.',
  },
  {
    q: 'What are AI Workforce Credits?',
    a: 'Credits cover the underlying model / API cost when an agent runs a task or workflow. Each task estimates its cost up front; credits debit after the run completes. Buy in packs above.',
  },
  {
    q: 'What about the old Starter / Growth monthly plans and setup fees?',
    a: 'Those were retired on 2026-06-04. The done-for-you implementation work has moved to a separate Baseline OS service offer (see below). Mission Control software itself is free.',
  },
  {
    q: 'What happens if I run out of credits?',
    a: 'Free pages keep working. Paid execution (model / API calls and premium skills) prompts you to buy more credits — agents pause gracefully, nothing breaks.',
  },
  {
    q: 'How do premium marketplace items work?',
    a: 'You buy them with credits, not through individual Stripe checkouts. Stripe sells token packs; everything else (employees, skills, workflows, bundles, AI usage) debits credits from your workspace balance. Items unlock instantly after the ledger debit; idempotency keys make duplicate clicks safe.',
  },
  {
    q: 'Can I export my data?',
    a: 'Always. Full data portability. Export workspace data, audit logs, task history, and billing records at any time.',
  },
]

export default function PricingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      <ThemeBackground />

      <header className="relative z-10 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="/" className="text-lg font-bold tracking-tight text-foreground">
            Baseline Automations
          </a>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="/" className="text-sm text-muted-foreground hover:text-foreground">Home</a>
            <a href="/pricing" className="text-sm font-medium text-foreground">Pricing</a>
            <a href="/marketplace" className="text-sm text-muted-foreground hover:text-foreground">Marketplace</a>
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
        <section className="mx-auto mb-12 max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            Free platform · pay only for usage
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Start free. Pay only for what you use.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Mission Control is free to start. Buy credits when your workforce runs paid work
            or when you unlock premium marketplace items.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground/85 max-w-xl mx-auto">
            Start with free templates and demo employees. Add premium employees, skills, and
            workflows from the marketplace using credits.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => router.push('/signup')}>
              Start free
            </Button>
            <Button size="lg" variant="outline" onClick={() => router.push('/marketplace')}>
              Browse marketplace
            </Button>
          </div>
        </section>

        {/* What's free */}
        <section
          data-testid="free-tier"
          className="mb-16 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8"
        >
          <div className="flex items-baseline justify-between flex-wrap gap-3">
            <h2 className="text-2xl font-semibold text-foreground">Always free in Mission Control</h2>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              No credit card to enter
            </span>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED_FREE.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground/85">
                <span className="mt-0.5 text-emerald-300">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Credit packs */}
        <section data-testid="credit-packs" className="mb-16">
          <div className="mb-7 max-w-2xl">
            <h2 className="text-2xl font-semibold text-foreground">Credit packs</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Credits cover the model / API cost when an agent runs. Buy when you need them; they
              never expire. Checkout is Stripe-secured and unlocked only after a signed webhook
              confirms payment.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.name}
                data-testid={`credit-pack-${pack.credits}`}
                className="relative flex flex-col rounded-2xl border border-border/50 bg-card/40 p-6 transition-shadow hover:shadow-lg"
              >
                {pack.badge && (
                  <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                    {pack.badge}
                  </span>
                )}
                <h3 className="text-xl font-semibold text-foreground">{pack.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{pack.blurb}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">${pack.price}</span>
                  <span className="text-sm text-muted-foreground">one-time</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pack.credits.toLocaleString()} credits{pack.bonus > 0 ? ` + ${pack.bonus.toLocaleString()} bonus` : ''} · never expires
                </p>
                <Button
                  className="mt-8 w-full"
                  variant="default"
                  // Sign-up first → after login, the Billing panel uses the same
                  // packageId to call /api/billing/purchase-order which creates the
                  // Stripe Checkout session. We pass the intended package through
                  // the next URL so the post-signup flow can pre-select it once
                  // the billing panel learns to read this param.
                  onClick={() => router.push(`/signup?next=/app&billing=buy&pkg=${pack.packageId}`)}
                >
                  {pack.cta}
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* Marketplace pricing model */}
        <section data-testid="marketplace-model" className="mb-16">
          <h2 className="text-2xl font-semibold text-foreground">Marketplace pricing</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Every marketplace item is labelled free or paid. Free items install with one click; paid
            items go through Stripe checkout and unlock only after the signed webhook lands.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {MARKETPLACE_NOTES.map((row) => (
              <div
                key={row.label}
                className="rounded-xl border border-border/50 bg-card/30 p-4"
              >
                <div className="text-sm font-semibold text-foreground">{row.label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{row.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Baseline OS — Done-For-You services (separate offer) */}
        <section
          data-testid="baseline-os-services"
          className="mb-16 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8"
        >
          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
            Optional · Baseline OS Done-For-You
          </span>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">
            Want it installed for you?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            If you would rather have Baseline OS configured, integrated, and tuned for your
            business, we offer separate Baseline OS implementation packages. These are not
            Mission Control software fees — they are a different product line.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-500/15 bg-card/30 p-4">
              <div className="text-sm font-semibold text-foreground">Baseline OS · Operator setup</div>
              <div className="mt-1 text-sm text-muted-foreground">
                One-time implementation: workspace configured, default workforce installed, first
                three workflows tuned, runtimes connected. Quoted per engagement.
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/15 bg-card/30 p-4">
              <div className="text-sm font-semibold text-foreground">Baseline OS · Ongoing service</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Monthly support: weekly tuning, new workflow additions, agent-quality review.
                Quoted per engagement.
              </div>
            </div>
          </div>
          <div className="mt-6">
            <Button
              variant="outline"
              onClick={() => (window.location.href = 'mailto:hello@baselineautomations.com?subject=Baseline%20OS%20Done-For-You')}
            >
              Book a Baseline OS call
            </Button>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12 mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-semibold text-foreground">
            Pricing questions
          </h2>
          <div className="space-y-3">
            {FAQ.map((faq, i) => (
              <details
                key={i}
                className="group rounded-lg border border-border/50 bg-card/30 p-4 transition-colors hover:bg-card/50"
              >
                <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
                  {faq.q}
                  <span className="float-right text-muted-foreground group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="rounded-2xl bg-primary/5 p-10 text-center border border-primary/10">
          <h2 className="text-2xl font-semibold text-foreground">
            Start your AI workforce. Free.
          </h2>
          <p className="mt-2 text-muted-foreground">
            Create your workspace, install a free workforce template, run your first task —
            no credit card required.
          </p>
          <div className="mt-6 flex justify-center gap-3 flex-wrap">
            <Button size="lg" onClick={() => router.push('/signup')}>
              Start free
            </Button>
            <Button size="lg" variant="outline" onClick={() => router.push('/marketplace')}>
              Browse marketplace
            </Button>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/50 px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          © 2026 Baseline Automations. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
