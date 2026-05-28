import { EmployeeTraceView } from '@/components/workforce/employee-trace-view'

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
 */
export default async function EmployeeTracePage({ params }: Props) {
  const { slug } = await params
  return (
    <div className="mx-auto max-w-4xl p-4">
      <EmployeeTraceView slug={slug} />
    </div>
  )
}
