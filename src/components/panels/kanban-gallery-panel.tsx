'use client'

/**
 * Self-Driving Kanban 2.0 (Mission Control) — property-management focused.
 * /drive an idea (or a PM template) → 5-floor plan → human approval gate →
 * implementation (safe draft unless coding runtime connected) → self-check loop →
 * Shipped Gallery with live preview + proof/replay links. Workspace-scoped.
 */
import { useCallback, useEffect, useState } from 'react'

const STAGES = ['Input', 'Awaiting_Approval', 'Implementation', 'Self_Check', 'Shipped_Gallery']

export function KanbanGalleryPanel() {
  const [cards, setCards] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [idea, setIdea] = useState('')
  const [busy, setBusy] = useState(false)
  const [sel, setSel] = useState<any>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { const j = await (await fetch('/api/kanban', { cache: 'no-store' })).json(); setCards(j.cards ?? []); setTemplates(j.templates ?? []) } catch { /* empty */ }
  }, [])
  useEffect(() => { void load() }, [load])

  const drive = async (ideaText?: string, templateSlug?: string) => {
    const text = ideaText ?? idea
    if (!text && !templateSlug) return
    setBusy(true); setMsg('Running 5-floor plan…')
    try {
      const j = await (await fetch('/api/kanban', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idea: text, templateSlug }) })).json()
      setMsg(j.ok ? `Card created → Awaiting approval` : (j.error ?? 'error')); setIdea(''); await load(); if (j.card) setSel(j.card)
    } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }
  const decide = async (cardId: string, decision: string) => {
    const j = await (await fetch(`/api/kanban/${cardId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }) })).json()
    setMsg(j.ok ? `${decision} → ${j.card?.current_stage}` : (j.error ?? 'error')); await load(); if (j.card) setSel(j.card)
  }

  const byStage = (s: string) => cards.filter((c) => c.current_stage === s)
  const shipped = byStage('Shipped_Gallery')

  return (
    <div className="m-4 space-y-4" data-testid="kanban-gallery-panel">
      <div>
        <h1 className="text-base font-semibold">Self-Driving Kanban 2.0</h1>
        <p className="text-xs text-muted-foreground">/drive an idea → 5-floor plan → owner/operator approval → build (safe draft unless a coding runtime is connected) → self-check → shipped gallery. Proof + replay on every card. Property-management focused.</p>
      </div>

      <div className="flex gap-2" data-testid="kanban-drive">
        <input value={idea} onChange={(e) => setIdea(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void drive()} placeholder='/drive "Build a maintenance request intake widget"' className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="kanban-idea" />
        <button onClick={() => void drive()} disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">/drive</button>
      </div>

      <div data-testid="kanban-templates">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Property management templates</div>
        <div className="flex flex-wrap gap-1">
          {templates.map((t) => <button key={t.slug} onClick={() => void drive(undefined, t.slug)} className="rounded border border-border px-2 py-1 text-[11px] hover:bg-secondary" data-testid={`kanban-template-${t.slug}`}>{t.name}</button>)}
        </div>
      </div>
      {msg && <p className="text-[11px] text-primary" data-testid="kanban-msg">{msg}</p>}

      {/* Board by stage */}
      <div className="grid gap-2 lg:grid-cols-5" data-testid="kanban-board">
        {STAGES.map((s) => (
          <div key={s} className="rounded-xl border border-border bg-card p-2">
            <div className="mb-1 text-[9px] uppercase tracking-widest text-muted-foreground">{s.replace(/_/g, ' ')} · {byStage(s).length}</div>
            {byStage(s).map((c) => (
              <button key={c.id} onClick={() => setSel(c)} className={`mb-1 w-full truncate rounded-md px-2 py-1.5 text-left text-[11px] ${sel?.id === c.id ? 'bg-primary/15 text-primary' : 'bg-muted/40'}`} data-testid={`kanban-card-${c.id}`}>{c.project_name}</button>
            ))}
          </div>
        ))}
      </div>

      {/* Selected card detail */}
      {sel && (
        <div className="rounded-xl border border-border bg-card p-3 text-[12px]" data-testid="kanban-detail">
          <div className="mb-1 font-semibold">{sel.project_name} <span className="text-muted-foreground">· {sel.current_stage} · floor {sel.current_floor}</span></div>
          <div className="text-muted-foreground">Model: {sel.model_router} · agents: {sel.implementation_agent} / {sel.self_checker_agent}</div>
          {sel.plan?.floors && <ol className="mt-1 space-y-0.5">{sel.plan.floors.map((f: any) => <li key={f.floor} className="text-foreground/75">Floor {f.floor} {f.name}: {f.output}</li>)}</ol>}
          {sel.payload_spec?.graphFiles?.length > 0 && <div className="mt-1 text-muted-foreground">Graphify files: {sel.payload_spec.graphFiles.join(', ')}</div>}

          {sel.current_stage === 'Awaiting_Approval' && (
            <div className="mt-2 flex gap-2" data-testid="kanban-approval-gate">
              <button onClick={() => void decide(sel.id, 'approve')} className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white" data-testid="kanban-approve">Approve</button>
              <button onClick={() => void decide(sel.id, 'reject')} className="rounded-md bg-red-600 px-3 py-1 text-[11px] font-semibold text-white" data-testid="kanban-reject">Reject</button>
              <button onClick={() => void decide(sel.id, 'request_changes')} className="rounded-md border border-border px-3 py-1 text-[11px]">Request changes</button>
            </div>
          )}
          {sel.self_checker_logs && <div className="mt-2 rounded bg-background/50 p-2 text-[11px]"><span className="text-muted-foreground">Self-checker:</span> {sel.self_checker_logs} (attempts {sel.attempts})</div>}
          {sel.current_stage === 'Shipped_Gallery' && (
            <div className="mt-2 text-[11px]" data-testid="kanban-shipped">
              <div className="text-emerald-400">✓ Shipped · {sel.shipped_gallery_path}</div>
              <div className="text-muted-foreground">Proof: {sel.proof_package_id} · Replay: {sel.replay_id} · Obsidian: {sel.obsidian_vault_path}</div>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-black/30 p-2 text-[10px] text-foreground/70" data-testid="kanban-preview">{sel.artifact}</pre>
            </div>
          )}
        </div>
      )}

      {/* Shipped gallery summary */}
      <div className="rounded-xl border border-border bg-card p-3" data-testid="kanban-gallery">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Shipped gallery · {shipped.length}</div>
        {shipped.length === 0 ? <p className="text-[11px] text-muted-foreground/60">No shipped artifacts yet. /drive a template above.</p> : (
          <ul className="space-y-0.5 text-[11px]">{shipped.map((c) => <li key={c.id} className="flex gap-2"><span>{c.project_name}</span><span className="ml-auto text-muted-foreground">{c.model_router}</span></li>)}</ul>
        )}
      </div>
    </div>
  )
}

export default KanbanGalleryPanel
