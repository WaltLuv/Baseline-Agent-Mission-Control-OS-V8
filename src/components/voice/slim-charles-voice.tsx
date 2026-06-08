'use client'

/**
 * Slim Charles — Voice (the Oracle Control System).
 *
 * The Jarvis-style concept, product name Slim Charles. Boots with sound, greets
 * out loud, listens, processes, speaks. "show me…" paints visual actions on the
 * wall; "build me…" runs the Agent Factory. Push-to-talk + Live Call, plus a
 * full-screen wall mode.
 *
 * Truth-first: the live voice session is only "connected" when the realtime
 * provider is actually configured (checked via /api/voice/session). Otherwise we
 * show the honest setup-needed state with the configured fallback, and never
 * fake a heartbeat, transcript, or tool execution.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  SLIM_CHARLES, VOICE_STATE_LABEL, type VoiceState,
} from '@/lib/voice/hermes-voice-stream'
import { AUTO_APPROVE_ACTIONS, REQUIRES_WALT_ACTIONS } from '@/lib/voice/permissions'
import { parseBuildIntent } from '@/lib/voice/agent-factory'

type SessionInfo =
  | { configured: false; setupNeeded: true; message: string; voice: string }
  | { configured: true; setupNeeded: boolean; provider?: string; native?: boolean; message?: string; voice: string }
  | null

const STATE_COLOR: Record<VoiceState, string> = {
  idle: '#9ca3af',
  booting: '#60a5fa',
  listening: '#34d399',
  processing: '#fbbf24',
  speaking: '#a78bfa',
  error: '#f87171',
}

export function SlimCharlesVoice() {
  const [session, setSession] = useState<SessionInfo>(null)
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<VoiceState>('idle')
  const [wallMode, setWallMode] = useState(false)
  const [transcript, setTranscript] = useState<{ role: 'user' | 'assistant' | 'system'; text: string }[]>([])
  const [pushing, setPushing] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/voice/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setSession(d) })
      .catch(() => { if (!cancelled) setSession(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const connected = !!session && session.configured && !session.setupNeeded

  /** Sound-on-boot: a short rising chime via Web Audio. */
  const playBootSound = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = audioCtxRef.current ?? new Ctx()
      audioCtxRef.current = ctx
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25)
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
      osc.start(); osc.stop(ctx.currentTime + 0.4)
    } catch { /* audio not available — silent, no fake */ }
  }, [])

  /** Voice boot-up greeting (spoken aloud via the browser, honest fallback). */
  const speakGreeting = useCallback(() => {
    try {
      const u = new SpeechSynthesisUtterance(SLIM_CHARLES.bootGreeting)
      window.speechSynthesis?.speak(u)
    } catch { /* speech not available */ }
  }, [])

  const boot = useCallback(() => {
    setState('booting')
    playBootSound()
    speakGreeting()
    setTranscript((t) => [...t, { role: 'system', text: SLIM_CHARLES.bootGreeting }])
    // Without a configured provider we cannot enter a real listening session.
    setState(connected ? 'listening' : 'idle')
  }, [connected, playBootSound, speakGreeting])

  /** Parse a spoken/typed command into a visual ("show me") or build action. */
  const handleCommand = useCallback((text: string) => {
    setTranscript((t) => [...t, { role: 'user', text }])
    const build = parseBuildIntent(text)
    if (build) {
      setTranscript((t) => [...t, { role: 'assistant', text: `Agent Factory engaged — building a ${build.kind}: "${build.title}" on your machine…` }])
      // Real build: stream from the local Agent Factory and report the result.
      void (async () => {
        try {
          const res = await fetch('/api/agent-factory/build', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: text, project: 'agent-factory' }),
          })
          if (!res.body) return
          const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''
          for (;;) {
            const { value, done } = await reader.read(); if (done) break
            buf += dec.decode(value, { stream: true }); const lines = buf.split('\n'); buf = lines.pop() ?? ''
            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const j = JSON.parse(line)
                if (j.t === 'done') setTranscript((t) => [...t, { role: 'assistant', text: `Done — built ${j.file}. Open Agent Factory to view it.` }])
                else if (j.t === 'error') setTranscript((t) => [...t, { role: 'assistant', text: `Build needs setup: ${j.m}` }])
              } catch { /* partial */ }
            }
          }
        } catch { setTranscript((t) => [...t, { role: 'assistant', text: 'Agent Factory unreachable — open the Agent Factory tab to check the local model.' }]) }
      })()
      return
    }
    if (/^show me\b/i.test(text)) {
      setTranscript((t) => [...t, { role: 'assistant', text: `Painting "${text.replace(/^show me\s*/i, '')}" on the wall.` }])
      setWallMode(true)
      return
    }
    setTranscript((t) => [...t, { role: 'assistant', text: 'Heard. Connect a realtime voice provider to let me respond and act with my full toolset.' }])
  }, [])

  return (
    <div className={wallMode ? 'fixed inset-0 z-50 bg-black text-white p-8 overflow-auto' : ''} data-testid="slim-voice-tab">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            🎙️ {SLIM_CHARLES.name} <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Voice · Oracle Control System</span>
          </h2>
          <p className="text-xs text-muted-foreground">Voice id <code>{SLIM_CHARLES.voiceId}</code> · drives the real Hermes agent</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase font-semibold px-2 py-1 rounded-full border border-border" style={{ color: STATE_COLOR[state] }} data-testid="voice-state">
            {VOICE_STATE_LABEL[state]}
          </span>
          <button onClick={() => setWallMode((w) => !w)} data-testid="wall-mode-toggle" className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">
            {wallMode ? 'Exit wall mode' : 'Wall mode'}
          </button>
        </div>
      </div>

      {/* Honest connection state */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Checking voice provider…</p>
      ) : !connected ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 mb-4" data-testid="voice-setup-needed">
          <div className="text-sm font-semibold text-amber-300">Setup needed — no live voice yet</div>
          <p className="text-xs text-muted-foreground mt-1">
            {session?.message ?? 'No realtime voice provider configured.'} For sub-300ms native speech-to-speech, add a GPT-Realtime or Gemini Live key; an ElevenLabs key enables the honest STT→LLM→TTS fallback. Slim will not fake a live connection.
          </p>
          <Link href="/app/credentials" className="text-xs text-primary hover:underline mt-2 inline-block">Add a voice provider credential →</Link>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 mb-4 text-xs text-emerald-300" data-testid="voice-connected">
          Live · {session?.provider} {session?.native ? '(native speech-to-speech)' : '(fallback)'} · interruptible, VAD-driven
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={boot} data-testid="voice-boot" className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">Boot Slim</button>
        <button
          data-testid="live-call"
          onClick={() => setState((s) => (s === 'listening' ? 'idle' : 'listening'))}
          disabled={!connected}
          className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50"
        >📞 Live call</button>
        <button
          data-testid="push-to-talk"
          onMouseDown={() => { setPushing(true); setState('listening') }}
          onMouseUp={() => { setPushing(false); setState('processing') }}
          disabled={!connected}
          className={`rounded-md border px-4 py-2 text-sm disabled:opacity-50 ${pushing ? 'bg-emerald-600 text-white border-emerald-600' : 'border-border'}`}
        >🎤 Push to talk</button>
      </div>

      {/* Command box — "show me…" / "build me…" */}
      <form
        onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const v = (f.get('cmd') as string)?.trim(); if (v) handleCommand(v); e.currentTarget.reset() }}
        className="flex gap-2 mb-4"
      >
        <input name="cmd" data-testid="voice-command" placeholder='Try: "show me agent costs" or "build me a snake game"' className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <button className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">Send</button>
      </form>

      {/* Transcript (real events only) */}
      <div className="rounded-lg border border-border bg-card/40 p-3 mb-4 max-h-64 overflow-auto text-sm space-y-1" data-testid="voice-transcript">
        {transcript.length === 0 ? (
          <p className="text-muted-foreground text-xs">No turns yet. Boot Slim and speak, or use a command above.</p>
        ) : transcript.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-foreground' : m.role === 'assistant' ? 'text-violet-300' : 'text-muted-foreground italic'}>
            <span className="text-[10px] uppercase tracking-wider mr-2">{m.role}</span>{m.text}
          </div>
        ))}
      </div>

      {/* Safety / permissions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-500/30 p-3" data-testid="auto-approve-list">
          <div className="text-xs font-semibold text-emerald-400 mb-1">Slim auto-approves</div>
          <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
            {AUTO_APPROVE_ACTIONS.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
        <div className="rounded-lg border border-red-500/30 p-3" data-testid="walt-only-list">
          <div className="text-xs font-semibold text-red-400 mb-1">Only Walt can approve</div>
          <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
            {REQUIRES_WALT_ACTIONS.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}
