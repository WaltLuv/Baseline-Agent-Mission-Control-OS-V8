/**
 * Google OAuth flow helpers.
 *
 * Implements the four steps Walt asked for:
 *   1. Consent URL generation (per-service scopes + state CSRF token).
 *   2. Token exchange (code → access_token + refresh_token).
 *   3. Access-token refresh from a stored refresh_token.
 *   4. Token revocation.
 *
 * No raw token ever returns from this module to an HTTP route. The
 * callback writes the refresh_token into the encrypted credential store
 * (decryptCredentialForRuntime is the only path that ever materialises
 * plaintext — used by backend runtimes, not by client APIs).
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

export type GoogleService = 'gmail' | 'google_drive' | 'google_calendar' | 'google_contacts'

/**
 * Per-service scope mapping. Keep tight — broader scopes mean a louder
 * consent screen and an unhappy customer.
 */
export const GOOGLE_SCOPES: Record<GoogleService, string[]> = {
  gmail: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
  ],
  google_drive: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
  ],
  google_calendar: [
    'https://www.googleapis.com/auth/calendar',
  ],
  google_contacts: [
    'https://www.googleapis.com/auth/contacts.readonly',
  ],
}

export type ClientConfig = {
  client_id: string
  client_secret: string
  redirect_uri: string
}

export class GoogleOAuthError extends Error {
  code:
    | 'MISSING_CLIENT_CONFIG'
    | 'UNKNOWN_SERVICE'
    | 'TOKEN_EXCHANGE_FAILED'
    | 'REVOKE_FAILED'
    | 'BAD_RESPONSE'
  http_status?: number
  constructor(code: GoogleOAuthError['code'], message: string, http_status?: number) {
    super(message)
    this.code = code
    this.http_status = http_status
  }
}

export function isGoogleService(s: string): s is GoogleService {
  return s in GOOGLE_SCOPES
}

export function buildConsentUrl(args: {
  client: ClientConfig
  service: GoogleService
  state: string
  /** Optional override; defaults to forcing offline access so we always get a refresh_token. */
  prompt?: 'consent' | 'select_account' | 'none'
}): string {
  if (!isGoogleService(args.service)) {
    throw new GoogleOAuthError('UNKNOWN_SERVICE', `unknown google service: ${args.service}`)
  }
  if (!args.client.client_id || !args.client.client_secret || !args.client.redirect_uri) {
    throw new GoogleOAuthError(
      'MISSING_CLIENT_CONFIG',
      'OAuth client_id / client_secret / redirect_uri must all be set in the google_oauth credential.',
    )
  }
  const params = new URLSearchParams({
    client_id: args.client.client_id,
    redirect_uri: args.client.redirect_uri,
    response_type: 'code',
    scope: GOOGLE_SCOPES[args.service].join(' '),
    state: args.state,
    // `access_type=offline` is what causes Google to return a refresh_token.
    // `prompt=consent` is the only reliable way to force a NEW refresh_token
    // on reconnects when the user has already granted access — without it
    // Google reuses a single refresh token bound to the first grant.
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: args.prompt ?? 'consent',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export type TokenSet = {
  access_token: string
  refresh_token: string | null
  expires_in: number
  scope: string
  token_type: string
}

export async function exchangeCodeForTokens(args: {
  client: ClientConfig
  code: string
  fetcher?: typeof fetch
}): Promise<TokenSet> {
  const fetcher = args.fetcher ?? fetch
  const body = new URLSearchParams({
    client_id: args.client.client_id,
    client_secret: args.client.client_secret,
    code: args.code,
    redirect_uri: args.client.redirect_uri,
    grant_type: 'authorization_code',
  })
  const res = await fetcher(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new GoogleOAuthError('TOKEN_EXCHANGE_FAILED', `token exchange HTTP ${res.status}: ${text.slice(0, 200)}`, res.status)
  }
  const json = (await res.json().catch(() => null)) as TokenSet | null
  if (!json || typeof json.access_token !== 'string') {
    throw new GoogleOAuthError('BAD_RESPONSE', 'token exchange returned no access_token')
  }
  return json
}

export async function refreshAccessToken(args: {
  client: ClientConfig
  refresh_token: string
  fetcher?: typeof fetch
}): Promise<TokenSet> {
  const fetcher = args.fetcher ?? fetch
  const body = new URLSearchParams({
    client_id: args.client.client_id,
    client_secret: args.client.client_secret,
    refresh_token: args.refresh_token,
    grant_type: 'refresh_token',
  })
  const res = await fetcher(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new GoogleOAuthError('TOKEN_EXCHANGE_FAILED', `refresh HTTP ${res.status}: ${text.slice(0, 200)}`, res.status)
  }
  const json = (await res.json().catch(() => null)) as TokenSet | null
  if (!json || typeof json.access_token !== 'string') {
    throw new GoogleOAuthError('BAD_RESPONSE', 'refresh returned no access_token')
  }
  // Google will usually NOT return a refresh_token on refresh — preserve the
  // one we already have.
  return { ...json, refresh_token: json.refresh_token ?? args.refresh_token }
}

export async function revokeToken(args: {
  token: string
  fetcher?: typeof fetch
}): Promise<void> {
  const fetcher = args.fetcher ?? fetch
  const body = new URLSearchParams({ token: args.token })
  const res = await fetcher(GOOGLE_REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  // Google returns 200 on success AND 400 if the token was already revoked /
  // never valid. Both are acceptable terminal states for the disconnect path.
  if (!res.ok && res.status !== 400) {
    const text = await res.text().catch(() => '')
    throw new GoogleOAuthError('REVOKE_FAILED', `revoke HTTP ${res.status}: ${text.slice(0, 200)}`, res.status)
  }
}
