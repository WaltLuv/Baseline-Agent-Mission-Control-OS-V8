/**
 * Baseline OS ↔ Mission Control feature-parity registry.
 *
 * The single source of truth for "does Mission Control have an equivalent
 * surface for every Baseline OS feature?". Drives:
 *   - the parity matrix doc (docs/audit/MC_BASELINE_PARITY.md)
 *   - the honest FeatureSurfacePanel (no 404, no blank, no fake-ready)
 *   - the parity + route-health tests
 *
 * Rule (Walt): if Baseline OS has a page/tab/tool, Mission Control must have an
 * equivalent route with honest state — never simply missing.
 */
export type ParityStatus =
  | 'live' // MC has a working equivalent panel/route
  | 'cloud_pairing' // works once a runtime/provider is paired (honest setup)
  | 'connect_baseline' // local-only in BL; MC shows "connect Baseline OS to enable"
  | 'setup_needed' // surface exists; backend/credentials not configured yet

export interface FeatureSurface {
  /** MC panel slug (route: /app/<slug>) */
  slug: string
  label: string
  category: 'Workforce' | 'Agents & Runtimes' | 'Creative' | 'Knowledge' | 'Platform'
  baselineRoute: string
  /** MC route. For non-live, this is the honest FeatureSurfacePanel route. */
  mcRoute: string
  status: ParityStatus
  /** One-line description of the surface. */
  description: string
  /** How to enable it when not live. */
  enableHint?: string
  /** Real link that helps enable it (credentials / flight-deck / etc.). */
  enableHref?: string
}

export const FEATURE_SURFACES: FeatureSurface[] = [
  // ── Workforce ──────────────────────────────────────────────────────
  { slug: 'overview', label: 'Dashboard', category: 'Workforce', baselineRoute: '/', mcRoute: '/app', status: 'live', description: 'Operator dashboard + setup checklist.' },
  { slug: 'activate', label: 'Activate / Workforces', category: 'Workforce', baselineRoute: '/app/activate', mcRoute: '/app/activate', status: 'live', description: 'Install a complete workforce (11 templates).' },
  { slug: 'workforce', label: 'Workforce Templates', category: 'Workforce', baselineRoute: '/workforce-os', mcRoute: '/app/workforce', status: 'live', description: 'Workforce template catalog.' },
  { slug: 'tasks', label: 'Tasks', category: 'Workforce', baselineRoute: '/kanban', mcRoute: '/app/tasks', status: 'live', description: 'Task board.' },
  { slug: 'orchestration', label: 'Orchestration', category: 'Workforce', baselineRoute: '/maestro', mcRoute: '/app/orchestration', status: 'live', description: 'Multi-agent orchestration.' },
  { slug: 'approvals', label: 'Approvals', category: 'Workforce', baselineRoute: '/approvals', mcRoute: '/app/approvals', status: 'live', description: 'Human-in-the-loop approval queue.' },
  { slug: 'activity', label: 'Activity', category: 'Workforce', baselineRoute: '/activity', mcRoute: '/app/activity', status: 'live', description: 'Live workforce activity feed.' },
  { slug: 'value', label: 'ROI / Value', category: 'Workforce', baselineRoute: '/', mcRoute: '/app/value', status: 'live', description: 'ROI + value reporting.' },
  { slug: 'goals', label: 'Goals', category: 'Workforce', baselineRoute: '/goals', mcRoute: '/app/goals', status: 'live', description: 'Goal tracking.' },
  { slug: 'kanban', label: 'Kanban / Dispatcher', category: 'Workforce', baselineRoute: '/kanban', mcRoute: '/app/tasks', status: 'live', description: 'Task board / dispatcher.' },
  { slug: 'daily-brief', label: 'Daily Brief', category: 'Workforce', baselineRoute: '/', mcRoute: '/briefing', status: 'live', description: 'Daily brief.' },
  { slug: 'executive-briefing', label: 'Executive Briefing', category: 'Workforce', baselineRoute: '/', mcRoute: '/briefing', status: 'live', description: 'Executive briefing.' },
  { slug: 'proofs', label: 'Proofs / Handoff', category: 'Workforce', baselineRoute: '/agents/claude-code-studio', mcRoute: '/app/proofs', status: 'setup_needed', description: 'Proof manifests + handoff packages.', enableHint: 'Proofs are produced by render/orchestration jobs in Claude Code Studio.', enableHref: '/app/creative' },

  // ── Agents & Runtimes ──────────────────────────────────────────────
  { slug: 'agents', label: 'Agents', category: 'Agents & Runtimes', baselineRoute: '/personas', mcRoute: '/app/agents', status: 'live', description: 'AI employee roster.' },
  { slug: 'personas', label: 'Personas', category: 'Agents & Runtimes', baselineRoute: '/personas', mcRoute: '/app/personas', status: 'live', description: 'Persona library.' },
  { slug: 'runtimes', label: 'Runtimes', category: 'Agents & Runtimes', baselineRoute: '/runtime-registry', mcRoute: '/app/runtimes', status: 'live', description: 'Connected runtimes + health.' },
  { slug: 'claude-code', label: 'Claude Code', category: 'Agents & Runtimes', baselineRoute: '/agents/claude-code', mcRoute: '/app/claude-code', status: 'live', description: 'Claude Code runtime.' },
  { slug: 'codex', label: 'Codex', category: 'Agents & Runtimes', baselineRoute: '/agents/codex', mcRoute: '/app/codex', status: 'cloud_pairing', description: 'OpenAI Codex runtime.', enableHint: 'Connect a Codex runtime to Mission Control.', enableHref: '/app/runtimes' },
  { slug: 'openclaw', label: 'OpenClaw', category: 'Agents & Runtimes', baselineRoute: '/agents/openclaw', mcRoute: '/app/openclaw', status: 'cloud_pairing', description: 'OpenClaw self-hosted runtime.', enableHint: 'Pair an OpenClaw runtime.', enableHref: '/app/runtimes' },
  { slug: 'hermes', label: 'Hermes', category: 'Agents & Runtimes', baselineRoute: '/agents/hermes', mcRoute: '/app/hermes', status: 'cloud_pairing', description: 'Hermes orchestration runtime.', enableHint: 'Pair a Hermes runtime.', enableHref: '/app/runtimes' },
  { slug: 'hermes-vps', label: 'Hermes VPS', category: 'Agents & Runtimes', baselineRoute: '/agents/hermes', mcRoute: '/app/runtimes', status: 'cloud_pairing', description: 'Hermes VPS production controller.', enableHint: 'Pair the VPS via the runtime-key flow.', enableHref: '/app/runtimes' },
  { slug: 'oh-my-pi', label: 'Oh My Pi (OMP)', category: 'Agents & Runtimes', baselineRoute: '/agents/pi-runtime', mcRoute: '/app/oh-my-pi', status: 'cloud_pairing', description: 'Oh My Pi coding harness runtime.', enableHint: 'Connect an OMP runtime.', enableHref: '/app/runtimes' },
  { slug: 'antigravity', label: 'Antigravity', category: 'Agents & Runtimes', baselineRoute: '/agents/antigravity', mcRoute: '/app/antigravity', status: 'cloud_pairing', description: 'Antigravity runtime.', enableHint: 'Pair an Antigravity runtime.', enableHref: '/app/runtimes' },
  { slug: 'gemini', label: 'Gemini', category: 'Agents & Runtimes', baselineRoute: '/agents/gemini', mcRoute: '/app/gemini', status: 'setup_needed', description: 'Gemini provider.', enableHint: 'Add a Google/Gemini credential.', enableHref: '/app/credentials' },
  { slug: 'free-claude', label: 'Free Claude Code', category: 'Agents & Runtimes', baselineRoute: '/agents/free-claude', mcRoute: '/app/free-claude', status: 'connect_baseline', description: 'Free Claude Code (local fcc-server).', enableHint: 'Local-only — connect Baseline OS / Flight Deck to enable.', enableHref: '/flight-deck' },
  { slug: 'browser-use', label: 'Browser Use', category: 'Agents & Runtimes', baselineRoute: '/browser', mcRoute: '/app/browser-use', status: 'connect_baseline', description: 'Browser automation runtime.', enableHint: 'Local-only — connect Baseline OS / Flight Deck to enable.', enableHref: '/flight-deck' },
  { slug: 'ruflo', label: 'Ruflo', category: 'Agents & Runtimes', baselineRoute: '/agents/ruflo', mcRoute: '/app/ruflo', status: 'connect_baseline', description: 'Ruflo MCP runtime.', enableHint: 'Local-only — connect Baseline OS / Flight Deck to enable.', enableHref: '/flight-deck' },
  { slug: 'hermes-manage', label: 'Hermes Manage', category: 'Agents & Runtimes', baselineRoute: '/agents/hermes/control', mcRoute: '/app/hermes-manage', status: 'cloud_pairing', description: 'Manage Hermes runtime — control, goals, workspace.', enableHint: 'Pair a Hermes runtime to manage it.', enableHref: '/app/runtimes' },
  { slug: 'slim-voice', label: 'Slim Voice Agent', category: 'Agents & Runtimes', baselineRoute: '/agents/hermes', mcRoute: '/app/slim-voice', status: 'connect_baseline', description: 'Slim voice agent (local voice runtime).', enableHint: 'Local-only — connect Baseline OS / Flight Deck to enable.', enableHref: '/flight-deck' },

  // ── Creative ───────────────────────────────────────────────────────
  { slug: 'creative', label: 'Claude Code Studio', category: 'Creative', baselineRoute: '/agents/claude-code-studio', mcRoute: '/app/creative', status: 'live', description: 'Unified creative operating system (provider matrix, render queue, proof).' },
  { slug: 'higgsfield', label: 'Higgsfield', category: 'Creative', baselineRoute: '/higgsfield', mcRoute: '/app/higgsfield', status: 'live', description: 'Higgsfield provider control center.' },
  { slug: 'hyperframes', label: 'HyperFrames', category: 'Creative', baselineRoute: '/hyperframes', mcRoute: '/app/hyperframes', status: 'live', description: 'HTML→MP4 render pipeline (in the Creative Provider Matrix).' },
  { slug: 'provider-matrix', label: 'Creative Provider Matrix', category: 'Creative', baselineRoute: '/agents/claude-code-studio', mcRoute: '/app/provider-matrix', status: 'live', description: 'All creative providers — cost, proof, honest status + HyperFrames pipeline.' },
  { slug: 'minimax', label: 'MiniMax', category: 'Creative', baselineRoute: '/minimax', mcRoute: '/app/minimax', status: 'setup_needed', description: 'MiniMax provider (chat/TTS/video).', enableHint: 'Add a MiniMax credential.', enableHref: '/app/credentials' },
  { slug: 'video-studio', label: 'Video / Creative Studio', category: 'Creative', baselineRoute: '/video-studio', mcRoute: '/app/creative', status: 'live', description: 'Video editing team (in Claude Code Studio).' },
  { slug: 'asset-library', label: 'Asset Library', category: 'Creative', baselineRoute: '/agents/claude-code-studio', mcRoute: '/app/asset-library', status: 'setup_needed', description: 'Universal asset library (provider-sovereign).', enableHint: 'Generate or import assets; cloud mirroring is a setup-required contract.', enableHref: '/app/creative' },

  // ── Knowledge ──────────────────────────────────────────────────────
  { slug: 'knowledge-os', label: 'Knowledge OS', category: 'Knowledge', baselineRoute: '/memory', mcRoute: '/app/knowledge-os', status: 'setup_needed', description: 'Four-brain knowledge dashboard.', enableHint: 'Connect the brain layers (Obsidian/Notion/Pinecone/NotebookLM).', enableHref: '/app/credentials' },
  { slug: 'memory', label: 'Memory', category: 'Knowledge', baselineRoute: '/memory', mcRoute: '/app/memory', status: 'live', description: 'Memory browser.' },
  { slug: 'notebooklm', label: 'NotebookLM', category: 'Knowledge', baselineRoute: '/agents/notebooklm', mcRoute: '/app/notebooklm', status: 'setup_needed', description: 'Brain Layer 4 — research synthesis, audio/video/slides.', enableHint: 'Connect NotebookLM (local automation) via Baseline OS / Flight Deck.', enableHref: '/flight-deck' },
  { slug: 'obsidian', label: 'Obsidian', category: 'Knowledge', baselineRoute: '/memory', mcRoute: '/app/obsidian', status: 'connect_baseline', description: 'Brain Layer 1 — working memory vault.', enableHint: 'Local vault — connect Baseline OS to enable.', enableHref: '/flight-deck' },
  { slug: 'notion', label: 'Notion', category: 'Knowledge', baselineRoute: '/notion', mcRoute: '/app/notion', status: 'setup_needed', description: 'Brain Layer 2 — structured business memory.', enableHint: 'Add a Notion credential.', enableHref: '/app/credentials' },
  { slug: 'pinecone', label: 'Pinecone', category: 'Knowledge', baselineRoute: '/pinecone', mcRoute: '/app/pinecone', status: 'setup_needed', description: 'Brain Layer 3 — long-term semantic memory.', enableHint: 'Add a Pinecone credential.', enableHref: '/app/credentials' },
  { slug: 'pi-agent', label: 'PI Agent', category: 'Knowledge', baselineRoute: '/agents/pi-runtime', mcRoute: '/app/pi-agent', status: 'setup_needed', description: 'Chief Memory Officer across the brain layers.', enableHint: 'Connect the brain layers to activate PI Agent.', enableHref: '/app/credentials' },
  { slug: 'documents', label: 'Documents', category: 'Knowledge', baselineRoute: '/documents', mcRoute: '/app/documents', status: 'live', description: 'Workspace document store.' },
  { slug: 'library', label: 'Library', category: 'Knowledge', baselineRoute: '/library', mcRoute: '/app/library', status: 'live', description: 'Knowledge library.' },

  // ── Platform ───────────────────────────────────────────────────────
  { slug: 'skills', label: 'Skills', category: 'Platform', baselineRoute: '/skills', mcRoute: '/app/skills', status: 'live', description: 'Skills fleet.' },
  { slug: 'marketplace', label: 'Marketplace', category: 'Platform', baselineRoute: '/skills', mcRoute: '/marketplace', status: 'live', description: 'Skills + workforce marketplace.' },
  { slug: 'billing', label: 'Billing / Credits', category: 'Platform', baselineRoute: '/settings', mcRoute: '/app/billing', status: 'live', description: 'Credits + billing.' },
  { slug: 'credentials', label: 'Credentials / API Keys', category: 'Platform', baselineRoute: '/settings/api-keys', mcRoute: '/app/credentials', status: 'live', description: 'Credentials manager.' },
  { slug: 'flight-deck', label: 'Flight Deck', category: 'Platform', baselineRoute: '/flight-deck', mcRoute: '/flight-deck', status: 'live', description: 'Desktop terminal / local pairing.' },
  { slug: 'seo', label: 'SEO', category: 'Platform', baselineRoute: '/seo', mcRoute: '/app/seo', status: 'live', description: 'SEO surface.' },
  { slug: 'settings', label: 'Settings / Admin', category: 'Platform', baselineRoute: '/settings', mcRoute: '/app/settings', status: 'live', description: 'Settings + admin.' },
  { slug: 'admin', label: 'Admin / Super Admin', category: 'Platform', baselineRoute: '/admin', mcRoute: '/app/super-admin', status: 'live', description: 'Admin / super-admin console.' },
  { slug: 'help', label: 'Help / Docs', category: 'Platform', baselineRoute: '/guide', mcRoute: '/help', status: 'live', description: 'Help + documentation.' },
]

export const PARITY_STATUS_LABEL: Record<ParityStatus, string> = {
  live: 'Live',
  cloud_pairing: 'Connect runtime',
  connect_baseline: 'Connect Baseline OS',
  setup_needed: 'Setup needed',
}

/** Surfaces that are NOT yet a dedicated live MC panel — rendered by the honest FeatureSurfacePanel. */
export function nonLiveSurfaces(): FeatureSurface[] {
  return FEATURE_SURFACES.filter((s) => s.status !== 'live')
}

export function getSurface(slug: string): FeatureSurface | undefined {
  return FEATURE_SURFACES.find((s) => s.slug === slug)
}
