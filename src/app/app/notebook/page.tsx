'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────────────
// /app/notebook — Operator notebook (cloud parity of Baseline OS
// /journal & /notebook). Real DB-backed; no fake state.
// ─────────────────────────────────────────────────────────────────────

interface Entry {
  id: number
  title: string
  body_md: string
  source: 'operator' | 'agent' | 'daily_brief' | 'import'
  tags: string[]
  archived: boolean
  created_at: number
  updated_at: number
}

function formatWhen(unix: number): string {
  if (!unix) return ''
  const d = new Date(unix * 1000)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function sourceBadge(source: Entry['source']) {
  const map: Record<Entry['source'], { label: string; cls: string }> = {
    operator: { label: 'You', cls: 'bg-violet-500/10 text-violet-300 border-violet-500/30' },
    agent: { label: 'Agent', cls: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' },
    daily_brief: { label: 'Brief', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
    import: { label: 'Import', cls: 'bg-white/10 text-white/55 border-white/15' },
  }
  const v = map[source]
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold rounded-full px-2 py-0.5 border ${v.cls}`}>
      {v.label}
    </span>
  )
}

export default function NotebookPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newTagsRaw, setNewTagsRaw] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchEntries = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/notebook', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { entries: Entry[] }
      setEntries(data.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load notebook')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const createEntry = useCallback(async () => {
    const title = newTitle.trim()
    if (!title || submitting) return
    setSubmitting(true)
    try {
      const tags = newTagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const res = await fetch('/api/notebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body_md: newBody, tags }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const { entry } = (await res.json()) as { entry: Entry }
      setEntries((prev) => [entry, ...prev])
      setNewTitle('')
      setNewBody('')
      setNewTagsRaw('')
      setComposing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to save entry')
    } finally {
      setSubmitting(false)
    }
  }, [newTitle, newBody, newTagsRaw, submitting])

  const archiveEntry = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/notebook?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to archive')
    }
  }, [])

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.body_md.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [entries, filter])

  return (
    <div className="h-full overflow-y-auto bg-[#09090b] text-[#fafafa]" data-testid="notebook-page">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-6 flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-[11px] font-medium text-cyan-300 uppercase tracking-wider mb-3">
              Mission Control · Notebook
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Notebook</h1>
            <p className="text-sm text-white/55 leading-relaxed max-w-2xl">
              Long-form notes for the workspace. Workspace-scoped, real DB rows. Same surface as the
              Baseline OS Obsidian-backed local notebook.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setComposing((v) => !v)}
            data-testid="notebook-compose-toggle"
          >
            {composing ? 'Close' : 'New note'}
          </Button>
        </header>

        {composing && (
          <section className="mb-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3" data-testid="notebook-compose">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title"
              maxLength={280}
              className="w-full bg-transparent border-none outline-none text-base font-semibold text-white placeholder-white/40"
              data-testid="notebook-compose-title"
            />
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Markdown body…"
              rows={8}
              className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white/85 outline-none focus:border-white/25 resize-y font-mono leading-relaxed"
              data-testid="notebook-compose-body"
            />
            <input
              type="text"
              value={newTagsRaw}
              onChange={(e) => setNewTagsRaw(e.target.value)}
              placeholder="tags, comma, separated"
              maxLength={500}
              className="w-full bg-transparent border-b border-white/10 outline-none text-xs text-white/65 placeholder-white/30 pb-1.5"
              data-testid="notebook-compose-tags"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!newTitle.trim() || submitting}
                onClick={createEntry}
                data-testid="notebook-compose-save"
              >
                {submitting ? 'Saving…' : 'Save note'}
              </Button>
            </div>
          </section>
        )}

        <div className="mb-4">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter notes…"
            className="w-full bg-white/[0.02] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/85 outline-none focus:border-white/20 placeholder-white/35"
            data-testid="notebook-filter"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-4 py-3 text-sm text-rose-200" data-testid="notebook-error">
            {error}
          </div>
        )}

        <section data-testid="notebook-list">
          {loading ? (
            <p className="text-sm text-white/40">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-white/40 italic">
              {entries.length === 0 ? 'No notes yet. Start with "New note" above.' : 'No notes match that filter.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {visible.map((e) => (
                <li
                  key={e.id}
                  data-testid={`notebook-entry-${e.id}`}
                  className="group rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-colors"
                >
                  <button
                    onClick={() => setExpandedId((cur) => (cur === e.id ? null : e.id))}
                    className="w-full text-left"
                  >
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white">{e.title}</h3>
                      {sourceBadge(e.source)}
                      {e.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] text-white/55 bg-white/[0.05] border border-white/10 rounded-full px-2 py-0.5"
                        >
                          #{t}
                        </span>
                      ))}
                      <span className="ml-auto text-[11px] text-white/35">{formatWhen(e.updated_at)}</span>
                    </div>
                  </button>
                  {expandedId === e.id && (
                    <div className="mt-3 pt-3 border-t border-white/[0.06]">
                      {e.body_md ? (
                        <pre className="text-xs text-white/75 whitespace-pre-wrap leading-relaxed font-sans">
                          {e.body_md}
                        </pre>
                      ) : (
                        <p className="text-xs text-white/40 italic">(no body)</p>
                      )}
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => archiveEntry(e.id)}
                          className="text-[11px] text-white/40 hover:text-rose-300"
                          data-testid={`notebook-entry-${e.id}-archive`}
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-10 pt-6 border-t border-white/[0.06] text-xs text-white/40 flex items-center justify-between flex-wrap gap-3">
          <span>{visible.length} of {entries.length} note{entries.length === 1 ? '' : 's'}</span>
          <Link href="/app" className="hover:text-white/80">← Back to dashboard</Link>
        </footer>
      </div>
    </div>
  )
}
