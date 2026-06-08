/**
 * Creative Provider Matrix + HyperFrames pipeline (P2) — cost, proof, honest state.
 */
import { describe, it, expect } from 'vitest'
import {
  CREATIVE_PROVIDERS, deriveProviderStatus, estimateCost, usdToCredits, getProvider,
} from '@/lib/creative/provider-matrix'
import {
  HYPERFRAMES_STAGES, deriveStageStatus, pipelineReady, estimateRenderCost,
} from '@/lib/creative/hyperframes-pipeline'

describe('Creative Provider Matrix', () => {
  it('covers the full provider roster with cost + proof + capabilities', () => {
    const ids = CREATIVE_PROVIDERS.map((p) => p.id)
    for (const id of ['higgsfield', 'hyperframes', 'runway', 'pika', 'minimax', 'heygen', 'elevenlabs', 'remotion', 'gemini', 'openai']) {
      expect(ids, `provider missing: ${id}`).toContain(id)
    }
    for (const p of CREATIVE_PROVIDERS) {
      expect(p.cost.usdPerUnit).toBeGreaterThan(0)
      expect(p.proofExpectation.length).toBeGreaterThan(0)
      expect(p.capabilities.length).toBeGreaterThan(0)
      expect(p.modalities.length).toBeGreaterThan(0)
    }
  })

  it('derives honest status — no credential → credentials_missing, never ready', () => {
    const runway = getProvider('runway')!
    expect(deriveProviderStatus(runway, { credentialPresent: false })).toBe('credentials_missing')
    expect(deriveProviderStatus(runway, { credentialPresent: true })).toBe('ready')
  })

  it('render providers need a runtime — never ready without one', () => {
    const remotion = getProvider('remotion')! // no creds, but needs runtime
    expect(deriveProviderStatus(remotion, { runtimePaired: false })).toBe('runtime_required')
    expect(deriveProviderStatus(remotion, { runtimePaired: true })).toBe('ready')
    const hf = getProvider('hyperframes')!
    expect(deriveProviderStatus(hf, { credentialPresent: true, runtimePaired: false })).toBe('runtime_required')
  })

  it('HeyGen avatar video is HIGH approval (likeness)', () => {
    expect(getProvider('heygen')?.approval).toBe('high')
  })

  it('cost estimate is honest credits+usd, labeled', () => {
    const runway = getProvider('runway')!
    const est = estimateCost(runway, 10) // 10 sec of video @ $0.05
    expect(est.usd).toBeCloseTo(0.5, 5)
    expect(est.credits).toBe(usdToCredits(0.5))
    expect(est.label).toMatch(/credits/)
    expect(est.label).toMatch(/10 sec of videos/)
  })
})

describe('HyperFrames pipeline', () => {
  it('models the full HTML→MP4→caption→proof pipeline', () => {
    expect(HYPERFRAMES_STAGES.map((s) => s.id)).toEqual(['storyboard', 'rasterize', 'encode', 'transcribe', 'caption', 'proof'])
  })

  it('runtime stages are blocked until a render runtime pairs (no fake render)', () => {
    const encode = HYPERFRAMES_STAGES.find((s) => s.id === 'encode')!
    expect(deriveStageStatus(encode, { renderRuntimePaired: false })).toBe('blocked')
    expect(deriveStageStatus(encode, { renderRuntimePaired: true })).toBe('pending')
    const storyboard = HYPERFRAMES_STAGES.find((s) => s.id === 'storyboard')!
    expect(deriveStageStatus(storyboard, { renderRuntimePaired: false })).toBe('pending') // no runtime needed
    expect(pipelineReady({ renderRuntimePaired: false })).toBe(false)
    expect(pipelineReady({ renderRuntimePaired: true })).toBe(true)
  })

  it('render cost estimate scales by minute', () => {
    const est = estimateRenderCost(90) // 90s → 2 render minutes
    expect(est.usd).toBeCloseTo(0.8, 5)
  })
})
