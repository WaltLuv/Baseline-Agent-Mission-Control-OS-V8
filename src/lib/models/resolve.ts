/**
 * Featured + alias resolution against the synced catalogue.
 *
 * Pure functions — no I/O on import. Pass in the catalogue rows the caller
 * already fetched (typically `listModels()`).
 */

import { ALIASES, FEATURED_CATALOG } from './featured'
import type {
  AliasName,
  FeaturedEntry,
  ModelRow,
  ResolvedAlias,
  ResolvedFeaturedEntry,
} from './types'

export function resolveFeatured(catalog: ModelRow[]): ResolvedFeaturedEntry[] {
  const byKey = new Map<string, ModelRow>()
  for (const row of catalog) byKey.set(`${row.source}:${row.model_slug}`, row)
  return FEATURED_CATALOG.map((entry: FeaturedEntry) => {
    const hit = byKey.get(`${entry.source}:${entry.model_slug}`)
    const resolved = hit && hit.status !== 'deprecated' && hit.status !== 'unavailable' ? hit : null
    return {
      ...entry,
      resolved,
      status: resolved ? 'available' : 'unavailable',
    }
  })
}

export function resolveAliases(catalog: ModelRow[]): ResolvedAlias[] {
  const bySlug = new Map<string, ModelRow>()
  for (const row of catalog) {
    // Prefer openrouter-sourced rows so aliases resolve to the canonical
    // provider-prefixed slug; local sources still match if no upstream row.
    const prev = bySlug.get(row.model_slug)
    if (!prev || (prev.source !== 'openrouter' && row.source === 'openrouter')) {
      bySlug.set(row.model_slug, row)
    }
  }
  return (Object.keys(ALIASES) as AliasName[]).map((alias) => {
    const candidates = ALIASES[alias]
    for (const slug of candidates) {
      const hit = bySlug.get(slug)
      if (hit && hit.status === 'available') {
        return { alias, resolved: hit, status: 'available' as const }
      }
    }
    return { alias, resolved: null, status: 'unavailable' as const }
  })
}
