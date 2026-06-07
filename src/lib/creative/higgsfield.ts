/**
 * Mission Control — Higgsfield surface model.
 *
 * Mirrors the Baseline OS Higgsfield architecture in the cloud: provider card,
 * honest status, the 4 skills, and the universal-asset/proof contract. Higgsfield
 * is a PROVIDER (compute layer); the system of record is Mission Control /
 * Baseline OS — assets/proofs/jobs belong to the shared creative core, never the
 * provider.
 *
 * TRUTH-FIRST: no fake connected state, no fake media. When the cloud has no
 * universal asset storage wired yet, the contract returns an honest empty state
 * with a clear reason — never fabricated assets.
 */

export type Risk = 'low' | 'medium' | 'high' | 'blocked'

export const HIGGSFIELD_PROVIDER_ID = 'higgsfield'
export const CLAUDE_CODE_STUDIO_PATH = '/app/creative' // MC creative workspace panel
export const HIGGSFIELD_DASHBOARD_URL = 'https://higgsfield.ai'

// ── Honest cloud provider status ────────────────────────────────────
export type HiggsfieldCloudStatus =
  | 'ready'
  | 'credentials_missing'
  | 'setup_required'
  | 'not_available'
  | 'error'

export interface HiggsfieldCloudSignals {
  /** Higgsfield credential saved in the workspace credentials manager. */
  credentialPresent?: boolean
  /** A runtime/provider link is registered + reachable. */
  linked?: boolean
  error?: boolean
}

export function deriveHiggsfieldCloudStatus(s: HiggsfieldCloudSignals): HiggsfieldCloudStatus {
  if (s.error) return 'error'
  if (!s.credentialPresent) return 'credentials_missing'
  if (!s.linked) return 'setup_required'
  return 'ready'
}

export const HIGGSFIELD_CLOUD_STATUS_LABEL: Record<HiggsfieldCloudStatus, string> = {
  ready: 'Ready',
  credentials_missing: 'Credentials missing',
  setup_required: 'Setup required',
  not_available: 'Not available',
  error: 'Error',
}

/** Higgsfield never shows "connected" without a real credential + link. */
export function higgsfieldCloudConnected(status: HiggsfieldCloudStatus): boolean {
  return status === 'ready'
}

// ── The 4 Higgsfield skills (full metadata for MC surfaces) ─────────
export interface HiggsfieldSkillMeta {
  slug: string
  name: string
  description: string
  inputs: string[]
  outputs: string[]
  requiredCredentials: string[]
  approval: Risk
  proofExpectation: string
  /** Pinned source hash from the repo skills-lock.json. */
  sourceHash: string
  /** Whether it's installed into the workspace skill set. */
  installStatus: 'available' | 'installed'
  /** Marketplace listing state. */
  marketplaceStatus: 'listed' | 'unlisted'
  /** Pricing posture in the marketplace. */
  pricing: 'free' | 'included' | 'paid'
}

const REQ_CREDS = ['HIGGSFIELD_API_KEY_ID', 'HIGGSFIELD_API_KEY_SECRET']

export const HIGGSFIELD_SKILLS: HiggsfieldSkillMeta[] = [
  {
    slug: 'higgsfield-generate',
    name: 'Higgsfield Generate',
    description: 'Generate images/videos via Higgsfield AI (GPT Image 2, Seedance 2.0, Nano Banana, Soul, Kling, Marketing Studio).',
    inputs: ['prompt', 'model', 'aspect_ratio', 'reference_images?', 'soul_id?'],
    outputs: ['image asset', 'video asset'],
    requiredCredentials: REQ_CREDS,
    approval: 'medium',
    proofExpectation: 'generated asset URI + model + prompt in the shared asset library',
    sourceHash: '99240f108f2e9de599a39e2ac1f69ba4914c89c17a827594c5e50f4d598689c3',
    installStatus: 'available',
    marketplaceStatus: 'listed',
    pricing: 'included',
  },
  {
    slug: 'higgsfield-soul-id',
    name: 'Higgsfield Soul ID',
    description: 'Train a Soul Character (identity-faithful model on a consented face). Returns a reference_id.',
    inputs: ['face_photos (consented)', 'name'],
    outputs: ['soul reference_id'],
    requiredCredentials: REQ_CREDS,
    approval: 'high',
    proofExpectation: 'soul reference_id + consent record',
    sourceHash: '7cfc9540f5890dac0035f430c820a7db13c14796b2a8d42edb75f373e9e418c1',
    installStatus: 'available',
    marketplaceStatus: 'listed',
    pricing: 'paid',
  },
  {
    slug: 'higgsfield-marketplace-cards',
    name: 'Higgsfield Marketplace Cards',
    description: 'Generate compliant marketplace listing image sets: main image, secondary images, A+ modules.',
    inputs: ['product_info', 'listing_context', 'reference_images?'],
    outputs: ['marketplace card image set'],
    requiredCredentials: REQ_CREDS,
    approval: 'medium',
    proofExpectation: 'card asset URIs in the shared asset library',
    sourceHash: 'dadfdc8d1ab18c68edc1266b699100edf6628eeb494a8a6db62972a4bac5b5be',
    installStatus: 'available',
    marketplaceStatus: 'listed',
    pricing: 'included',
  },
  {
    slug: 'higgsfield-product-photoshoot',
    name: 'Higgsfield Product Photoshoot',
    description: 'Brand-quality product images via product-photoshoot prompt enhancement on GPT Image 2.',
    inputs: ['product_image', 'style', 'scene'],
    outputs: ['product image set'],
    requiredCredentials: REQ_CREDS,
    approval: 'medium',
    proofExpectation: 'product image URIs in the shared asset library',
    sourceHash: '128d1926c2a70ad1c08e7de17e4b7485a2ada9a02ce3e7cad80053311d619ce7',
    installStatus: 'available',
    marketplaceStatus: 'listed',
    pricing: 'included',
  },
]

export const HIGGSFIELD_SUBSYSTEMS = [
  { id: 'soul-id', label: 'Soul ID', approval: 'high' as Risk },
  { id: 'product-photoshoot', label: 'Product Photoshoot', approval: 'medium' as Risk },
  { id: 'marketplace-cards', label: 'Marketplace Cards', approval: 'medium' as Risk },
] as const

// ── Universal asset + proof contract (system of record = Baseline OS/MC) ──
export interface UniversalAsset {
  id: string
  provider: string
  kind: 'image' | 'video' | 'audio' | 'document'
  url: string | null
  prompt: string | null
  model: string | null
  createdAt: number
  proofHash: string | null
}

export interface UniversalAssetResult {
  assets: UniversalAsset[]
  /** Honest state: storage may not be wired in the cloud yet. */
  state: 'ok' | 'empty' | 'storage_not_configured'
  reason?: string
}

/**
 * Project a raw cloud asset response into the universal contract. When the
 * cloud has no universal asset storage yet, returns an HONEST
 * storage_not_configured state (never fake assets). When storage exists but is
 * empty, returns an honest empty state.
 */
export function projectCloudAssets(raw: unknown, provider = HIGGSFIELD_PROVIDER_ID): UniversalAssetResult {
  if (raw == null) return { assets: [], state: 'storage_not_configured', reason: 'Universal asset storage is not configured in the cloud yet.' }
  if (!Array.isArray(raw)) return { assets: [], state: 'empty' }
  const assets: UniversalAsset[] = raw.map((r0, i) => {
    const r = (r0 ?? {}) as Record<string, unknown>
    const url = (r.url ?? r.output_url ?? null) as string | null
    const kind = String(r.kind ?? r.type ?? 'image').toLowerCase()
    return {
      id: String(r.id ?? `asset-${i}`),
      provider: (r.provider as string) ?? provider,
      kind: (kind.includes('video') ? 'video' : kind.includes('audio') ? 'audio' : kind.includes('doc') ? 'document' : 'image'),
      url,
      prompt: (r.prompt as string) ?? null,
      model: (r.model as string) ?? null,
      createdAt: Number(r.created_at ?? r.createdAt ?? 0),
      proofHash: (r.proof_hash as string) ?? null,
    }
  })
  return { assets, state: assets.length ? 'ok' : 'empty' }
}

export interface ProofMetadata {
  provider: string
  assetId: string
  prompt: string | null
  model: string | null
  createdAt: number
  proofHash: string | null
  approvalState: 'pending' | 'approved' | 'rejected' | 'needs_revision'
}
