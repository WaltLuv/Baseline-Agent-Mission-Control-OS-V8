import type { OnboardingStepDefinition } from '@/lib/onboarding-flow'

export function parseCompletedSteps(raw: string, validSteps: readonly OnboardingStepDefinition[]): string[] {
  const valid = new Set(validSteps.map((step) => step.id))

  try {
    const parsed = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed)) return []

    const seen = new Set<string>()
    const cleaned: string[] = []
    for (const value of parsed) {
      if (typeof value !== 'string') continue
      if (!valid.has(value)) continue
      if (seen.has(value)) continue
      seen.add(value)
      cleaned.push(value)
    }
    return cleaned
  } catch {
    return []
  }
}

export function nextIncompleteStepIndex(
  steps: readonly OnboardingStepDefinition[],
  completedSteps: readonly string[]
): number {
  if (steps.length === 0) return 0
  const completed = new Set(completedSteps)
  const index = steps.findIndex((step) => !completed.has(step.id))
  return index === -1 ? steps.length - 1 : index
}

export function shouldShowOnboarding(params: {
  completed: boolean
  skipped: boolean
  isAdmin: boolean
}): boolean {
  // 2026-06-01: the canonical post-signup experience is now `/app/activate`
  // (Activation Hub). The legacy auto-popup runtime carousel onboarding
  // wizard is redundant for new signups and confusing for the legacy
  // admin@workspace=1 seed user, where it covers the whole dashboard with
  // "0 of 5 runtimes ready" — even though the user has already completed
  // signup + activation. We stop the wizard from auto-opening here. It
  // remains available via the explicit "Replay onboarding" button in
  // Settings, which fires `mc:first-run-tour:replay` and sets
  // `showOnboarding` directly through the store — so this is purely a
  // change to the auto-trigger gating, not a feature removal.
  void params
  return false
}

export function markStepCompleted(
  existingCompletedSteps: readonly string[],
  stepId: string,
  validSteps: readonly OnboardingStepDefinition[]
): string[] {
  const valid = new Set(validSteps.map((step) => step.id))
  if (!valid.has(stepId)) return [...existingCompletedSteps]

  const completed = parseCompletedSteps(JSON.stringify(existingCompletedSteps), validSteps)
  if (completed.includes(stepId)) return completed
  return [...completed, stepId]
}
