import { describe, expect, it } from 'vitest'
import { getOnboardingSessionDecision } from '@/lib/onboarding-session'

describe('onboarding-session', () => {
  it('opens onboarding for admins when the server says it should show', () => {
    expect(
      getOnboardingSessionDecision({
        isAdmin: true,
        serverShowOnboarding: true,
        completed: false,
        skipped: false,
        dismissedThisSession: false,
      })
    ).toEqual({ shouldOpen: true, replayFromStart: false })
  })

  it('does NOT replay onboarding after completion (server is the source of truth)', () => {
    expect(
      getOnboardingSessionDecision({
        isAdmin: true,
        serverShowOnboarding: false,
        completed: true,
        skipped: false,
        dismissedThisSession: false,
      })
    ).toEqual({ shouldOpen: false, replayFromStart: false })
  })

  it('does NOT replay onboarding after skip on a brand-new browser session', () => {
    // Customer Zero bug: skipping persisted server-side but a new tab/Playwright
    // session triggered shouldOpen=true again because dismissedThisSession is
    // sessionStorage-scoped. This must NOT happen.
    expect(
      getOnboardingSessionDecision({
        isAdmin: true,
        serverShowOnboarding: false,
        completed: false,
        skipped: true,
        dismissedThisSession: false,
      })
    ).toEqual({ shouldOpen: false, replayFromStart: false })
  })

  it('does not reopen onboarding once dismissed in the current session', () => {
    expect(
      getOnboardingSessionDecision({
        isAdmin: true,
        serverShowOnboarding: false,
        completed: true,
        skipped: false,
        dismissedThisSession: true,
      })
    ).toEqual({ shouldOpen: false, replayFromStart: false })
  })

  it('never opens onboarding for non-admin users', () => {
    expect(
      getOnboardingSessionDecision({
        isAdmin: false,
        serverShowOnboarding: true,
        completed: false,
        skipped: false,
        dismissedThisSession: false,
      })
    ).toEqual({ shouldOpen: false, replayFromStart: false })
  })
})
