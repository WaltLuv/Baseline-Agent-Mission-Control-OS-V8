'use client'

import { getAIEmployeeIdentity } from '@/lib/ai-employee-identity'
import { cn } from '@/lib/utils'

interface AIEmployeeCardProps {
  name: string
  status?: 'active' | 'idle' | 'paused' | 'offline'
  /** Optional metrics surfaced beneath the identity. */
  workloadPercent?: number
  recentTaskCount?: number
  trustScore?: number
  onClick?: () => void
  className?: string
  testIdSuffix?: string
}

const TRUST_COLORS: Record<'high' | 'medium' | 'building', string> = {
  high: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  medium: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  building: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
}

/**
 * AI Employee identity card. Replaces the bare "Agent #4 — running" affordance
 * with a richer presence card: avatar, codename, mission, personality,
 * strengths, current workload, and trust band.
 */
export function AIEmployeeCard({
  name,
  status = 'active',
  workloadPercent,
  recentTaskCount,
  trustScore,
  onClick,
  className,
  testIdSuffix,
}: AIEmployeeCardProps) {
  const identity = getAIEmployeeIdentity(name)
  const isInteractive = !!onClick
  const slug = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const Tag: 'button' | 'div' = isInteractive ? 'button' : 'div'
  return (
    <Tag
      data-testid={`ai-employee-card-${testIdSuffix ?? slug}`}
      onClick={onClick}
      className={cn(
        'relative w-full rounded-xl border border-border/50 bg-card/40 p-4 text-left transition-colors',
        isInteractive && 'hover:bg-card/60 hover:border-border',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-card text-2xl"
            aria-hidden
          >
            {identity.avatar}
          </div>
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
              status === 'active' && 'bg-emerald-500 animate-pulse',
              status === 'idle' && 'bg-sky-500',
              status === 'paused' && 'bg-amber-500',
              status === 'offline' && 'bg-muted-foreground/40',
            )}
            aria-label={`status: ${status}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {identity.codename}
              <span className="ml-1 text-muted-foreground font-normal">· {identity.name}</span>
            </p>
            <span
              data-testid={`ai-employee-trust-${slug}`}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                TRUST_COLORS[identity.trustBand],
              )}
            >
              {identity.trustBand} trust
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground italic">{identity.personality}</p>
          <p className="mt-1 text-xs text-foreground/90">{identity.mission}</p>

          <div className="mt-2 flex flex-wrap gap-1">
            {identity.strengths.map((s) => (
              <span
                key={s}
                className="rounded border border-border/40 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>

          {(workloadPercent !== undefined || recentTaskCount !== undefined || trustScore !== undefined) && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
              {workloadPercent !== undefined && (
                <div className="rounded bg-muted/30 p-1.5 text-center">
                  <p className="text-base font-bold text-foreground">{workloadPercent}%</p>
                  <p className="text-muted-foreground">workload</p>
                </div>
              )}
              {recentTaskCount !== undefined && (
                <div className="rounded bg-muted/30 p-1.5 text-center">
                  <p className="text-base font-bold text-foreground">{recentTaskCount}</p>
                  <p className="text-muted-foreground">tasks / wk</p>
                </div>
              )}
              {trustScore !== undefined && (
                <div className="rounded bg-muted/30 p-1.5 text-center">
                  <p className="text-base font-bold text-foreground">{trustScore}</p>
                  <p className="text-muted-foreground">trust score</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Tag>
  )
}
