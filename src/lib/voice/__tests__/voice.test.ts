/**
 * Slim Charles voice — honest provider detection, audio encoding, the realtime
 * event loop (interruption/cancel), the permission policy (delete/destructive
 * require Walt), the tool registry (no fake access), and the Agent Factory.
 */
import { describe, it, expect } from 'vitest'
import {
  detectVoiceProvider, encodePcm16, pcm16ToBase64, HermesVoiceStream,
  scrubSessionLog, SLIM_CHARLES, type VoiceEvent,
} from '@/lib/voice/hermes-voice-stream'
import { classifyAction, canSlimAutoApprove, AUTO_APPROVE_ACTIONS, REQUIRES_WALT_ACTIONS } from '@/lib/voice/permissions'
import { buildSlimToolRegistry, readyToolCount, canExecuteTool } from '@/lib/voice/tool-registry'
import { parseBuildIntent, buildBrief, selectTeam } from '@/lib/voice/agent-factory'

describe('voice provider detection (no fake connected state)', () => {
  it('returns null when nothing is configured', () => {
    expect(detectVoiceProvider({})).toBeNull()
  })
  it('prefers native speech-to-speech over fallback', () => {
    const p = detectVoiceProvider({ OPENAI_API_KEY: 'x', ELEVENLABS_API_KEY: 'y' })
    expect(p?.id).toBe('openai-realtime')
    expect(p?.native).toBe(true)
  })
  it('only uses STT→LLM→TTS fallback when no native provider exists', () => {
    const p = detectVoiceProvider({ ELEVENLABS_API_KEY: 'y' })
    expect(p?.id).toBe('fallback-stt-llm-tts')
    expect(p?.native).toBe(false)
  })
  it('Slim Charles carries the requested voice id', () => {
    expect(SLIM_CHARLES.voiceId).toBe('rWyjfFeMZ6PxkHqD3wGC')
  })
})

describe('audio encoding', () => {
  it('encodes Float32 → PCM16 and base64', () => {
    const pcm = encodePcm16(new Float32Array([0, 1, -1]))
    expect(pcm[0]).toBe(0)
    expect(pcm[1]).toBe(0x7fff)
    expect(pcm[2]).toBe(-0x8000)
    expect(typeof pcm16ToBase64(pcm)).toBe('string')
  })
})

describe('realtime event loop — interruption/cancel', () => {
  it('interrupt fires a cancel event and clears the active buffer', () => {
    const events: VoiceEvent[] = []
    const s = new HermesVoiceStream({
      provider: { id: 'openai-realtime', label: 'x', native: true, latencyTargetMs: 300, envKey: 'OPENAI_API_KEY' },
      persona: 'p', ephemeralToken: 't', url: 'wss://x', onEvent: (e) => events.push(e), onToolCall: async () => ({}),
    })
    s.interrupt()
    expect(events.some((e) => e.type === 'cancel')).toBe(true)
    expect(s.getState()).toBe('listening')
  })
})

describe('session logging never persists secrets', () => {
  it('scrubs api keys and bearer tokens', () => {
    expect(scrubSessionLog('key=sk-ABCDEFGH1234')).toContain('[redacted]')
    expect(scrubSessionLog('Bearer abc.def-ghi')).toContain('[redacted]')
  })
})

describe('permission policy — only Walt approves destructive', () => {
  it('auto-approves safe generative work', () => {
    for (const a of AUTO_APPROVE_ACTIONS) expect(classifyAction(a)).toBe('auto')
    expect(canSlimAutoApprove('research')).toBe(true)
  })
  it('requires Walt for every destructive/financial/secret action', () => {
    for (const a of REQUIRES_WALT_ACTIONS) expect(classifyAction(a)).toBe('requires-walt')
    expect(classifyAction('delete-files')).toBe('requires-walt')
    expect(classifyAction('rm -rf /')).toBe('requires-walt')
    expect(classifyAction('deploy to prod')).toBe('requires-walt')
    expect(canSlimAutoApprove('delete-records')).toBe(false)
  })
  it('default-denies unknown actions', () => {
    expect(classifyAction('something-weird')).toBe('requires-walt')
  })
})

describe('tool registry — full access, no fake', () => {
  it('exposes every skill and every tool source', () => {
    const tools = buildSlimToolRegistry({})
    // 12 sources + every marketplace skill
    expect(tools.length).toBeGreaterThan(12)
    expect(tools.some((t) => t.id === 'source:mcp')).toBe(true)
    expect(tools.some((t) => t.id.startsWith('skill:'))).toBe(true)
  })
  it('is setup-needed when nothing is wired, ready when wired', () => {
    const none = buildSlimToolRegistry({})
    expect(readyToolCount(none)).toBe(0)
    const wired = buildSlimToolRegistry({ mcp: true, browserUse: true, skillsLibrary: true })
    expect(readyToolCount(wired)).toBeGreaterThan(0)
    expect(canExecuteTool(wired, 'source:mcp')).toBe(true)
    expect(canExecuteTool(none, 'source:mcp')).toBe(false)
  })
})

describe('Agent Factory — build me…', () => {
  it('parses build intents', () => {
    expect(parseBuildIntent('build me a snake game')?.kind).toBe('game')
    expect(parseBuildIntent('build me a landing page for x')?.kind).toBe('landing-page')
    expect(parseBuildIntent('what is the weather')).toBeNull()
  })
  it('builds a brief with a team and plan', () => {
    const intent = parseBuildIntent('build me a dashboard')!
    const brief = buildBrief(intent)
    expect(brief.team.length).toBeGreaterThan(0)
    expect(brief.plan.length).toBeGreaterThan(0)
    expect(selectTeam('game')).toContain('Claude Code')
  })
})
