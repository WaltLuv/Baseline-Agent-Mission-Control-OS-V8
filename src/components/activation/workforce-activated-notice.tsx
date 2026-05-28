'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * WorkforceActivatedNotice — a calm "you just activated your workforce"
 * acknowledgement that appears on `/app/overview` when the operator
 * arrives from `/app/activate?source=…`. Auto-dismisses after 6 seconds.
 *
 * Premium, single-line, dismissible. Not a toast spam; an executive nod.
 */
const SOURCE_COPY: Record<string, string> = {
  onboarding:
    'Workforce activated from your starter template. Today’s briefing is below.',
  setup: 'Account created. Your AI workforce is online and reporting in.',
  manual: 'Workforce reactivated. Reading today’s briefing.',
}

export function WorkforceActivatedNotice() {
  const params = useSearchParams()
  const activated = params?.get('activated')
  const source = params?.get('source') || 'manual'
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!activated) return
    setVisible(true)
    const t = window.setTimeout(() => setVisible(false), 6000)
    return () => window.clearTimeout(t)
  }, [activated])

  if (!activated || !visible) return null

  return (
    <div
      data-testid="workforce-activated-notice"
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-40 w-[min(560px,92vw)] -translate-x-1/2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-center text-xs text-emerald-200 shadow-xl backdrop-blur-md transition-opacity duration-300"
    >
      <span className="font-semibold text-emerald-300">●</span>{' '}
      {SOURCE_COPY[source] ?? SOURCE_COPY.manual}
      <button
        type="button"
        onClick={() => setVisible(false)}
        data-testid="workforce-activated-dismiss"
        className="ml-3 inline-flex items-center rounded-full px-2 text-[10px] uppercase tracking-wider text-emerald-300/80 hover:text-emerald-200"
        aria-label="Dismiss notification"
      >
        Dismiss
      </button>
    </div>
  )
}
