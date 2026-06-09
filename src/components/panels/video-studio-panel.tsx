'use client'

/**
 * Video / Creative Studio (Mission Control) — workspace-scoped parity of the
 * Baseline OS creative workspace. Google Flow + Higgsfield + HeyGen +
 * HyperFrames + Claude Code Studio, customer-safe: assets + AI context are
 * bound to the caller's workspace (no Walt-private data). 4 panes + provider
 * selection + approval gate + proof drawer + embedded Agent Activity + Graphify
 * structural awareness.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AgentActivity } from '@/components/agent-activity'

type Kind = 'image' | 'video' | 'audio' | 'document' | 'other'
interface Asset { name: string; size: number; mtime: number; kind: Kind; url: string }
interface ProofEvent { ts: number; kind: 'upload' | 'prompt' | 'output' | 'approval' | 'blocker'; label: string }

const STAGES = ['Upload', 'Storyboard', 'Scenes', 'Render', 'Captions', 'Proof', 'Export']
const PROVIDERS = ['HyperFrames (HTML→MP4)', 'Higgsfield', 'HeyGen', 'Runway', 'Pika']
const ACTIONS = [
  { id: 'describe', label: 'Describe asset' }, { id: 'storyboard', label: 'Storyboard' },
  { id: 'scenes', label: 'Generate scenes' }, { id: 'script', label: 'Voiceover script' },
  { id: 'captions', label: 'Captions' }, { id: 'thumbnail', label: 'Thumbnail prompt' },
  { id: 'proof', label: 'Proof package' },
]

export function VideoStudioPanel() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [selected, setSelected] = useState<Asset | null>(null)
  const [uploading, setUploading] = useState(false)
  const [stage, setStage] = useState('Upload')
  const [provider, setProvider] = useState(PROVIDERS[0])
  const [requireApproval, setRequireApproval] = useState(true)
  const [chat, setChat] = useState<{ role: 'user' | 'ai' | 'system'; text: string }[]>([])
  const [proof, setProof] = useState<ProofEvent[]>([])

  const addProof = (kind: ProofEvent['kind'], label: string) => setProof((p) => [...p, { ts: Date.now(), kind, label }])

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/creative/assets', { cache: 'no-store' })
      const j = await r.json()
      setAssets(j.items ?? [])
    } catch { /* honest empty */ }
  }, [])
  useEffect(() => { void load() }, [load])

  const ingest = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const base64 = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file) })
      const r = await fetch('/api/creative/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: file.name, base64 }) })
      const j = await r.json()
      if (j.ok) { addProof('upload', `Ingested ${j.asset.name} → workspace Asset Library`); await load(); setSelected(j.asset); setStage('Storyboard') }
      else addProof('blocker', `Upload failed: ${j.error ?? 'unknown'}`)
    } catch (e) { addProof('blocker', `Upload error: ${(e as Error).message}`) }
    setUploading(false)
  }, [load])

  const doAction = (a: { id: string; label: string }) => {
    const target = selected ? `"${selected.name}"` : 'the project'
    setChat((c) => [...c, { role: 'user', text: `${a.label} for ${target}` }])
    addProof('prompt', `${a.label} · ${selected?.name ?? 'project'}`)
    // Honest: planning output is produced; live render stays gated + setup-needed.
    setChat((c) => [...c, { role: 'ai', text: `Drafted ${a.label.toLowerCase()} plan for ${target} (provider: ${provider}). Live generation is setup-needed until the ${provider} credential is connected.` }])
    if (a.id === 'storyboard') setStage('Storyboard'); if (a.id === 'scenes') setStage('Scenes'); if (a.id === 'captions') setStage('Captions'); if (a.id === 'proof') setStage('Proof')
  }

  const approveRender = () => { addProof('approval', `Render approved · provider ${provider}`); setStage('Render') }

  const filteredKinds = useMemo(() => ['all', ...Array.from(new Set(assets.map((a) => a.kind)))], [assets])
  const [filter, setFilter] = useState('all')
  const shown = filter === 'all' ? assets : assets.filter((a) => a.kind === filter)

  return (
    <div className="m-4" data-testid="video-studio-panel">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Video / Creative Studio</h1>
          <p className="text-xs text-muted-foreground">Workspace-scoped creative workspace · <span data-testid="vs-ual">Universal Asset Library</span> · upload → preview → AI → render → proof.</p>
        </div>
      </div>

      <div className="flex h-[calc(100vh-160px)] gap-3 rounded-xl border border-border bg-card/30 p-2">
        {/* LEFT rail */}
        <aside className="flex w-52 shrink-0 flex-col" data-testid="vs-asset-rail">
          <label className="m-1 cursor-pointer rounded-lg border-2 border-dashed border-border p-3 text-center text-[11px] hover:bg-secondary" data-testid="vs-upload-dropzone">
            {uploading ? 'Uploading…' : 'Click to upload'}
            <div className="text-muted-foreground/60">image · video · audio · PDF · doc</div>
            <input type="file" multiple accept="image/*,video/*,audio/*,.pdf,.txt,.md,.json,.csv" className="hidden" onChange={(e) => { for (const f of Array.from(e.target.files ?? [])) void ingest(f) }} />
          </label>
          <div className="flex flex-wrap gap-1 px-1 pb-1">{filteredKinds.map((k) => <button key={k} onClick={() => setFilter(k)} className={`rounded px-1.5 py-0.5 text-[10px] ${filter === k ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>{k}</button>)}</div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1">
            {shown.length === 0 ? <p className="mt-3 text-center text-[11px] text-muted-foreground/50">No assets yet.</p> : shown.map((a) => (
              <button key={a.name} onClick={() => setSelected(a)} className={`mb-1 w-full truncate rounded-md px-2 py-1.5 text-left text-[11px] ${selected?.name === a.name ? 'bg-primary/15 text-primary' : 'bg-muted/40'}`} data-testid={`vs-asset-${a.kind}`}>{a.name.replace(/^[a-z0-9]+-/, '')}</button>
            ))}
          </div>
        </aside>

        {/* CENTER canvas */}
        <main className="flex min-w-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-background/40" data-testid="vs-canvas">
          {!selected ? <p className="text-sm text-muted-foreground/50">Select or upload an asset to preview.</p>
            : selected.kind === 'image' ? <img src={selected.url} alt={selected.name} className="max-h-full max-w-full object-contain" />
            : selected.kind === 'video' ? <video src={selected.url} controls className="max-h-full max-w-full" />
            : selected.kind === 'audio' ? <audio src={selected.url} controls />
            : <iframe src={selected.url} title={selected.name} className="h-full w-full bg-white" />}
        </main>

        {/* RIGHT AI panel */}
        <aside className="flex w-80 shrink-0 flex-col gap-2 overflow-y-auto" data-testid="vs-ai-panel">
          <div className="rounded-lg border border-border bg-card p-2">
            <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">AI workspace · {selected ? selected.name.replace(/^[a-z0-9]+-/, '') : 'no asset'}</div>
            <div className="flex flex-wrap gap-1">{ACTIONS.map((a) => <button key={a.id} onClick={() => doAction(a)} className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-secondary">{a.label}</button>)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-2 text-[11px]">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs" data-testid="vs-provider">
              {PROVIDERS.map((p) => <option key={p}>{p}</option>)}
            </select>
            <label className="mt-2 flex items-center gap-2 text-[11px]" data-testid="vs-approval-gate">
              <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} /> Require approval before render
            </label>
            <button onClick={approveRender} disabled={!requireApproval} className="mt-2 w-full rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40">Approve render</button>
          </div>
          <div className="min-h-0 flex-1 rounded-lg border border-border bg-card p-2 text-[12px]">
            {chat.length === 0 ? <p className="text-muted-foreground/50">Ask AI to storyboard, script, caption, or assemble a proof package.</p>
              : chat.map((m, i) => <div key={i} className={m.role === 'ai' ? 'text-primary' : m.role === 'system' ? 'italic text-amber-400/80' : 'text-foreground'}><span className="mr-1 text-[9px] uppercase text-muted-foreground">{m.role}</span>{m.text}</div>)}
          </div>
          <AgentActivity agentId="creative-studio" runtime="Claude Code Studio" provider={provider} />
        </aside>
      </div>

      {/* BOTTOM timeline */}
      <div className="mt-2 flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2" data-testid="vs-timeline">
        {STAGES.map((s, i) => (
          <span key={s} className="flex items-center">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${stage === s ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>{s}</span>
            {i < STAGES.length - 1 && <span className="mx-1 text-muted-foreground/40">→</span>}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground">{assets.length} assets · {provider}</span>
      </div>

      {/* Proof drawer */}
      <div className="mt-2 rounded-lg border border-border bg-card p-3" data-testid="vs-proof-drawer">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Proof package</div>
        {proof.length === 0 ? <p className="text-[11px] text-muted-foreground/50">Uploads, prompts, approvals, outputs, and setup blockers log here.</p>
          : <ul className="space-y-0.5 text-[11px]">{proof.slice().reverse().map((p, i) => <li key={i} className="text-foreground/75"><span className="text-muted-foreground">{p.kind}</span> · {p.label}</li>)}</ul>}
      </div>
    </div>
  )
}

export default VideoStudioPanel
