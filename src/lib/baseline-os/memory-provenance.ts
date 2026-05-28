/**
 * Memory provenance helper.
 *
 * Parses the structured `rationale` field that the ingesters write into
 * `workforce_memory` and produces:
 *   - a `source` label that's safe to show to customers
 *     ('Obsidian' / 'Notion' / 'Pinecone' / 'Internal' / 'Workforce Memory')
 *   - a `sourcePath` (vault-relative path for Obsidian, page URL for Notion)
 *   - a `deepLink` an operator can click to open the upstream document:
 *       - Obsidian:  `obsidian://open?vault=<encoded>&file=<encoded>`
 *       - Notion:    the raw page URL (already in the rationale)
 *
 * Rules:
 *   - Never expose vector / embedding / namespace strings to the caller
 *   - Workspace isolation is enforced by the caller; this is pure parse logic
 *
 * Example inputs:
 *   "Source: Obsidian operator vault · 00-doctrine.md · #doctrine"
 *   "Source: Obsidian operator vault · sops/intake.md · noted yesterday"
 *   "Source: Notion · Q1 Doctrine · https://www.notion.so/page-abc"
 */

export interface MemoryProvenance {
  source: 'Obsidian' | 'Notion' | 'Pinecone' | 'Internal' | 'Workforce Memory'
  sourcePath: string | null
  deepLink: string | null
}

const OBSIDIAN_RE = /^Source:\s*Obsidian operator vault\s*·\s*([^·]+?)(?:\s*·.*)?$/i
const NOTION_RE = /^Source:\s*Notion\s*·\s*[^·]+\s*·\s*(https?:\/\/\S+)$/i
const PINECONE_RE = /^Source:\s*Pinecone\b/i

export function deriveProvenance(
  kind: string | null | undefined,
  rationale: string | null | undefined,
  vaultName?: string,
): MemoryProvenance {
  const k = (kind ?? '').toLowerCase()
  const r = (rationale ?? '').trim()

  if (k.startsWith('operator-memory.obsidian')) {
    const match = r.match(OBSIDIAN_RE)
    const path = match?.[1]?.trim() ?? null
    const vault = vaultName?.trim()
    let deepLink: string | null = null
    if (path) {
      // obsidian:// scheme. If vault isn't supplied the operator's app
      // still resolves the most recently opened vault — the link works.
      const params = new URLSearchParams()
      if (vault) params.set('vault', vault)
      params.set('file', path)
      deepLink = `obsidian://open?${params.toString()}`
    }
    return { source: 'Obsidian', sourcePath: path, deepLink }
  }

  if (k.startsWith('operator-memory.notion')) {
    const match = r.match(NOTION_RE)
    const url = match?.[1] ?? null
    return { source: 'Notion', sourcePath: url, deepLink: url }
  }

  if (k.startsWith('operator-memory.pinecone') || PINECONE_RE.test(r)) {
    return { source: 'Pinecone', sourcePath: null, deepLink: null }
  }

  if (k.startsWith('operator-memory.internal')) {
    return { source: 'Internal', sourcePath: null, deepLink: null }
  }

  return { source: 'Workforce Memory', sourcePath: null, deepLink: null }
}

/**
 * The Obsidian vault name. Resolves to the basename of OBSIDIAN_VAULT_PATH
 * when configured, otherwise the bundled demo-vault label. Surfaced to
 * the UI so the `obsidian://` deep-link includes the correct vault hint.
 */
export function obsidianVaultName(): string {
  const path = process.env.OBSIDIAN_VAULT_PATH
  if (!path) return 'Operator Vault'
  const base = path.split('/').filter(Boolean).pop()
  return base || 'Operator Vault'
}
