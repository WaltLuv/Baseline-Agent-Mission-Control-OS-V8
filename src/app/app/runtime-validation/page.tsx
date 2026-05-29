import { Suspense } from 'react'
import { RuntimeValidationPanel } from '@/components/panels/runtime-validation-panel'

/**
 * /app/runtime-validation — Production readiness surface for runtime
 * supervision. See `docs/operations/RUNTIME_VALIDATION.md` for the
 * five-flow contract this panel monitors.
 */
export default function RuntimeValidationPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <RuntimeValidationPanel />
    </Suspense>
  )
}
