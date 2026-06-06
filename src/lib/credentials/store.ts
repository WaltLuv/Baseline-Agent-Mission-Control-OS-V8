/**
 * Encrypted credential store.
 *
 * Rules (Walt's spec):
 *   · Secrets are encrypted at rest using AES-256-GCM.
 *   · Without CREDENTIALS_ENCRYPTION_KEY (or a clearly-named test override)
 *     writes are REFUSED — we do NOT silently store plaintext in the
 *     workspace DB.
 *   · Raw secret bytes never leave this module. Callers only see
 *     `secret_preview` (e.g. `sk-...abcd`).
 *   · Each row is workspace-scoped via UNIQUE(workspace_id, provider_id).
 *   · Every create/update/delete is audited via @/lib/db logAuditEvent
 *     (handled in the route layer to keep this module pure data).
 */

import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto'
import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { getProvider, type ProviderEntry } from './catalog'

const ALGO = 'aes-256-gcm' as const
const KEY_BYTES = 32
const NONCE_BYTES = 12
const TAG_BYTES = 16

export class CredentialStoreError extends Error {
  code:
    | 'ENCRYPTION_NOT_CONFIGURED'
    | 'UNKNOWN_PROVIDER'
    | 'MISSING_SECRET'
    | 'BAD_INPUT'
    | 'NOT_FOUND'
    | 'INTERNAL'
  constructor(code: CredentialStoreError['code'], message: string) {
    super(message)
    this.code = code
  }
}

/**
 * Resolve a 32-byte key from the env. Accepts either a hex string of
 * exactly 64 chars OR a passphrase that we hash with SHA-256 to 32 bytes.
 * Throws ENCRYPTION_NOT_CONFIGURED if no key is set so the surface fails
 * loudly instead of silently storing plaintext.
 */
function loadKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!raw || !raw.trim()) {
    throw new CredentialStoreError(
      'ENCRYPTION_NOT_CONFIGURED',
      'CREDENTIALS_ENCRYPTION_KEY is not set. Refusing to store secrets in plaintext.',
    )
  }
  const trimmed = raw.trim()
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, 'hex')
  return createHash('sha256').update(trimmed, 'utf8').digest()
}

export function isEncryptionConfigured(): boolean {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY
  return typeof raw === 'string' && raw.trim().length > 0
}

function encryptSecretJson(plain: object): { ciphertext: Buffer; nonce: Buffer } {
  const key = loadKey()
  const nonce = randomBytes(NONCE_BYTES)
  const cipher = createCipheriv(ALGO, key, nonce)
  const enc = Buffer.concat([cipher.update(JSON.stringify(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return { ciphertext: Buffer.concat([enc, tag]), nonce }
}

function decryptSecretJson(ciphertext: Buffer, nonce: Buffer): Record<string, string> {
  const key = loadKey()
  if (ciphertext.length <= TAG_BYTES) throw new CredentialStoreError('INTERNAL', 'ciphertext too short')
  const enc = ciphertext.subarray(0, ciphertext.length - TAG_BYTES)
  const tag = ciphertext.subarray(ciphertext.length - TAG_BYTES)
  const decipher = createDecipheriv(ALGO, key, nonce)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return JSON.parse(dec.toString('utf8')) as Record<string, string>
}

function preview(secrets: Record<string, string>, provider: ProviderEntry): string {
  // Pick the first non-empty primary secret field to preview.
  for (const f of provider.secret_fields) {
    const v = secrets[f.key]
    if (typeof v === 'string' && v.length > 0) return maskValue(v)
  }
  return ''
}

function maskValue(v: string): string {
  if (v.length <= 8) return '••••'
  return `${v.slice(0, 4)}…${v.slice(-4)}`
}

export type CredentialRow = {
  id: number
  workspace_id: number
  provider_id: string
  status: 'pending' | 'connected' | 'error' | 'revoked'
  mode: 'mission_control_credits' | 'bring_your_own_key' | 'both'
  secret_preview: string | null
  public_config: Record<string, string>
  last_verified_at: number | null
  last_error: string | null
  created_at: number
  updated_at: number
}

export type CredentialPublicView = Omit<CredentialRow, never>

function rowToView(row: {
  id: number
  workspace_id: number
  provider_id: string
  status: CredentialRow['status']
  mode: CredentialRow['mode']
  secret_preview: string | null
  public_config_json: string | null
  last_verified_at: number | null
  last_error: string | null
  created_at: number
  updated_at: number
}): CredentialPublicView {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    provider_id: row.provider_id,
    status: row.status,
    mode: row.mode,
    secret_preview: row.secret_preview,
    public_config: row.public_config_json ? (JSON.parse(row.public_config_json) as Record<string, string>) : {},
    last_verified_at: row.last_verified_at,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function listCredentials(workspaceId: number): CredentialPublicView[] {
  const db = getDatabase()
  runMigrations(db)
  const rows = db
    .prepare(
      `SELECT id, workspace_id, provider_id, status, mode, secret_preview,
              public_config_json, last_verified_at, last_error, created_at, updated_at
         FROM workspace_credentials
        WHERE workspace_id = ?
        ORDER BY provider_id ASC`,
    )
    .all(workspaceId) as Parameters<typeof rowToView>[0][]
  return rows.map(rowToView)
}

export function getCredential(workspaceId: number, providerId: string): CredentialPublicView | null {
  const db = getDatabase()
  runMigrations(db)
  const row = db
    .prepare(
      `SELECT id, workspace_id, provider_id, status, mode, secret_preview,
              public_config_json, last_verified_at, last_error, created_at, updated_at
         FROM workspace_credentials
        WHERE workspace_id = ? AND provider_id = ?`,
    )
    .get(workspaceId, providerId) as Parameters<typeof rowToView>[0] | undefined
  return row ? rowToView(row) : null
}

export function upsertCredential(args: {
  workspaceId: number
  providerId: string
  secrets: Record<string, string>
  publicConfig?: Record<string, string>
  mode?: CredentialRow['mode']
  userId?: number
}): CredentialPublicView {
  const provider = getProvider(args.providerId)
  if (!provider) throw new CredentialStoreError('UNKNOWN_PROVIDER', `provider not in catalog: ${args.providerId}`)

  // Validate every required secret field is non-empty.
  for (const f of provider.secret_fields) {
    if (f.optional) continue
    const v = args.secrets[f.key]
    if (typeof v !== 'string' || v.trim() === '') {
      throw new CredentialStoreError('MISSING_SECRET', `missing required secret field: ${f.key}`)
    }
  }

  // Encrypt — refuses if not configured.
  const hasAnySecret = provider.secret_fields.length > 0 &&
    provider.secret_fields.some((f) => typeof args.secrets[f.key] === 'string' && args.secrets[f.key]!.length > 0)
  let ciphertext: Buffer | null = null
  let nonce: Buffer | null = null
  let secretPreview: string | null = null
  if (hasAnySecret) {
    const enc = encryptSecretJson(args.secrets)
    ciphertext = enc.ciphertext
    nonce = enc.nonce
    secretPreview = preview(args.secrets, provider)
  }

  const db = getDatabase()
  runMigrations(db)
  const now = Math.floor(Date.now() / 1000)
  const publicJson = JSON.stringify(args.publicConfig ?? {})
  const mode = args.mode ?? 'bring_your_own_key'

  db.prepare(
    `INSERT INTO workspace_credentials
       (workspace_id, provider_id, status, mode, secret_ciphertext, secret_nonce, secret_preview,
        public_config_json, last_verified_at, last_error, created_by_user_id, updated_by_user_id, created_at, updated_at)
     VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)
     ON CONFLICT(workspace_id, provider_id) DO UPDATE SET
       mode = excluded.mode,
       secret_ciphertext = COALESCE(excluded.secret_ciphertext, workspace_credentials.secret_ciphertext),
       secret_nonce      = COALESCE(excluded.secret_nonce,      workspace_credentials.secret_nonce),
       secret_preview    = COALESCE(excluded.secret_preview,    workspace_credentials.secret_preview),
       public_config_json = excluded.public_config_json,
       updated_by_user_id = excluded.updated_by_user_id,
       updated_at = excluded.updated_at`,
  ).run(
    args.workspaceId,
    args.providerId,
    mode,
    ciphertext,
    nonce,
    secretPreview,
    publicJson,
    args.userId ?? null,
    args.userId ?? null,
    now,
    now,
  )

  const view = getCredential(args.workspaceId, args.providerId)
  if (!view) throw new CredentialStoreError('INTERNAL', 'upsert succeeded but readback failed')
  return view
}

export function deleteCredential(workspaceId: number, providerId: string): boolean {
  const db = getDatabase()
  runMigrations(db)
  const res = db
    .prepare(`DELETE FROM workspace_credentials WHERE workspace_id = ? AND provider_id = ?`)
    .run(workspaceId, providerId)
  return res.changes > 0
}

export function markVerified(workspaceId: number, providerId: string, ok: boolean, errorMsg?: string): void {
  const db = getDatabase()
  runMigrations(db)
  const now = Math.floor(Date.now() / 1000)
  db.prepare(
    `UPDATE workspace_credentials
        SET status = ?,
            last_verified_at = ?,
            last_error = ?,
            updated_at = ?
      WHERE workspace_id = ? AND provider_id = ?`,
  ).run(ok ? 'connected' : 'error', now, ok ? null : errorMsg ?? null, now, workspaceId, providerId)
}

/**
 * Internal — used ONLY by the verification probe + the runtime that needs
 * to make the actual API call. NEVER expose this through an HTTP route.
 */
export function decryptCredentialForRuntime(workspaceId: number, providerId: string): Record<string, string> | null {
  const db = getDatabase()
  runMigrations(db)
  const row = db
    .prepare(
      `SELECT secret_ciphertext, secret_nonce FROM workspace_credentials
        WHERE workspace_id = ? AND provider_id = ?`,
    )
    .get(workspaceId, providerId) as { secret_ciphertext: Buffer | null; secret_nonce: Buffer | null } | undefined
  if (!row || !row.secret_ciphertext || !row.secret_nonce) return null
  return decryptSecretJson(row.secret_ciphertext, row.secret_nonce)
}
