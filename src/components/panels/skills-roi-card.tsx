'use client'

import React from 'react'
import type { SkillROI } from '@/lib/skills-roi'

interface SkillsROICardProps {
  roi: SkillROI
  compact?: boolean
}

export function SkillsROICard({ roi, compact }: SkillsROICardProps) {
  const barWidth = Math.min(100, Math.max(roi.roiPercent > 0 ? roi.roiPercent / 5 : 0, 2))
  const isPositive = roi.netSavings > 0

  if (compact) {
    return (
      <div className="bg-[hsl(var(--surface-1))] border border-border/50 rounded-lg p-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-semibold text-foreground truncate flex-1" title={roi.skillName}>
            {roi.skillName}
          </span>
          <span className={`text-[10px] font-mono tabular-nums ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {roi.roiPercent.toFixed(0)}% ROI
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/60 tabular-nums">
          <span>{roi.invocations} runs</span>
          <span>{roi.estimatedMinutesSaved}min saved</span>
          <span>${roi.laborValueSaved.toFixed(2)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[hsl(var(--surface-1))] border border-border/50 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold font-mono text-foreground truncate" title={roi.skillName}>
          {roi.skillName}
        </h3>
        <span
          className={`text-xs font-bold font-mono tabular-nums px-2 py-0.5 rounded ${
            isPositive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}
        >
          {roi.roiPercent.toFixed(1)}% ROI
        </span>
      </div>

      {/* ROI Bar */}
      {roi.roiPercent > 0 && (
        <div className="h-1 bg-[hsl(var(--surface-0))] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              roi.roiPercent >= 500 ? 'bg-green-500' : roi.roiPercent >= 100 ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
            style={{ width: `${Math.min(100, barWidth)}%`, opacity: 0.7 }}
          />
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricItem label="Invocations" value={String(roi.invocations)} />
        <MetricItem label="Minutes Saved" value={`${roi.estimatedMinutesSaved}`} />
        <MetricItem label="Labor Value Saved" value={`$${roi.laborValueSaved.toFixed(2)}`} />
        <MetricItem label="Credits Used" value={`${roi.creditsUsed}`} />
        <MetricItem label="AI Cost" value={`${(roi.aiCostCents / 100).toFixed(2)}`} prefix="$" />
        <MetricItem
          label="Net Savings"
          value={`$${roi.netSavings.toFixed(2)}`}
          variant={isPositive ? 'positive' : 'negative'}
        />
      </div>
    </div>
  )
}

function MetricItem({
  label,
  value,
  prefix = '',
  variant,
}: {
  label: string
  value: string
  prefix?: string
  variant?: 'positive' | 'negative'
}) {
  const color =
    variant === 'positive' ? 'text-green-400' : variant === 'negative' ? 'text-red-400' : 'text-foreground/80'

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-mono font-semibold tabular-nums ${color}`}>
        {prefix}{value}
      </span>
    </div>
  )
}
