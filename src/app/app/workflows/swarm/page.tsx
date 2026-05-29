import { Suspense } from 'react'
import { DynamicWorkflowDemo } from '@/components/workforce/dynamic-workflow-demo'

/**
 * /app/workflows/swarm &mdash; Dynamic Workflow / Swarm Mode demo.
 *
 * Simulated walk-through of the five-stage Dynamic Workflow contract
 * (Command \u2192 Plan \u2192 Swarm \u2192 Verify \u2192 Keep). The
 * production orchestrator is in the backlog &mdash; see
 * docs/architecture/DYNAMIC_WORKFLOWS.md.
 */
export default function SwarmModePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <DynamicWorkflowDemo />
    </Suspense>
  )
}
