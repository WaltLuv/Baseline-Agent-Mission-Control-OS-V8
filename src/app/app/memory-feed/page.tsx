'use client'

import { WorkforceMemoryFeed } from '@/components/workforce/workforce-memory-feed'

/**
 * Workforce Memory Feed route — `/app/memory-feed`.
 *
 * Standalone view of the workforce memory timeline. From here the operator
 * can see every hire, install, decision, and learning across all AI
 * employees — the longitudinal proof that "these employees are learning my
 * business."
 */
export default function MemoryFeedPage() {
  return (
    <div className="p-6">
      <div data-testid="panel-story-memory-feed" className="mb-4 rounded-lg border border-border/60 bg-card/20 p-3">
        <h2 className="text-base font-semibold text-foreground">Workforce Memory Timeline</h2>
        <p className="mt-0.5 text-xs text-muted-foreground max-w-2xl">
          Story: every meaningful decision your AI workforce has made — when, why, what they
          learned. Use this to verify trust, audit recommendations, and catch when an employee
          is drifting from your business&apos;s actual preferences.
        </p>
      </div>
      <WorkforceMemoryFeed limit={100} />
    </div>
  )
}
