'use client'

/**
 * Agent Factory — say or type "build me X" and a LOCAL model writes a real,
 * self-contained app that runs live in the preview. Free + private: the build
 * happens on your machine via Ollama. Honest: if Ollama isn't running we show
 * setup-needed; we never fake a build or a preview.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

interface Build { id: number; prompt: string; file: string | null; ts: number }
interface Status { reachable: boolean; model: string; models: string[]; host: string; setup: string | null }

const PROJECT = 'agent-factory'

export function AgentFactoryPanel() {
  const [status, setStatus] = useState<Status | null>(null)
  const [prompt, setPrompt] = useState('')
  const [code, setCode] = useState('')
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState('')
  const [builds, setBuilds] = useState<Build[]>([])
  const [previewFile, setPreviewFile] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const recRef = useRef<unknown>(null)

  const loadStatus = useCallback(() => {
    fetch('/api/agent-factory/status', { cache: 'no-store' }).then((r) => r.json()).then(setStatus).catch(() => setStatus(null))
  }, [])
  const loadBuilds = useCallback(() => {
    fetch(`/api/agent-factory/builds?project=${PROJECT}`, { cache: 'no-store' }).then((r) => r.json()).then((d) => setBuilds(d.builds ?? [])).catch(() => {})
  }, [])
  useEffect(() => { loadStatus(); loadBuilds() }, [loadStatus, loadBuilds])

  const build = useCallback(async (p: string) => {
    const text = p.trim()
    if (!text || building) return
    setBuilding(true); setError(''); setCode(''); setPreviewFile(null)
    try {
      const res = await fetch('/api/agent-factory/build', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, project: PROJECT }),
      })
      if (!res.body) { setError('no response stream'); setBuilding(false); return }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const j = JSON.parse(line)
            if (j.t === 'd') setCode((c) => c + j.c)
            else if (j.t === 'error') setError(j.m)
            else if (j.t === 'done') {
              setPreviewFile(j.file)
              await fetch('/api/agent-factory/builds', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project: PROJECT, prompt: text, file: j.file }),
              })
              loadBuilds()
            }
          } catch { /* partial line */ }
        }
      }
    } catch (e) {
      setError(String(e).slice(0, 160))
    } finally {
      setBuilding(false)
    }
  }, [building, loadBuilds])

  /** Voice input via the browser's speech engine (free, on-device). */
  const toggleMic = useCallback(() => {
    type SR = { start: () => void; stop: () => void; onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null; onend: (() => void) | null; continuous: boolean; interimResults: boolean }
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) { setError('Voice input needs Chrome or Safari.'); return }
    if (listening) { (recRef.current as SR | null)?.stop(); setListening(false); return }
    const rec = new Ctor()
    rec.continuous = false; rec.interimResults = false
    rec.onresult = (e) => { const t = e.results[0][0].transcript; setPrompt(t); build(t) }
    rec.onend = () => setListening(false)
    recRef.current = rec
    rec.start(); setListening(true)
  }, [listening, build])

  const ready = status?.reachable

  return (
    <div className="m-4 space-y-4" data-testid="agent-factory-panel">
      <div className="rounded-lg border border-border/60 bg-card/20 p-3">
        <h1 className="text-base font-semibold">Agent Factory</h1>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          Say or type <em>“build me a snake game”</em> and a local model writes a real, working app — free, private, on your machine.
        </p>
      </div>

      {/* Honest local-model status */}
      {status && !ready && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs" data-testid="factory-setup-needed">
          <div className="font-semibold text-amber-300">Local model not running</div>
          <p className="text-muted-foreground mt-1">{status.setup}</p>
        </div>
      )}
      {status && ready && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px] text-emerald-300" data-testid="factory-ready">
          Local model ready · {status.model} · {status.host}
        </div>
      )}

      {/* Prompt + mic */}
      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') build(prompt) }}
          placeholder='build me a colorful starfield…'
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          data-testid="factory-prompt"
        />
        <button onClick={toggleMic} data-testid="factory-mic" className={`rounded-md border px-3 py-2 text-sm ${listening ? 'bg-emerald-600 text-white border-emerald-600' : 'border-border'}`}>🎤</button>
        <button onClick={() => build(prompt)} disabled={building} data-testid="factory-build" className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {building ? 'Building…' : 'Build'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400" data-testid="factory-error">{error}</p>}

      {/* Code stream + live preview */}
      <div className="grid gap-3 lg:grid-cols-2">
        <pre className="rounded-lg border border-border bg-black/60 p-3 text-[11px] text-emerald-200 overflow-auto h-[420px] whitespace-pre-wrap" data-testid="factory-code">{code || (building ? 'Generating…' : 'Code will stream here as it builds.')}</pre>
        <div className="rounded-lg border border-border bg-card overflow-hidden h-[420px]" data-testid="factory-preview">
          {previewFile ? (
            <iframe title="preview" src={`/api/agent-factory/preview/${PROJECT}/${previewFile}`} className="w-full h-full bg-white" />
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Your build runs here.</div>
          )}
        </div>
      </div>

      {/* Gallery / history */}
      <div>
        <div className="text-xs font-semibold mb-2">Your builds</div>
        {builds.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="factory-gallery-empty">Nothing built yet. Try “build me a neon galaxy”.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="factory-gallery">
            {builds.map((b) => (
              <button key={b.id} onClick={() => { setPreviewFile(b.file); setCode('') }} className="text-left rounded-lg border border-border bg-card p-2 hover:bg-secondary" data-testid={`build-${b.id}`}>
                <div className="text-[12px] font-medium truncate">{b.prompt}</div>
                <div className="text-[10px] text-muted-foreground truncate">{b.file ?? 'pending'}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
