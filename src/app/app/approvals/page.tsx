import { Suspense } from 'react'
import { ApprovalsQueueView } from '@/components/workforce/approvals-queue-view'
import { OwnerApprovalsPanel } from '@/components/panels/owner-approvals-panel'
import { DemoModeProvider } from '@/components/demo/demo-mode-provider'

/**
 * /app/approvals — operator-facing approval queue.
 *
 * Two surfaces, one page:
 *   1. Owner Approval Inbox — pending spend approvals on maintenance work
 *      orders (vendor / tenant / property context, approve → dispatch).
 *      This is the heart of the PM demo and what the overview's Live
 *      Operations strip deep-links to.
 *   2. AI Employee escalation queue — task-level holds from
 *      `/api/approvals/queue` with memory rationale.
 */
export default function ApprovalsPage() {
  return (
    <Suspense fallback={null}>
      <DemoModeProvider>
        <div className="mx-auto max-w-4xl p-4">
          <OwnerApprovalsPanel />
          <ApprovalsQueueView />
        </div>
      </DemoModeProvider>
    </Suspense>
  )
}
