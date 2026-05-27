'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { BUSINESS_TEMPLATES } from '@/lib/business-templates'

const FULLY_LOADED_HOURLY = 35 // conservative US small-business labor cost

export default function ROICalculatorPage() {
  const [templateId, setTemplateId] = useState(BUSINESS_TEMPLATES[0].id)
  const [hourlyRate, setHourlyRate] = useState(FULLY_LOADED_HOURLY)
  const [extraHours, setExtraHours] = useState(0)
  const [creditSpendPerMonth, setCreditSpendPerMonth] = useState(25) // dollars

  const tpl = useMemo(
    () => BUSINESS_TEMPLATES.find((t) => t.id === templateId) ?? BUSINESS_TEMPLATES[0],
    [templateId],
  )

  const totalHours = tpl.estimatedHoursSavedPerMonth + extraHours
  const laborValue = totalHours * hourlyRate
  const monthlyCost = creditSpendPerMonth
  const monthlyGain = laborValue - monthlyCost
  const annualGain = monthlyGain * 12
  const roiMultiple = monthlyCost > 0 ? laborValue / monthlyCost : 0

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12" data-testid="roi-calculator">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            ROI Calculator
          </p>
          <h1 className="mt-2 text-3xl font-bold">How much will your AI workforce save you?</h1>
          <p className="mt-2 text-muted-foreground">
            Estimate the labor value freed up by an AI workforce and how it compares to credit cost.
          </p>
        </header>

        <div className="grid gap-4 rounded-2xl border border-border/50 bg-card/30 p-6">
          <label className="block">
            <span className="text-sm font-medium">Your business</span>
            <select
              data-testid="roi-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
            >
              {BUSINESS_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Fully-loaded hourly cost of admin / coordinator labor</span>
            <input
              type="number"
              min="10"
              max="200"
              data-testid="roi-hourly-rate"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
            <span className="text-xs text-muted-foreground">USD / hour. Default $35 is conservative for US small business.</span>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Extra hours you expect to save above the baseline</span>
            <input
              type="number"
              min="0"
              max="200"
              data-testid="roi-extra-hours"
              value={extraHours}
              onChange={(e) => setExtraHours(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
            <span className="text-xs text-muted-foreground">
              Baseline for {tpl.name}: {tpl.estimatedHoursSavedPerMonth} h / month.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Expected credit spend / month</span>
            <input
              type="number"
              min="0"
              max="500"
              data-testid="roi-credit-spend"
              value={creditSpendPerMonth}
              onChange={(e) => setCreditSpendPerMonth(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
            <span className="text-xs text-muted-foreground">USD / month. Most teams stay between $25 and $50.</span>
          </label>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3" data-testid="roi-results">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Hours saved / month</div>
            <div className="mt-1 text-3xl font-bold">{totalHours}h</div>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Labor value / month</div>
            <div className="mt-1 text-3xl font-bold">${laborValue.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">ROI multiple</div>
            <div className="mt-1 text-3xl font-bold">{roiMultiple.toFixed(1)}×</div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border/40 bg-muted/40 p-4 text-center">
          <p className="text-sm text-muted-foreground">Annual gain</p>
          <p className="mt-1 text-2xl font-bold text-foreground" data-testid="roi-annual-gain">
            ${annualGain.toLocaleString()}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/onboarding" className="flex-1">
            <Button className="w-full" data-testid="roi-cta-onboard">Start Free Setup →</Button>
          </Link>
          <Link href="/marketplace" className="flex-1">
            <Button className="w-full" variant="outline">
              Browse AI Employee Bundles
            </Button>
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Estimates only. Actual savings depend on workload mix, model choices, and team adoption.
        </p>
      </div>
    </div>
  )
}
