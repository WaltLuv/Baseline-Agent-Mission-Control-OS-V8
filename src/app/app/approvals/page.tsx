import { Suspense } from 'react'
import { ApprovalsQueueView } from '@/components/workforce/approvals-queue-view'
import { DemoModeProvider } from '@/components/demo/demo-mode-provider'

/**
 * /app/approvals — operator-facing approval queue.
 *
 * Reads from `/api/approvals/queue`, surfaces the memory rationale that
 * produced each hold, deep-links to the escalating AI Employee's trace.
 */
export default function ApprovalsPage() {
  return (
    <Suspense fallback={null}>
      <DemoModeProvider>
        <div className="mx-auto max-w-4xl p-4">
          <ApprovalsQueueView />
        </div>
      </DemoModeProvider>
    </Suspense>
  )
}
