import { Suspense } from 'react'
import { AiWorkforceDashboard } from '@/components/workforce/ai-workforce-dashboard'

/**
 * /app/workforce &mdash; AI Workforce Dashboard.
 *
 * The vertical-agnostic executive surface that proves Mission Control
 * supervises an AI workforce, not a property-management tool.
 */
export default function WorkforcePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <AiWorkforceDashboard />
    </Suspense>
  )
}
