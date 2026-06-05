'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MarketplaceInstallModal } from '@/components/marketplace/install-modal'
import { ItemStateBadge, buttonLabelFor, deriveItemState, type ItemState } from '@/components/marketplace/item-state-badge'
import { usdToCredits } from '@/lib/credits-config'
import {
  SKILLS,
  EMPLOYEES,
  BUNDLES,
  SKILL_CATEGORIES,
  EMPLOYEE_DIVISIONS,
  type Difficulty,
  type SkillProduct,
  type EmployeeProduct,
  type Bundle,
} from '@/lib/marketplace-catalog'

interface MarketplaceState {
  balance: { credits: number }
  purchased: { skills: string[]; workflows: string[]; employees: string[]; bundles: string[] }
}

/**
 * Mission Control Marketplace — App Store for AI Employees & Skills.
 *
 * Three product types:
 *   - AI Employees (monthly subscription, "Hire AI Employee")
 *   - Skills      (one-time, "Install Skill")
 *   - Bundles     (preset team + skill packs, "Deploy Team")
 *
 * Filters: type · category/division · difficulty · price range · billing.
 */

type ProductType = 'employees' | 'skills' | 'bundles'

const DIFFICULTIES: Difficulty[] = ['Easy', 'Standard', 'Moderate', 'Advanced', 'Expert']

export default function MarketplacePage() {
  const [tab, setTab] = useState<ProductType>('employees')
  const [skillCategory, setSkillCategory] = useState<'all' | typeof SKILL_CATEGORIES[number]>('all')
  const [division, setDivision] = useState<'all' | typeof EMPLOYEE_DIVISIONS[number]>('all')
  const [difficulty, setDifficulty] = useState<'all' | Difficulty>('all')
  const [maxPrice, setMaxPrice] = useState<number>(0) // 0 = no limit
  const [query, setQuery] = useState<string>('')

  // Install modal target — null when modal is closed.
  type InstallTarget =
    | { kind: 'skill'; product: SkillProduct }
    | { kind: 'employee'; product: EmployeeProduct }
    | { kind: 'bundle'; product: Bundle }
  const [installing, setInstalling] = useState<InstallTarget | null>(null)

  // Card that's currently playing the hire-shimmer animation. Brief
  // premium flash before the install modal mounts — feels like committing
  // a hire decision, not opening a tab.
  const [shimmerSlug, setShimmerSlug] = useState<string | null>(null)
  function beginInstall(target: InstallTarget) {
    setShimmerSlug(target.product.slug)
    // Hold the shimmer for the full keyframe before the modal mounts so
    // operators see the card commit. 320ms feels intentional, not laggy.
    window.setTimeout(() => {
      setInstalling(target)
    }, 320)
    window.setTimeout(() => {
      setShimmerSlug(null)
    }, 750)
  }

  // ── Credit-aware state context ─────────────────────────────────────
  // Loads balance + purchased-slugs so cards can render the right state
  // (Free / Included / X credits / Purchased / Insufficient credits).
  // When unauthenticated or unreachable, falls back to a fresh-workspace
  // assumption (balance=0, nothing purchased) so the price badge still
  // shows and the install modal will prompt for login when needed.
  const [marketState, setMarketState] = useState<MarketplaceState | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/marketplace/state', { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MarketplaceState | null) => {
        if (!cancelled && data) setMarketState(data)
      })
      .catch(() => { /* silent — unauth or offline */ })
    return () => { cancelled = true }
  }, [])

  function stateForSkill(s: SkillProduct): ItemState {
    const purchased = marketState?.purchased.skills.includes(s.slug) ?? false
    return deriveItemState({
      priceCredits: usdToCredits(s.priceUsd),
      pricingType: s.priceUsd > 0 ? 'credits' : 'free',
      purchased,
      balance: marketState?.balance.credits ?? 0,
    })
  }
  function stateForEmployee(e: EmployeeProduct): ItemState {
    const purchased = marketState?.purchased.employees.includes(e.slug) ?? false
    return deriveItemState({
      priceCredits: usdToCredits(e.monthlyUsd),
      pricingType: e.monthlyUsd > 0 ? 'credits' : 'free',
      purchased,
      balance: marketState?.balance.credits ?? 0,
    })
  }
  function stateForBundle(b: Bundle): ItemState {
    // Bundle price = sum of child item credits (employees + paid skills).
    let total = 0
    for (const slug of b.employeeSlugs) {
      const e = EMPLOYEES.find((x) => x.slug === slug)
      if (e) total += usdToCredits(e.monthlyUsd)
    }
    for (const slug of b.skillSlugs) {
      const sk = SKILLS.find((x) => x.slug === slug)
      if (sk) total += usdToCredits(sk.priceUsd)
    }
    const purchased = marketState?.purchased.bundles.includes(b.slug) ?? false
    return deriveItemState({
      priceCredits: total,
      pricingType: total > 0 ? 'credits' : 'free',
      purchased,
      balance: marketState?.balance.credits ?? 0,
    })
  }

  // ---------- AI EMPLOYEES ----------
  const filteredEmployees = useMemo(() => {
    return EMPLOYEES.filter((e) => {
      if (division !== 'all' && e.division !== division) return false
      if (maxPrice > 0 && e.monthlyUsd > maxPrice) return false
      if (query && !`${e.name} ${e.role} ${e.outcome}`.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [division, maxPrice, query])

  // ---------- SKILLS ----------
  const filteredSkills = useMemo(() => {
    return SKILLS.filter((s) => {
      if (skillCategory !== 'all' && s.category !== skillCategory) return false
      if (difficulty !== 'all' && s.difficulty !== difficulty) return false
      if (maxPrice > 0 && s.priceUsd > maxPrice) return false
      if (query && !`${s.name} ${s.outcome} ${s.improvesWorkflow}`.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [skillCategory, difficulty, maxPrice, query])

  // ---------- BUNDLES ----------
  const filteredBundles = useMemo(() => {
    return BUNDLES.filter((b) => {
      if (query && !`${b.name} ${b.tagline}`.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [query])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-12" data-testid="marketplace-page">
        <header className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Workforce
          </div>
          <h1 className="mt-4 text-3xl font-bold">Hire AI Employees. Install AI Skills. Deploy AI Teams.</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Every hire becomes a measurable asset in your business — billable hours saved,
            value created, work owned. <span data-testid="catalog-counts" className="text-foreground/70">
              {EMPLOYEES.length} roles · {SKILLS.length} skills · {BUNDLES.length} pre-built teams ready to deploy.
            </span>
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3" data-testid="marketplace-outcomes">
            <div className="rounded-lg border border-border/40 bg-card/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Hire</p>
              <p className="mt-1 text-xs text-foreground/90">Roles that do the work — bookkeeping, intake, dispatch, comms.</p>
            </div>
            <div className="rounded-lg border border-border/40 bg-card/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Install</p>
              <p className="mt-1 text-xs text-foreground/90">Capabilities your team uses — drafting, sending, recovering, escalating.</p>
            </div>
            <div className="rounded-lg border border-border/40 bg-card/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Deploy</p>
              <p className="mt-1 text-xs text-foreground/90">Pre-built teams — a CPA back office or property-management desk in one click.</p>
            </div>
          </div>
        </header>

        {/* Product-type tabs */}
        <div className="mb-4 flex gap-1 border-b border-border/40" data-testid="marketplace-tabs">
          {(
            [
              { id: 'employees', label: `AI Employees (${EMPLOYEES.length})`, testId: 'tab-employees' },
              { id: 'skills', label: `Skills (${SKILLS.length})`, testId: 'tab-skills' },
              { id: 'bundles', label: `Bundles (${BUNDLES.length})`, testId: 'tab-bundles' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={t.testId}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto_auto]" data-testid="marketplace-filters">
          <input
            type="search"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="marketplace-search"
            className="rounded-md border border-border/50 bg-card/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />

          {tab === 'employees' && (
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value as typeof division)}
              data-testid="filter-division"
              className="rounded-md border border-border/50 bg-card/30 px-3 py-2 text-sm"
            >
              <option value="all">All divisions</option>
              {EMPLOYEE_DIVISIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}

          {tab === 'skills' && (
            <>
              <select
                value={skillCategory}
                onChange={(e) => setSkillCategory(e.target.value as typeof skillCategory)}
                data-testid="filter-category"
                className="rounded-md border border-border/50 bg-card/30 px-3 py-2 text-sm"
              >
                <option value="all">All categories</option>
                {SKILL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                data-testid="filter-difficulty"
                className="rounded-md border border-border/50 bg-card/30 px-3 py-2 text-sm"
              >
                <option value="all">Any difficulty</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </>
          )}

          <select
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            data-testid="filter-price"
            className="rounded-md border border-border/50 bg-card/30 px-3 py-2 text-sm"
          >
            <option value={0}>Any price</option>
            <option value={50}>Up to $50</option>
            <option value={100}>Up to $100</option>
            <option value={250}>Up to $250</option>
            <option value={500}>Up to $500</option>
          </select>
        </div>

        {/* AI EMPLOYEES */}
        {tab === 'employees' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="employees-grid">
            {filteredEmployees.map((e) => {
              const state = stateForEmployee(e)
              const label = buttonLabelFor(state, 'employee')
              const disabled = state.kind === 'included' || state.kind === 'purchased' || state.kind === 'locked'
              return (
              <article
                key={e.slug}
                data-testid={`product-employee-${e.slug}`}
                data-state={state.kind}
                className={cn(
                  'flex flex-col rounded-2xl border border-border/50 bg-card/30 p-5 transition-all hover:border-primary/40 hover:bg-card/50 hover:-translate-y-0.5',
                  shimmerSlug === e.slug && 'hire-shimmer border-primary/60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.division}</p>
                    <h3 className="text-lg font-semibold">{e.name}</h3>
                    <p className="text-xs text-muted-foreground">{e.role}</p>
                  </div>
                  <ItemStateBadge state={state} testId={`badge-employee-${e.slug}`} />
                </div>
                <p className="mt-3 text-sm text-foreground/90 flex-1">{e.outcome}</p>
                <p className="mt-2 text-xs text-muted-foreground">For: {e.forWhom}</p>
                <div className="mt-4 flex items-end justify-end">
                  {state.kind === 'insufficient_credits' ? (
                    <Link href="/app?billing=buy&pkg=2" className="text-xs font-semibold text-amber-300 hover:text-amber-200">
                      {label}
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      data-testid={`hire-${e.slug}`}
                      disabled={disabled}
                      onClick={() => beginInstall({ kind: 'employee', product: e })}
                    >
                      {label}
                    </Button>
                  )}
                </div>
              </article>
            )})}
            {filteredEmployees.length === 0 && <EmptyState />}
          </div>
        )}

        {/* SKILLS */}
        {tab === 'skills' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="skills-grid">
            {filteredSkills.map((s) => {
              const state = stateForSkill(s)
              const label = buttonLabelFor(state, 'skill')
              const disabled = state.kind === 'included' || state.kind === 'purchased' || state.kind === 'locked'
              return (
              <article
                key={s.slug}
                data-testid={`product-skill-${s.slug}`}
                data-state={state.kind}
                className={cn(
                  'flex flex-col rounded-2xl border border-border/50 bg-card/30 p-5 transition-all hover:border-primary/40 hover:bg-card/50 hover:-translate-y-0.5',
                  shimmerSlug === s.slug && 'hire-shimmer border-primary/60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.category}</p>
                    <h3 className="text-base font-semibold">{s.name}</h3>
                  </div>
                  <ItemStateBadge state={state} testId={`badge-skill-${s.slug}`} />
                </div>
                <p className="mt-3 text-sm text-foreground/90 flex-1">{s.outcome}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  <span className="rounded border border-border/40 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {s.difficulty}
                  </span>
                  <span className="rounded border border-border/40 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Saves {s.timeSaved}
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-end">
                  {state.kind === 'insufficient_credits' ? (
                    <Link href="/app?billing=buy&pkg=2" className="text-xs font-semibold text-amber-300 hover:text-amber-200">
                      {label}
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`install-${s.slug}`}
                      disabled={disabled}
                      onClick={() => beginInstall({ kind: 'skill', product: s })}
                    >
                      {label}
                    </Button>
                  )}
                </div>
              </article>
            )})}
            {filteredSkills.length === 0 && <EmptyState />}
          </div>
        )}

        {/* BUNDLES */}
        {tab === 'bundles' && (
          <div className="grid gap-4 md:grid-cols-2" data-testid="bundles-grid">
            {filteredBundles.map((b) => {
              const state = stateForBundle(b)
              const label = buttonLabelFor(state, 'bundle')
              const disabled = state.kind === 'included' || state.kind === 'purchased' || state.kind === 'locked'
              return (
              <article
                key={b.slug}
                data-testid={`product-bundle-${b.slug}`}
                data-state={state.kind}
                className={cn(
                  'flex flex-col rounded-2xl border border-border/50 bg-card/30 p-5 transition-all hover:border-primary/40 hover:bg-card/50',
                  shimmerSlug === b.slug && 'hire-shimmer border-primary/60',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{b.icon}</div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{b.category}</p>
                    <h3 className="text-lg font-semibold">{b.name}</h3>
                    <p className="mt-1 text-sm text-foreground/90">{b.tagline}</p>
                  </div>
                  <ItemStateBadge state={state} testId={`badge-bundle-${b.slug}`} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <Stat label="AI employees" value={b.employeeSlugs.length} />
                  <Stat label="Skills" value={b.skillSlugs.length} />
                  <Stat label="Hours / mo" value={b.estimatedHoursSavedPerMonth} />
                </div>
                <div className="mt-4 flex gap-2">
                  {b.linkedDemoTemplate ? (
                    <Link href={`/app/overview?demo=${b.linkedDemoTemplate}`} className="flex-1">
                      <Button variant="outline" className="w-full" data-testid={`preview-${b.slug}`}>
                        Preview live
                      </Button>
                    </Link>
                  ) : null}
                  {state.kind === 'insufficient_credits' ? (
                    <Link href="/app?billing=buy&pkg=2" className="flex-1">
                      <Button variant="outline" className="w-full" data-testid={`deploy-${b.slug}`}>
                        {label}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      className="flex-1"
                      data-testid={`deploy-${b.slug}`}
                      disabled={disabled}
                      onClick={() => beginInstall({ kind: 'bundle', product: b })}
                    >
                      {label}
                    </Button>
                  )}
                </div>
              </article>
            )})}
            {filteredBundles.length === 0 && <EmptyState />}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          <Link href="/contact" className="underline">Talk to us</Link> about custom AI employees or skills for your business.
        </p>
      </div>

      {installing && (
        <MarketplaceInstallModal
          target={
            installing.kind === 'employee'
              ? {
                  type: 'employee',
                  slug: installing.product.slug,
                  title: installing.product.name,
                  subtitle: installing.product.role,
                  priceLine: `$${installing.product.monthlyUsd.toLocaleString()}/mo`,
                  outcome: installing.product.outcome,
                  forWhom: installing.product.forWhom,
                  estimatedValueLine: `~$${(installing.product.monthlyUsd * 8).toLocaleString()}/mo of labor replaced`,
                }
              : installing.kind === 'skill'
              ? {
                  type: 'skill',
                  slug: installing.product.slug,
                  title: installing.product.name,
                  subtitle: installing.product.category,
                  priceLine: `$${installing.product.priceUsd}`,
                  outcome: installing.product.outcome,
                  forWhom: installing.product.forWhom,
                  expectedHoursSaved: installing.product.timeSaved,
                }
              : {
                  type: 'bundle',
                  slug: installing.product.slug,
                  title: installing.product.name,
                  subtitle: installing.product.tagline,
                  priceLine: `$${installing.product.monthlyUsd.toLocaleString()}/mo + $${installing.product.oneTimeUsd} one-time`,
                  outcome: installing.product.tagline,
                  forWhom: 'Teams that want a turnkey workforce',
                  expectedHoursSaved: `${installing.product.estimatedHoursSavedPerMonth} hours/month`,
                }
          }
          onClose={() => setInstalling(null)}
        />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-border/40 bg-muted/30 p-2 text-center">
      <div className="text-base font-bold text-primary">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="col-span-full rounded-lg border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">
      Nothing matches those filters. Try clearing some.
    </div>
  )
}
