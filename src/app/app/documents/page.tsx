'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────────────
// /app/documents — workspace document storage.
//
// Mission Control cloud stores blobs on the host's persistent data
// volume today; the API + UI are written so a future S3 adapter can
// drop in without touching this page. No fake state: every list row
// is a real DB+disk record.
// ─────────────────────────────────────────────────────────────────────

type Status = 'live' | 'archived'

interface Doc {
  id: number
  filename: string
  mime_type: string
  size_bytes: number
  sha256: string
  status: Status
  tags: string[]
  notes: string | null
  created_at: number
  updated_at: number
}

interface Payload {
  documents: Doc[]
  totals: { live: number; archived: number; total_size_bytes: number }
}

const HUMAN_BYTES = (n: number): string => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatWhen(unix: number): string {
  if (!unix) return ''
  return new Date(unix * 1000).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function fileTypeIcon(mime: string, name: string): string {
  if (mime.startsWith('image/')) return '🖼'
  if (mime === 'application/pdf') return '📕'
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.startsWith('video/')) return '🎬'
  if (mime === 'text/markdown' || /\.md$/i.test(name)) return '📝'
  if (mime.startsWith('text/')) return '📄'
  if (mime.includes('spreadsheet') || /\.(csv|xls|xlsx)$/i.test(name)) return '📊'
  if (mime.includes('zip') || /\.(zip|tar|gz)$/i.test(name)) return '📦'
  return '📁'
}

export default function DocumentsPage() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [query, setQuery] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const fetchPayload = useCallback(async () => {
    try {
      setError(null)
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (includeArchived) params.set('include_archived', '1')
      const res = await fetch(`/api/documents${params.toString() ? `?${params.toString()}` : ''}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPayload((await res.json()) as Payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [query, includeArchived])

  useEffect(() => { fetchPayload() }, [fetchPayload])

  const uploadFile = useCallback(async (file: File) => {
    if (uploading) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/documents', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      await fetchPayload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'upload failed')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }, [uploading, fetchPayload])

  const archive = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchPayload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'archive failed')
    }
  }, [fetchPayload])

  const restore = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/documents?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restore: true }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchPayload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'restore failed')
    }
  }, [fetchPayload])

  const recencyGroups = useMemo(() => {
    const out: Record<string, Doc[]> = { Today: [], 'This week': [], Earlier: [] }
    if (!payload) return out
    const now = Date.now() / 1000
    const day = 86_400
    for (const d of payload.documents) {
      const age = now - d.updated_at
      if (age < day) out.Today.push(d)
      else if (age < 7 * day) out['This week'].push(d)
      else out.Earlier.push(d)
    }
    return out
  }, [payload])

  return (
    <div className="h-full overflow-y-auto bg-[#09090b] text-[#fafafa]" data-testid="documents-page">
      <div className="mx-auto max-w-screen-lg px-6 py-10">
        <header className="mb-6 flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-[11px] font-medium text-amber-300 uppercase tracking-wider mb-3">
              Mission Control · Documents
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Documents</h1>
            <p className="text-sm text-white/55 leading-relaxed max-w-2xl">
              Workspace files stored on the Mission Control host&apos;s persistent data
              volume. 50 MB per file. Identical bytes dedupe within the workspace.
            </p>
          </div>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            data-testid="documents-upload-input"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f) }}
          />
          <Button
            size="sm"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            data-testid="documents-upload-button"
          >
            {uploading ? 'Uploading…' : 'Upload file'}
          </Button>
        </header>

        {/* Search + filter */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by filename, tag, or note…"
            className="flex-1 min-w-[200px] bg-white/[0.02] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/85 outline-none focus:border-white/20 placeholder-white/35"
            data-testid="documents-search"
          />
          <label className="flex items-center gap-1.5 text-xs text-white/55 cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="accent-white/40"
              data-testid="documents-include-archived"
            />
            Show archived
          </label>
        </div>

        {/* Totals */}
        {payload && (
          <section className="mb-6 flex items-center gap-6 text-xs text-white/55" data-testid="documents-totals">
            <span><strong className="text-white/85">{payload.totals.live}</strong> live</span>
            <span><strong className="text-white/85">{payload.totals.archived}</strong> archived</span>
            <span><strong className="text-white/85">{HUMAN_BYTES(payload.totals.total_size_bytes)}</strong> total</span>
          </section>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-4 py-3 text-sm text-rose-200" data-testid="documents-error">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : !payload || payload.documents.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center" data-testid="documents-empty">
            <p className="text-sm text-white/55 leading-relaxed">
              {query.trim()
                ? `No documents match "${query.trim()}".`
                : 'No documents yet. Upload one above to get started.'}
            </p>
            <p className="mt-2 text-[11px] text-white/40 italic">
              Storage: persistent data volume · 50 MB per file · S3-compatible adapter pending.
            </p>
          </div>
        ) : (
          (['Today', 'This week', 'Earlier'] as const).map((group) => {
            const list = recencyGroups[group]
            if (!list || list.length === 0) return null
            return (
              <section key={group} className="mb-8" data-testid={`documents-group-${group.toLowerCase().replace(/\s+/g, '-')}`}>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">
                  {group} · {list.length}
                </h2>
                <ul className="grid gap-3 md:grid-cols-2">
                  {list.map((d) => (
                    <li
                      key={d.id}
                      data-testid={`document-${d.id}`}
                      className={`group rounded-xl border p-4 hover:bg-white/[0.04] transition-colors ${
                        d.status === 'archived' ? 'border-amber-500/20 bg-amber-500/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xl leading-none">{fileTypeIcon(d.mime_type, d.filename)}</span>
                        <h3 className="text-sm font-semibold text-white truncate flex-1" title={d.filename}>
                          {d.filename}
                        </h3>
                        {d.status === 'archived' && (
                          <span className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">
                            archived
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/45 font-mono">
                        {HUMAN_BYTES(d.size_bytes)} · {d.mime_type} · {formatWhen(d.updated_at)}
                      </p>
                      {d.tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {d.tags.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] text-white/55 bg-white/[0.05] border border-white/10 rounded-full px-2 py-0.5"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-2 text-[11px] flex-wrap">
                        {d.status === 'live' && (
                          <>
                            <a
                              href={`/api/documents/${d.id}/content?disposition=inline`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-violet-300 hover:text-violet-200"
                              data-testid={`document-${d.id}-preview`}
                            >
                              Preview
                            </a>
                            <span className="text-white/20">·</span>
                            <a
                              href={`/api/documents/${d.id}/content`}
                              className="text-violet-300 hover:text-violet-200"
                              data-testid={`document-${d.id}-download`}
                            >
                              Download
                            </a>
                            <button
                              onClick={() => setPreviewDoc(d)}
                              className="text-white/55 hover:text-white"
                              data-testid={`document-${d.id}-inspect`}
                            >
                              Details
                            </button>
                            <button
                              onClick={() => archive(d.id)}
                              className="ml-auto text-white/40 hover:text-rose-300"
                              data-testid={`document-${d.id}-archive`}
                            >
                              Archive
                            </button>
                          </>
                        )}
                        {d.status === 'archived' && (
                          <button
                            onClick={() => restore(d.id)}
                            className="text-amber-300 hover:text-amber-200"
                            data-testid={`document-${d.id}-restore`}
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })
        )}

        {/* Detail / preview modal */}
        {previewDoc && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            onClick={() => setPreviewDoc(null)}
            data-testid="documents-detail-modal"
          >
            <div
              className="bg-[#0c0c10] border border-white/[0.08] rounded-2xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl leading-none">{fileTypeIcon(previewDoc.mime_type, previewDoc.filename)}</span>
                <h3 className="text-base font-semibold text-white flex-1 truncate">{previewDoc.filename}</h3>
                <button onClick={() => setPreviewDoc(null)} className="text-white/45 hover:text-white">✕</button>
              </div>
              <dl className="text-xs text-white/65 grid grid-cols-[110px_1fr] gap-y-1.5 mb-4">
                <dt className="text-white/45">Type</dt>
                <dd className="font-mono">{previewDoc.mime_type}</dd>
                <dt className="text-white/45">Size</dt>
                <dd className="font-mono">{HUMAN_BYTES(previewDoc.size_bytes)}</dd>
                <dt className="text-white/45">SHA-256</dt>
                <dd className="font-mono break-all text-[10px]">{previewDoc.sha256}</dd>
                <dt className="text-white/45">Uploaded</dt>
                <dd>{formatWhen(previewDoc.created_at)}</dd>
              </dl>
              {previewDoc.notes && (
                <p className="text-xs text-white/65 leading-relaxed mt-3 pt-3 border-t border-white/[0.06]">{previewDoc.notes}</p>
              )}
            </div>
          </div>
        )}

        <footer className="mt-10 pt-6 border-t border-white/[0.06] text-xs text-white/40 flex items-center justify-between flex-wrap gap-3">
          <span>Storage: persistent data volume · S3-compatible adapter pending</span>
          <Link href="/app" className="hover:text-white/80">← Back to dashboard</Link>
        </footer>
      </div>
    </div>
  )
}
