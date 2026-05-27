'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MARKETPLACE_BUNDLES, MARKETPLACE_CATEGORIES, type MarketplaceBundle } from '@/lib/marketplace-bundles'

export default function MarketplacePage() {
  const [category, setCategory] = useState<'all' | MarketplaceBundle['category']>('all')
  const filtered = useMemo(
    () =>
      MARKETPLACE_BUNDLES.filter((b) => category === 'all' || b.category === category),
    [category],
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-12" data-testid="marketplace-page">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Preview · Marketplace
          </div>
          <h1 className="mt-4 text-3xl font-bold">App Store for AI Employees</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Install a curated bundle of AI employees and skills in one click. Each bundle is
            built around a specific business outcome — not a model or a framework.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap gap-2" data-testid="marketplace-filters">
          <button
            onClick={() => setCategory('all')}
            data-testid="marketplace-filter-all"
            className={cn(
              'rounded-full px-3 py-1 text-sm transition-colors',
              category === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'border border-border/50 bg-card/30 hover:bg-card/60',
            )}
          >
            All
          </button>
          {MARKETPLACE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              data-testid={`marketplace-filter-${c.id}`}
              className={cn(
                'rounded-full px-3 py-1 text-sm transition-colors',
                category === c.id
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border/50 bg-card/30 hover:bg-card/60',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="marketplace-grid">
          {filtered.map((b) => (
            <div
              key={b.id}
              data-testid={`bundle-${b.id}`}
              className="flex flex-col rounded-2xl border border-border/50 bg-card/30 p-5 transition-colors hover:bg-card/50"
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">{b.icon}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{b.name}</h3>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{b.category}</p>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">{b.tagline}</p>
              <p className="mt-2 text-sm text-muted-foreground flex-1">{b.description}</p>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded border border-border/40 bg-muted/30 p-2 text-center">
                  <div className="text-base font-bold text-primary">{b.aiEmployees.length}</div>
                  <div className="text-muted-foreground">AI employees</div>
                </div>
                <div className="rounded border border-border/40 bg-muted/30 p-2 text-center">
                  <div className="text-base font-bold text-primary">{b.skills.length}</div>
                  <div className="text-muted-foreground">skills</div>
                </div>
                <div className="rounded border border-border/40 bg-muted/30 p-2 text-center">
                  <div className="text-base font-bold text-primary">{b.estimatedHoursSavedPerMonth}h</div>
                  <div className="text-muted-foreground">saved / mo</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {b.linkedTemplateId ? (
                  <Link href="/onboarding" className="flex-1">
                    <Button
                      className="w-full"
                      data-testid={`bundle-install-${b.id}`}
                    >
                      Install Bundle →
                    </Button>
                  </Link>
                ) : (
                  <Button
                    className="flex-1"
                    variant="outline"
                    disabled
                    data-testid={`bundle-soon-${b.id}`}
                  >
                    Coming soon
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          More bundles arriving every month. Have a workflow you want as a bundle?{' '}
          <Link href="/contact" className="underline">Tell us.</Link>
        </p>
      </div>
    </div>
  )
}
