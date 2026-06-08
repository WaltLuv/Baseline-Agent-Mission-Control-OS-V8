'use client'

/**
 * GStack Import — Skills Library / Marketplace importer.
 *
 * Two paths:
 *  1. Bundled first-25 GStack manifest — preview (classified) + one-click import.
 *  2. Upload an arbitrary manifest (paste JSON) → validate → preview → import.
 *
 * Imported skills are registered into the local GStack library registry
 * (localStorage). Skills needing credentials are flagged and stay
 * setup-needed until those providers are connected (no fake-ready state).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  GSTACK_MANIFEST,
  classifyManifest,
  validateGStackManifest,
  GSTACK_FIRST_25_COUNT,
  type GStackSkill,
} from '@/lib/gstack/manifest'

const LS_KEY = 'gstack-imported-slugs'

function readImported(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]')) } catch { return new Set() }
}
function writeImported(slugs: Set<string>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify([...slugs]))
}

const TIER_STYLE: Record<string, string> = {
  auto: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  review: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'walt-only': 'bg-red-500/15 text-red-400 border-red-500/30',
}

function SkillRow({ s, imported }: { s: GStackSkill; imported: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-3" data-testid={`gstack-skill-${s.slug}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-medium text-foreground">{s.name}</span>
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s.category}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground/80">{s.pricing === 'free' ? 'Free' : `$${s.priceUsd}`}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${TIER_STYLE[s.approvalTier]}`}>{s.approvalTier}</span>
          {imported && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">imported</span>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{s.summary}</p>
      <p className="text-[10px] text-muted-foreground/70 mt-1">Proof: {s.proofExpectations}</p>
      {s.requiredCredentials.length > 0 && (
        <p className="text-[10px] text-amber-400 mt-1" data-testid={`gstack-setup-${s.slug}`}>
          Setup needed: {s.requiredCredentials.join(', ')} credential(s) before live execution.
        </p>
      )}
    </div>
  )
}

export function GStackImportPanel() {
  const [imported, setImported] = useState<Set<string>>(() => new Set())
  const [uploadText, setUploadText] = useState('')
  const [uploadResult, setUploadResult] = useState<ReturnType<typeof validateGStackManifest> | null>(null)

  useEffect(() => { setImported(readImported()) }, [])

  const byCategory = useMemo(() => classifyManifest(), [])
  const categories = useMemo(() => Object.entries(byCategory).filter(([, v]) => v.length > 0), [byCategory])

  const importFirst25 = useCallback(() => {
    const next = new Set(imported)
    for (const s of GSTACK_MANIFEST) next.add(s.slug)
    writeImported(next)
    setImported(next)
  }, [imported])

  const validateUpload = useCallback(() => {
    let parsed: unknown
    try { parsed = JSON.parse(uploadText) } catch { setUploadResult({ ok: false, count: 0, errors: ['Not valid JSON.'], skills: [] }); return }
    const arr = Array.isArray(parsed) ? parsed : (parsed as { skills?: unknown })?.skills
    setUploadResult(validateGStackManifest(arr))
  }, [uploadText])

  const importUploaded = useCallback(() => {
    if (!uploadResult?.ok) return
    const next = new Set(imported)
    for (const s of uploadResult.skills) next.add(s.slug)
    writeImported(next)
    setImported(next)
  }, [uploadResult, imported])

  const importedCount = GSTACK_MANIFEST.filter((s) => imported.has(s.slug)).length

  return (
    <div className="p-4 space-y-4" data-testid="gstack-import">
      <div className="rounded-lg border border-border bg-card p-4">
        <h1 className="text-lg font-semibold text-foreground">GStack Import — Skills Library / Marketplace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import the bundled first-{GSTACK_FIRST_25_COUNT} GStack growth-stack skills, or upload your own
          manifest. Each skill is classified (category, pricing, approval tier, required credentials, proof
          expectations). Credentialed skills stay setup-needed until connected.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={importFirst25}
            className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90"
            data-testid="gstack-import-first-25"
          >
            Import first {GSTACK_FIRST_25_COUNT}
          </button>
          <a href="/marketplace" className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted text-foreground">Open Marketplace</a>
          <span className="text-sm text-muted-foreground">{importedCount}/{GSTACK_FIRST_25_COUNT} imported</span>
        </div>
      </div>

      {/* Bundled manifest preview, classified */}
      <div className="space-y-4">
        {categories.map(([cat, skills]) => (
          <div key={cat}>
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground/60 mb-2">{cat} · {skills.length}</h2>
            <div className="grid gap-2 lg:grid-cols-2">
              {skills.map((s) => <SkillRow key={s.slug} s={s} imported={imported.has(s.slug)} />)}
            </div>
          </div>
        ))}
      </div>

      {/* Arbitrary manifest upload */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Upload a manifest</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Paste a JSON array of skills (or {'{ "skills": [...] }'}). Each entry needs:
          <code className="mx-1 text-[10px] bg-muted px-1 rounded">slug, name, category, pricing, priceUsd, approvalTier, requiredCredentials[], proofExpectations</code>.
        </p>
        <textarea
          value={uploadText}
          onChange={(e) => setUploadText(e.target.value)}
          placeholder='[{"slug":"my-skill","name":"My Skill","category":"Growth","summary":"…","pricing":"free","priceUsd":0,"approvalTier":"auto","requiredCredentials":[],"proofExpectations":"…"}]'
          className="mt-2 w-full h-28 text-xs font-mono rounded-md border border-border bg-background p-2 text-foreground"
          data-testid="gstack-upload-textarea"
        />
        <div className="mt-2 flex items-center gap-2">
          <button onClick={validateUpload} className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted text-foreground" data-testid="gstack-validate">Validate</button>
          <button onClick={importUploaded} disabled={!uploadResult?.ok} className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50" data-testid="gstack-import-uploaded">Import valid</button>
        </div>
        {uploadResult && (
          <div className="mt-2 text-xs" data-testid="gstack-upload-result">
            {uploadResult.ok
              ? <span className="text-emerald-400">✓ Valid — {uploadResult.count} skill(s) ready to import.</span>
              : <div className="text-red-400"><p>Invalid manifest ({uploadResult.errors.length} error(s)):</p><ul className="list-disc list-inside">{uploadResult.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          </div>
        )}
      </div>
    </div>
  )
}

export default GStackImportPanel
