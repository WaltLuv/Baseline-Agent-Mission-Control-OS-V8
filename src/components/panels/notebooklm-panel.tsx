'use client'

/**
 * NotebookLM — Brain Layer 4 Import Center. Renders inline preview areas (not
 * download-only) for every NotebookLM artifact type, preserves downloads, and
 * is honest about access: NotebookLM has no official write API, so import is
 * manual / Google Drive / file upload. No fake access, no fake media.
 */
import Link from 'next/link'
import { getImportSource } from '@/lib/knowledge/import-sources'
import { getBrainLayer } from '@/lib/knowledge/brain-layers'

const PREVIEW_AREAS: { id: string; label: string; note: string }[] = [
  { id: 'video-overview', label: 'Video overview', note: 'Inline player once a video overview is imported.' },
  { id: 'audio-overview', label: 'Audio overview', note: 'Inline audio player once an audio overview is imported.' },
  { id: 'slide-deck', label: 'Slide deck', note: 'Inline slide viewer for generated decks.' },
  { id: 'infographic', label: 'Infographic', note: 'Inline image preview for generated infographics.' },
  { id: 'transcript', label: 'Transcript', note: 'Inline, searchable transcript text.' },
  { id: 'source-notes', label: 'Source notes', note: 'Inline notes extracted from sources.' },
  { id: 'summary', label: 'Summary', note: 'Inline generated summary.' },
]

export function NotebookLmPanel() {
  const src = getImportSource('notebooklm')!
  const layer = getBrainLayer('notebooklm')!

  return (
    <div className="p-6 space-y-6" data-testid="notebooklm-panel">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Knowledge OS · Brain Layer {layer.layer}</div>
          <h1 className="text-2xl font-semibold mt-1">NotebookLM</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{src.description}</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold rounded-full border border-violet-500/40 text-violet-300 px-2 py-0.5" data-testid="notebooklm-state">
          Manual import (no official API)
        </span>
      </header>

      {/* Import modes — honest */}
      <section className="rounded-xl border border-border bg-card p-4" data-testid="notebooklm-import">
        <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Import a source</h2>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary" data-testid="import-upload">Upload file (PDF / Doc / transcript)</button>
          <button className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary" data-testid="import-drive">Import from Google Drive</button>
          <button className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary" data-testid="import-paste">Paste source notes / summary</button>
        </div>
        <p className="text-[11px] text-muted-foreground/70 mt-2">Imported content is mirrored into {src.mirrorsTo.join(', ')} and indexed by PI Agent. Captured: {src.captures.slice(0, 6).join(', ')}…</p>
      </section>

      {/* Inline preview areas — NOT download-only */}
      <section data-testid="notebooklm-previews">
        <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Inline previews</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PREVIEW_AREAS.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4" data-testid={`preview-${a.id}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{a.label}</div>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground rounded-full border border-border px-1.5 py-0.5">inline</span>
              </div>
              <div className="mt-3 rounded-lg border border-dashed border-border h-24 flex items-center justify-center text-[11px] text-muted-foreground text-center px-3">
                {a.note}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground/60">No artifact imported yet</span>
                <button className="text-[10px] text-primary hover:underline" data-testid={`download-${a.id}`} disabled>Download</button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/70 mt-3">Previews render inline once imported; downloads remain available per artifact. Nothing is faked — empty until a real source is imported.</p>
      </section>

      <Link href="/app/knowledge-os" className="text-xs text-primary hover:underline">← Back to Knowledge OS</Link>
    </div>
  )
}
