/**
 * Signed Demo Share — token signer / verifier.
 *
 * Tokens are entirely self-contained: vertical, expiry, watermark flag, and
 * auto-open flag are encoded into the payload and signed with HMAC-SHA256.
 * No DB row is needed.
 *
 * Security:
 *   - Signed with the same SHARE_SIGNING_SECRET used by /api/briefing/share.
 *   - Payload is base64url-encoded JSON; signature is base64url(HMAC-256).
 *   - Verification is timing-safe.
 *   - read-demo permission is the only permission a token can carry.
 *   - A token can never authorize mutation; the receiver only reads the
 *     demo overlay narrative, which is hard-coded into the binary.
 *
 * URL shape:
 *   /app?demo=<vertical>&tour=1&share=<base64url-payload>.<base64url-sig>
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export const TOKEN_VERSION = 1
export const DEFAULT_TTL_DAYS = 7
export const MAX_TTL_DAYS = 30

export interface DemoSharePayload {
  /** Token format version — bumps if we ever change the shape. */
  v: number
  /** Demo vertical id (e.g. 'cpa', 'law-firm', 'pm', 'ai-agency'). */
  vertical: string
  /** Issued-at, seconds since epoch. */
  iat: number
  /** Expires-at, seconds since epoch. */
  exp: number
  /** Optional: workspace id that issued the token. Audit trail only. */
  by?: number
  /** Permissions granted by this token. Read-demo is the only legal value. */
  perms: ['read-demo']
  /** Auto-open Guided Demo on the landing page. */
  tour: boolean
  /** Show the demo watermark across the dashboard. */
  watermark: boolean
}

export type VerifyResult =
  | { ok: true; payload: DemoSharePayload }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' | 'wrong-version' | 'wrong-perms' }

function getSecret(): string {
  return (
    process.env.SHARE_SIGNING_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.MISSION_CONTROL_SECRET ||
    'dev-only-mission-control-share-secret'
  )
}

function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function sign(payloadEncoded: string, secret: string = getSecret()): string {
  const sig = createHmac('sha256', secret).update(payloadEncoded).digest()
  return base64urlEncode(sig)
}

/**
 * Sign a demo share payload. Returns the URL-safe `payload.sig` token.
 */
export function signDemoToken(
  input: { vertical: string; ttlDays?: number; by?: number; tour?: boolean; watermark?: boolean },
  now: number = Math.floor(Date.now() / 1000),
): { token: string; payload: DemoSharePayload } {
  const ttl = Math.max(1, Math.min(MAX_TTL_DAYS, input.ttlDays ?? DEFAULT_TTL_DAYS))
  const payload: DemoSharePayload = {
    v: TOKEN_VERSION,
    vertical: input.vertical,
    iat: now,
    exp: now + ttl * 24 * 60 * 60,
    by: input.by,
    perms: ['read-demo'],
    tour: input.tour ?? true,
    watermark: input.watermark ?? true,
  }
  const payloadEncoded = base64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = sign(payloadEncoded)
  return { token: `${payloadEncoded}.${sig}`, payload }
}

/**
 * Verify a `payload.sig` token. Returns the payload only if everything checks
 * out — version, signature, expiry, and the read-demo permission.
 */
export function verifyDemoToken(
  token: string | null | undefined,
  now: number = Math.floor(Date.now() / 1000),
): VerifyResult {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, reason: 'malformed' }
  }
  const [payloadEncoded, providedSig] = token.split('.')
  if (!payloadEncoded || !providedSig) return { ok: false, reason: 'malformed' }

  // Timing-safe signature check.
  let expected: Buffer
  let given: Buffer
  try {
    expected = base64urlDecode(sign(payloadEncoded))
    given = base64urlDecode(providedSig)
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'bad-signature' }
  }

  // Decode payload.
  let parsed: DemoSharePayload
  try {
    parsed = JSON.parse(base64urlDecode(payloadEncoded).toString('utf8')) as DemoSharePayload
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  if (parsed.v !== TOKEN_VERSION) return { ok: false, reason: 'wrong-version' }
  if (!Array.isArray(parsed.perms) || parsed.perms.length !== 1 || parsed.perms[0] !== 'read-demo') {
    return { ok: false, reason: 'wrong-perms' }
  }
  if (typeof parsed.exp !== 'number' || parsed.exp <= now) {
    return { ok: false, reason: 'expired' }
  }
  return { ok: true, payload: parsed }
}

/**
 * Build the public landing URL for a token.
 * Always uses /app so the demo overlay loads on the dashboard route.
 */
export function buildShareUrl(origin: string, token: string, vertical: string, tour: boolean): string {
  const url = new URL('/app', origin)
  url.searchParams.set('demo', vertical)
  if (tour) url.searchParams.set('tour', '1')
  url.searchParams.set('share', token)
  return url.toString()
}
