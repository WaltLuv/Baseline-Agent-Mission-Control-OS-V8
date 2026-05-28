import { Suspense } from 'react'
import { EmployeeTraceView } from '@/components/workforce/employee-trace-view'
import { DemoModeProvider } from '@/components/demo/demo-mode-provider'

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * /app/agents/[slug]/trace — one-click employee drill-down.
 *
 * Mounts the unified trace view that answers, in a single calm screen:
 *   "What did this AI Employee actually do, what skills did it use, who
 *    did it work with, why did it make that recommendation, and what
 *    value did it create?"
 *
 * Wrapped in `DemoModeProvider` so the page honors `?demo=<id>` and shows
 * storyline life signals when an operator is browsing in demo mode.
 */
export default async function EmployeeTracePage({ params }: Props) {
  const { slug } = await params
  return (
    <Suspense fallback={null}>
      <DemoModeProvider>
        <div className="mx-auto max-w-4xl p-4">
          <EmployeeTraceView slug={slug} />
        </div>
      </DemoModeProvider>
    </Suspense>
  )
}
