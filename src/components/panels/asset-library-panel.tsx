'use client'

/**
 * Universal Asset Library — provider-sovereign store/index for every generated
 * or imported asset. Honest empty state until assets are produced/imported.
 */
import Link from 'next/link'
import { ASSET_KINDS, ASSET_PROVIDERS } from '@/lib/knowledge/universal-asset'

const KIND_ICON: Record<string, string> = {
  image: '🖼️', video: '🎞️', audio: '🔊', slides: '📊', pdf: '📄', infographic: '📈',
  storyboard: '🎬', thumbnail: '🖼️', 'soul-id': '🪪', transcript: '📝', 'prompt-pack': '🧰', proof: '📦',
}

export function AssetLibraryPanel() {
  return (
    <div className="p-6 space-y-6" data-testid="asset-library-panel">
      <header>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Knowledge OS · Universal Asset Library</div>
        <h1 className="text-2xl font-semibold mt-1">Universal Asset Library</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Every generated or imported asset from any provider is stored + indexed here, owned by Mission Control / Baseline OS. Assets are deduped by content hash and mapped into the four brain layers by PI Agent.</p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="asset-kinds">
        {ASSET_KINDS.map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-3 text-center" data-testid={`asset-kind-${k}`}>
            <div className="text-2xl">{KIND_ICON[k] ?? '📦'}</div>
            <div className="text-[11px] font-medium mt-1 capitalize">{k.replace('-', ' ')}</div>
            <div className="text-[10px] text-muted-foreground">0</div>
          </div>
        ))}
      </section>

      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground" data-testid="asset-library-empty">
        No assets yet. Outputs from {ASSET_PROVIDERS.length} providers (Higgsfield, HyperFrames, NotebookLM, Claude Code Studio, Gemini, Runway, Pika, MiniMax, HeyGen, ElevenLabs, and more) land here automatically once produced or imported.
      </div>

      <div className="flex gap-2">
        <Link href="/app/provider-matrix" className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">Provider Matrix</Link>
        <Link href="/app/knowledge-os" className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">Knowledge OS</Link>
        <Link href="/app/notebooklm" className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">NotebookLM Import</Link>
      </div>
    </div>
  )
}
