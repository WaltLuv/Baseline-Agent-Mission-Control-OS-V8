/**
 * ApprovalSuccessSequence — render test.
 *
 * Verifies the success sequence renders all four staged steps driven by the
 * real response fields, the replay link, honest dry-run copy, and the
 * blocked-dispatch warning state.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { ApprovalSuccessSequence } from '../approval-success-sequence'

const baseData = {
  request: 'Major water leak under kitchen sink',
  dispatchStatus: 'dry_run_dispatch',
  commsId: 'msg_123',
  workOrderId: 'wo_1',
  replayId: 'replay_9',
}

function renderSeq(data = baseData) {
  return render(<ApprovalSuccessSequence data={data} onClose={() => {}} />)
}

/** Each staged step schedules the next timeout from an effect, so advance
 *  in small slices — one act() per step — instead of one big jump. */
function advanceAllSteps() {
  for (let i = 0; i < 8; i++) {
    act(() => { vi.advanceTimersByTime(700) })
  }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ApprovalSuccessSequence', () => {
  it('renders all four steps and reveals them over time', () => {
    vi.useFakeTimers()
    renderSeq()

    expect(screen.getByTestId('approval-success-sequence')).toBeTruthy()
    expect(screen.getByTestId('seq-request').textContent).toContain('Major water leak')

    // All steps exist immediately (pending state), then stage in.
    for (const key of ['approved', 'dispatched', 'proof', 'replay']) {
      expect(screen.getByTestId(`seq-step-${key}`)).toBeTruthy()
    }
    expect(screen.getByTestId('seq-step-approved').getAttribute('data-state')).toBe('pending')

    advanceAllSteps()

    expect(screen.getByTestId('seq-step-approved').getAttribute('data-state')).toBe('ok')
    expect(screen.getByTestId('seq-step-dispatched').getAttribute('data-state')).toBe('ok')
    expect(screen.getByTestId('seq-step-proof').getAttribute('data-state')).toBe('ok')
    expect(screen.getByTestId('seq-step-replay').getAttribute('data-state')).toBe('ok')
  })

  it('labels match the mandated sequence copy', () => {
    vi.useFakeTimers()
    renderSeq()
    advanceAllSteps()
    const text = screen.getByTestId('approval-success-sequence').textContent || ''
    expect(text).toContain('Owner approved')
    expect(text).toContain('Vendor dispatched')
    expect(text).toContain('Proof package updated')
    expect(text).toContain('Replay ready')
  })

  it('is honest about dry-run dispatch', () => {
    vi.useFakeTimers()
    renderSeq()
    advanceAllSteps()
    expect(screen.getByTestId('seq-step-dispatched').textContent).toContain('Dry-run')
  })

  it('surfaces the replay link', () => {
    vi.useFakeTimers()
    renderSeq()
    advanceAllSteps()
    const link = screen.getByTestId('seq-view-replay') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/app/replay')
  })

  it('shows a warning (not a fake success) when dispatch is blocked', () => {
    vi.useFakeTimers()
    renderSeq({ ...baseData, dispatchStatus: 'blocked', dispatchReason: 'provider error' } as any)
    advanceAllSteps()
    const step = screen.getByTestId('seq-step-dispatched')
    expect(step.getAttribute('data-state')).toBe('warn')
    expect(step.textContent).toContain('Dispatch blocked')
  })
})
