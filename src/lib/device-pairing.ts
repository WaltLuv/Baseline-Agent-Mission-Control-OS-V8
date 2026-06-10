/**
 * Device pairing — Mission Control ↔ Flight Deck secure handshake.
 *
 * A Flight Deck desktop app pairs with a workspace. Mission Control issues a
 * scoped, hashed device token; the device heartbeats with it. Owners/admins
 * approve and revoke; revocation is detected on the next heartbeat.
 *
 * Security invariants enforced here:
 *   - raw tokens/codes are returned to the caller AT MOST ONCE and only the
 *     SHA-256 hash is ever persisted (never the raw value),
 *   - all reads/writes are workspace-scoped,
 *   - device permissions default to least-privilege per role,
 *   - safe DTOs never include any *_hash column.
 */
import type Database from 'better-sqlite3'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { getDatabase } from './db'

export const PAIRED_DEVICES_DDL = `
  CREATE TABLE IF NOT EXISTS paired_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER,
    user_id INTEGER,
    device_id TEXT NOT NULL UNIQUE,
    device_name TEXT,
    device_type TEXT,
    platform TEXT,
    app_version TEXT,
    public_key TEXT,
    device_fingerprint TEXT,
    pairing_code_hash TEXT,
    claim_token_hash TEXT,
    device_token_hash TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    role TEXT NOT NULL DEFAULT 'operator',
    permissions_json TEXT NOT NULL DEFAULT '[]',
    last_seen_at INTEGER,
    paired_at INTEGER,
    revoked_at INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_paired_devices_ws ON paired_devices(workspace_id, status);
  CREATE INDEX IF NOT EXISTS idx_paired_devices_device ON paired_devices(device_id);
  CREATE INDEX IF NOT EXISTS idx_paired_devices_token ON paired_devices(device_token_hash);
`

export type DeviceRole = 'owner' | 'admin' | 'operator' | 'limited'
export type DeviceStatus = 'pending' | 'paired' | 'revoked' | 'expired'

export const DEVICE_PERMISSIONS = [
  'runtime_status',
  'open_local_urls',
  'graphify_query',
  'start_runtime',
  'stop_runtime',
  'file_access',
  'browser_worker',
  'computer_use',
] as const
export type DevicePermission = (typeof DEVICE_PERMISSIONS)[number]

/** Least-privilege defaults — NO broad access by default. */
export function defaultPermissions(role: DeviceRole): DevicePermission[] {
  switch (role) {
    case 'owner':
    case 'admin':
      return [...DEVICE_PERMISSIONS]
    case 'operator':
      return ['runtime_status', 'open_local_urls', 'graphify_query', 'start_runtime', 'stop_runtime']
    case 'limited':
    default:
      return ['runtime_status']
  }
}

/** Only owners/admins may approve or revoke devices. MC user roles: admin|operator|viewer. */
export function canManageDevices(userRole: string | undefined | null): boolean {
  return userRole === 'admin' || userRole === 'owner'
}

export function normalizeRole(role: unknown): DeviceRole {
  return role === 'owner' || role === 'admin' || role === 'operator' || role === 'limited'
    ? role
    : 'operator'
}

export function sanitizePermissions(input: unknown, role: DeviceRole): DevicePermission[] {
  if (!Array.isArray(input)) return defaultPermissions(role)
  const allowed = new Set<string>(DEVICE_PERMISSIONS)
  const picked = input.filter((p): p is DevicePermission => typeof p === 'string' && allowed.has(p))
  return picked.length ? Array.from(new Set(picked)) : defaultPermissions(role)
}

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex')
export const genDeviceId = (): string => randomUUID()
export const genDeviceToken = (): string => randomBytes(32).toString('hex')
export const genClaimToken = (): string => randomBytes(24).toString('hex')

/** 8-char human pairing code from an unambiguous alphabet (no 0/O/1/I). */
export function genPairingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length]
  return `${out.slice(0, 4)}-${out.slice(4)}`
}

const now = () => Math.floor(Date.now() / 1000)
const PAIRING_TTL_SEC = 600 // pending pairing code valid 10 minutes
const ONLINE_WINDOW_SEC = 90 // heartbeat freshness for "online"

export interface SafeDevice {
  id: number
  device_id: string
  device_name: string | null
  device_type: string | null
  platform: string | null
  app_version: string | null
  status: DeviceStatus
  role: DeviceRole
  permissions: DevicePermission[]
  online: boolean
  last_seen_at: number | null
  paired_at: number | null
  revoked_at: number | null
  expires_at: number | null
  created_at: number
}

/** Map a raw DB row to a safe DTO — never includes any *_hash or raw token. */
export function toSafeDevice(row: any): SafeDevice {
  const ts = now()
  const online =
    row.status === 'paired' && row.last_seen_at != null && ts - row.last_seen_at <= ONLINE_WINDOW_SEC
  return {
    id: row.id,
    device_id: row.device_id,
    device_name: row.device_name ?? null,
    device_type: row.device_type ?? null,
    platform: row.platform ?? null,
    app_version: row.app_version ?? null,
    status: row.status,
    role: normalizeRole(row.role),
    permissions: (() => {
      try {
        return sanitizePermissions(JSON.parse(row.permissions_json || '[]'), normalizeRole(row.role))
      } catch {
        return []
      }
    })(),
    online,
    last_seen_at: row.last_seen_at ?? null,
    paired_at: row.paired_at ?? null,
    revoked_at: row.revoked_at ?? null,
    expires_at: row.expires_at ?? null,
    created_at: row.created_at,
  }
}

type DB = Database.Database

// ── Operations ───────────────────────────────────────────────────────────

export interface StartPairingInput {
  device_id?: string
  device_name?: string
  device_type?: string
  platform?: string
  app_version?: string
  public_key?: string
  device_fingerprint?: string
}

export interface StartPairingResult {
  device_id: string
  pairing_code: string // shown to user — returned ONCE
  claim_token: string // held by device to claim its token — returned ONCE
  expires_at: number
}

/** Step 1 (device, unauthenticated): create/refresh a pending pairing request. */
export function startPairing(input: StartPairingInput, db: DB = getDatabase()): StartPairingResult {
  const ts = now()
  const deviceId = input.device_id?.trim() || genDeviceId()
  const pairingCode = genPairingCode()
  const claimToken = genClaimToken()
  const expiresAt = ts + PAIRING_TTL_SEC

  const existing = db.prepare('SELECT id, status FROM paired_devices WHERE device_id = ?').get(deviceId) as
    | { id: number; status: string }
    | undefined

  if (existing) {
    // Re-pair: reset to pending with a fresh code/claim. (Revoked devices can re-pair.)
    db.prepare(
      `UPDATE paired_devices SET device_name=?, device_type=?, platform=?, app_version=?, public_key=?, device_fingerprint=?,
         pairing_code_hash=?, claim_token_hash=?, device_token_hash=NULL, status='pending', workspace_id=NULL, user_id=NULL,
         paired_at=NULL, revoked_at=NULL, expires_at=?, updated_at=? WHERE device_id=?`,
    ).run(
      input.device_name ?? null,
      input.device_type ?? null,
      input.platform ?? null,
      input.app_version ?? null,
      input.public_key ?? null,
      input.device_fingerprint ?? null,
      sha256(pairingCode),
      sha256(claimToken),
      expiresAt,
      ts,
      deviceId,
    )
  } else {
    db.prepare(
      `INSERT INTO paired_devices
         (device_id, device_name, device_type, platform, app_version, public_key, device_fingerprint,
          pairing_code_hash, claim_token_hash, status, role, permissions_json, expires_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?, 'pending', 'operator', '[]', ?, ?, ?)`,
    ).run(
      deviceId,
      input.device_name ?? null,
      input.device_type ?? null,
      input.platform ?? null,
      input.app_version ?? null,
      input.public_key ?? null,
      input.device_fingerprint ?? null,
      sha256(pairingCode),
      sha256(claimToken),
      expiresAt,
      ts,
      ts,
    )
  }
  return { device_id: deviceId, pairing_code: pairingCode, claim_token: claimToken, expires_at: expiresAt }
}

export interface ApproveResult {
  ok: boolean
  error?: string
  device?: SafeDevice
}

/** Step 2 (user, authenticated + workspace-scoped + role-gated): approve a pending device. */
export function approvePairing(
  args: { pairing_code: string; workspace_id: number; user_id: number; role?: unknown; permissions?: unknown },
  db: DB = getDatabase(),
): ApproveResult {
  const ts = now()
  const code = (args.pairing_code || '').trim().toUpperCase()
  const row = db
    .prepare("SELECT * FROM paired_devices WHERE pairing_code_hash = ? AND status = 'pending'")
    .get(sha256(code)) as any
  if (!row) return { ok: false, error: 'invalid_or_used_code' }
  if (row.expires_at && row.expires_at < ts) {
    db.prepare("UPDATE paired_devices SET status='expired', updated_at=? WHERE id=?").run(ts, row.id)
    return { ok: false, error: 'pairing_expired' }
  }
  const role = normalizeRole(args.role)
  const perms = sanitizePermissions(args.permissions, role)
  db.prepare(
    `UPDATE paired_devices SET workspace_id=?, user_id=?, role=?, permissions_json=?, status='paired',
       paired_at=?, updated_at=?, pairing_code_hash=NULL WHERE id=?`,
  ).run(args.workspace_id, args.user_id, role, JSON.stringify(perms), ts, ts, row.id)
  const updated = db.prepare('SELECT * FROM paired_devices WHERE id=?').get(row.id)
  return { ok: true, device: toSafeDevice(updated) }
}

export interface ClaimResult {
  status: DeviceStatus
  device_token?: string // returned ONCE, on first successful claim
  workspace_id?: number
  role?: DeviceRole
  permissions?: DevicePermission[]
}

/** Step 3 (device poll): once approved, issue the device token ONCE to the holder of claim_token. */
export function claimDeviceStatus(device_id: string, claim_token: string, db: DB = getDatabase()): ClaimResult {
  const row = db.prepare('SELECT * FROM paired_devices WHERE device_id = ?').get(device_id) as any
  if (!row) return { status: 'expired' }
  if (row.status !== 'paired') return { status: row.status as DeviceStatus }
  // Must hold the original claim token from startPairing.
  if (!row.claim_token_hash || sha256(claim_token) !== row.claim_token_hash) {
    return { status: 'pending' }
  }
  if (!row.device_token_hash) {
    // First claim → mint the device token, store only its hash, return raw ONCE.
    const token = genDeviceToken()
    db.prepare(
      "UPDATE paired_devices SET device_token_hash=?, claim_token_hash=NULL, last_seen_at=?, updated_at=? WHERE id=?",
    ).run(sha256(token), now(), now(), row.id)
    return {
      status: 'paired',
      device_token: token,
      workspace_id: row.workspace_id,
      role: normalizeRole(row.role),
      permissions: sanitizePermissions(JSON.parse(row.permissions_json || '[]'), normalizeRole(row.role)),
    }
  }
  // Already claimed — no token re-issue.
  return { status: 'paired', workspace_id: row.workspace_id, role: normalizeRole(row.role) }
}

export interface HeartbeatResult {
  ok: boolean
  status: DeviceStatus
  role?: DeviceRole
  permissions?: DevicePermission[]
  workspace_id?: number
}

/** Device heartbeat (authenticated by raw device token). Revoked/expired tokens fail. */
export function heartbeat(device_token: string, db: DB = getDatabase()): HeartbeatResult {
  const ts = now()
  const row = db.prepare('SELECT * FROM paired_devices WHERE device_token_hash = ?').get(sha256(device_token)) as any
  if (!row) return { ok: false, status: 'revoked' }
  if (row.status === 'revoked') return { ok: false, status: 'revoked' }
  if (row.expires_at && row.expires_at < ts && row.status !== 'paired') return { ok: false, status: 'expired' }
  db.prepare('UPDATE paired_devices SET last_seen_at=?, updated_at=? WHERE id=?').run(ts, ts, row.id)
  return {
    ok: true,
    status: 'paired',
    role: normalizeRole(row.role),
    permissions: sanitizePermissions(JSON.parse(row.permissions_json || '[]'), normalizeRole(row.role)),
    workspace_id: row.workspace_id,
  }
}

/** List devices for a workspace (safe DTOs only). */
export function listDevices(workspace_id: number, db: DB = getDatabase()): SafeDevice[] {
  const rows = db
    .prepare("SELECT * FROM paired_devices WHERE workspace_id = ? AND status != 'pending' ORDER BY created_at DESC")
    .all(workspace_id) as any[]
  return rows.map(toSafeDevice)
}

/** Revoke a device — workspace-scoped. Clears its token hash so heartbeats fail. */
export function revokeDevice(id: number, workspace_id: number, db: DB = getDatabase()): { ok: boolean; error?: string } {
  const ts = now()
  const row = db.prepare('SELECT id FROM paired_devices WHERE id = ? AND workspace_id = ?').get(id, workspace_id)
  if (!row) return { ok: false, error: 'not_found' }
  db.prepare(
    "UPDATE paired_devices SET status='revoked', revoked_at=?, device_token_hash=NULL, claim_token_hash=NULL, updated_at=? WHERE id=?",
  ).run(ts, ts, id)
  return { ok: true }
}

export interface DeviceSummary {
  total: number
  paired: number
  online: number
  revoked: number
  latest_heartbeat: number | null
}

export function deviceSummary(workspace_id: number, db: DB = getDatabase()): DeviceSummary {
  const devices = listDevices(workspace_id, db)
  return {
    total: devices.length,
    paired: devices.filter((d) => d.status === 'paired').length,
    online: devices.filter((d) => d.online).length,
    revoked: devices.filter((d) => d.status === 'revoked').length,
    latest_heartbeat: devices.reduce<number | null>(
      (m, d) => (d.last_seen_at && (!m || d.last_seen_at > m) ? d.last_seen_at : m),
      null,
    ),
  }
}
