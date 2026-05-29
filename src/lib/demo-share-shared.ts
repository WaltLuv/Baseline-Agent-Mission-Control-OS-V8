/**
 * Demo share — shared constants and pure helpers.
 *
 * This module is intentionally free of `node:crypto` so it can be bundled
 * into client components (e.g. the salesperson share preset). The signing
 * and verifier live in `./demo-share.ts` which imports from here.
 */

export const TOKEN_VERSION = 1
export const DEFAULT_TTL_DAYS = 7
export const MAX_TTL_DAYS = 30

/**
 * Sanitize a prospect display name before embedding it in a token or URL.
 *
 * Rules:
 *   - Strip control characters and angle brackets (XSS hygiene).
 *   - Allow letters, numbers, spaces, and basic punctuation `&.,'-()/`.
 *   - Collapse internal whitespace.
 *   - Clamp to 60 characters.
 */
export function sanitizeProspectName(raw: string | null | undefined): string {
  if (raw == null) return ''
  return String(raw)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f<>]/g, '')
    .replace(/[^A-Za-z0-9 &.,'\-()/]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

/** Clamp the optional `hours` context to a small, safe display range. */
export function clampHours(raw: unknown): number | undefined {
  const n = Number(raw)
  if (!Number.isFinite(n)) return undefined
  if (n <= 0) return undefined
  return Math.min(999, Math.floor(n))
}
