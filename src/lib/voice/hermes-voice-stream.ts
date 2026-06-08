/**
 * hermes_voice_stream — real-time, ultra-low-latency voice service for Slim
 * Charles (the Jarvis-style "Oracle Control System").
 *
 * Architecture: native speech-to-speech over a persistent bidirectional
 * WebSocket (OpenAI GPT-Realtime / Gemini Live compatible) — NOT the clunky
 * STT → LLM → TTS hop chain, which is only used as an explicit honest fallback.
 *
 * Truth-first: a session only reports `connected` when a provider is actually
 * configured AND the socket is open. If no native speech-to-speech provider is
 * configured, `detectVoiceProvider` returns the honest fallback (or null), and
 * the UI shows setup-needed. Nothing here fakes a live voice connection.
 *
 * Session logging never persists raw audio or secrets (see `scrubSessionLog`).
 */

export const SLIM_CHARLES = {
  /** Product name. "Jarvis" is only the concept from Iron Man — this is Slim Charles. */
  name: 'Slim Charles',
  /** ElevenLabs voice id used to render Slim's speech in fallback TTS mode. */
  voiceId: 'rWyjfFeMZ6PxkHqD3wGC',
  bootGreeting: "Slim Charles online. Mission Control is live — what are we building?",
  persona:
    'You are Slim Charles, the voice of Baseline OS / Mission Control. Calm, ' +
    'direct, competent, fast. You drive the real Hermes agent: you research, ' +
    'draft, plan, build, and dispatch work using the real tool and skill ' +
    'registry. You never claim to have done something you did not do.',
} as const

// ── States ──────────────────────────────────────────────────────────
/** The visible session states required by the Voice UI. */
export type VoiceState =
  | 'idle'
  | 'booting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error'

export const VOICE_STATE_LABEL: Record<VoiceState, string> = {
  idle: 'Idle',
  booting: 'Booting',
  listening: 'Listening',
  processing: 'Processing',
  speaking: 'Speaking',
  error: 'Error',
}

// ── Providers ───────────────────────────────────────────────────────
export type VoiceProviderId = 'openai-realtime' | 'gemini-live' | 'fallback-stt-llm-tts'

export interface VoiceProvider {
  id: VoiceProviderId
  label: string
  /** Native speech-to-speech (single bidirectional stream) vs. hop chain. */
  native: boolean
  latencyTargetMs: number
  /** Env var that, when present, indicates this provider is configured. */
  envKey: string
}

export const VOICE_PROVIDERS: VoiceProvider[] = [
  { id: 'openai-realtime', label: 'OpenAI GPT-Realtime', native: true, latencyTargetMs: 300, envKey: 'OPENAI_API_KEY' },
  { id: 'gemini-live', label: 'Gemini Live', native: true, latencyTargetMs: 300, envKey: 'GEMINI_API_KEY' },
  { id: 'fallback-stt-llm-tts', label: 'Fallback (STT → LLM → TTS)', native: false, latencyTargetMs: 1500, envKey: 'ELEVENLABS_API_KEY' },
]

/**
 * Pick the configured voice provider, preferring native speech-to-speech. The
 * STT→LLM→TTS path is only ever returned as an explicit fallback, never as the
 * default when a native provider exists. Returns null when nothing is wired —
 * the caller must then render setup-needed (no fake "connected").
 */
export function detectVoiceProvider(env: Record<string, string | undefined>): VoiceProvider | null {
  const native = VOICE_PROVIDERS.filter((p) => p.native).find((p) => !!env[p.envKey])
  if (native) return native
  const fallback = VOICE_PROVIDERS.find((p) => !p.native && !!env[p.envKey])
  return fallback ?? null
}

// ── Audio helpers (testable, no DOM) ────────────────────────────────
/** Float32 mic samples → PCM16 little-endian, the wire format realtime APIs expect. */
export function encodePcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

/** Base64-encode a PCM16 buffer for transport over the WebSocket. */
export function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64')
}

// ── Realtime event loop ─────────────────────────────────────────────
export type VoiceEvent =
  | { type: 'state'; state: VoiceState }
  | { type: 'transcript'; role: 'user' | 'assistant'; text: string }
  | { type: 'tool_call'; callId: string; tool: string; args: unknown }
  | { type: 'cancel' } // interruption fired — playback halted, buffer cleared
  | { type: 'error'; message: string }

export interface VoiceSessionConfig {
  provider: VoiceProvider
  persona: string
  /** Server-minted ephemeral token; never a long-lived key. */
  ephemeralToken: string
  url: string
  onEvent: (e: VoiceEvent) => void
  /** Executes a real backend tool and returns its JSON result for injection. */
  onToolCall: (tool: string, args: unknown) => Promise<unknown>
}

/**
 * Persistent bidirectional voice session. Holds the WebSocket, implements VAD-
 * driven interruption (a cancel event halts playback + clears the active
 * response buffer), injects Slim's persona, and bridges tool calls: the stream
 * yields, the real backend logic runs, and the JSON result is injected back into
 * the live session WITHOUT dropping the socket.
 */
export class HermesVoiceStream {
  private ws: WebSocket | null = null
  private state: VoiceState = 'idle'
  /** Buffered assistant audio chunk ids, cleared on interruption. */
  private activeResponseBuffer: string[] = []

  constructor(private cfg: VoiceSessionConfig) {}

  getState(): VoiceState {
    return this.state
  }

  private setState(state: VoiceState) {
    this.state = state
    this.cfg.onEvent({ type: 'state', state })
  }

  /** Open the persistent socket and inject the persona into session config. */
  connect(WS: typeof WebSocket = WebSocket): void {
    this.setState('booting')
    const ws = new WS(this.cfg.url, ['realtime', `bearer.${this.cfg.ephemeralToken}`])
    this.ws = ws
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'session.update', session: { instructions: this.cfg.persona, voice: SLIM_CHARLES.voiceId } }))
      this.setState('listening')
    }
    ws.onmessage = (ev: MessageEvent) => this.handleMessage(ev.data)
    ws.onerror = () => this.cfg.onEvent({ type: 'error', message: 'voice socket error' })
    ws.onclose = () => this.setState('idle')
  }

  /** Push encoded mic audio onto the stream (no STT hop). */
  pushAudio(base64Pcm: string): void {
    this.ws?.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: base64Pcm }))
  }

  /**
   * Interruption: fire a cancellation event, halt playback, and clear the
   * active response buffer so Slim stops talking the instant the user speaks.
   */
  interrupt(): void {
    this.activeResponseBuffer = []
    this.ws?.send(JSON.stringify({ type: 'response.cancel' }))
    this.cfg.onEvent({ type: 'cancel' })
    this.setState('listening')
  }

  async handleMessage(raw: string): Promise<void> {
    let msg: { type?: string; transcript?: string; chunkId?: string; callId?: string; name?: string; arguments?: unknown }
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    switch (msg.type) {
      case 'input_audio_buffer.speech_started':
        // VAD detected the user speaking over Slim → interrupt.
        if (this.state === 'speaking') this.interrupt()
        break
      case 'response.audio.delta':
        if (msg.chunkId) this.activeResponseBuffer.push(msg.chunkId)
        this.setState('speaking')
        break
      case 'response.audio.done':
        this.activeResponseBuffer = []
        this.setState('listening')
        break
      case 'conversation.item.input_audio_transcription.completed':
        if (msg.transcript) this.cfg.onEvent({ type: 'transcript', role: 'user', text: msg.transcript })
        break
      case 'response.function_call_arguments.done': {
        // Yield, run the real backend tool, inject the JSON result back in.
        this.setState('processing')
        this.cfg.onEvent({ type: 'tool_call', callId: msg.callId ?? '', tool: msg.name ?? '', args: msg.arguments })
        const result = await this.cfg.onToolCall(msg.name ?? '', msg.arguments)
        this.ws?.send(JSON.stringify({
          type: 'conversation.item.create',
          item: { type: 'function_call_output', call_id: msg.callId, output: JSON.stringify(result) },
        }))
        this.ws?.send(JSON.stringify({ type: 'response.create' }))
        break
      }
    }
  }

  disconnect(): void {
    this.ws?.close()
    this.ws = null
    this.setState('idle')
  }
}

// ── Session logging (never persists secrets / raw audio) ────────────
const SECRET_RX = /(sk-[A-Za-z0-9]{8,}|api[_-]?key|bearer\s+[A-Za-z0-9._-]+|password|secret)/gi

export function scrubSessionLog(line: string): string {
  return line.replace(SECRET_RX, '[redacted]')
}
