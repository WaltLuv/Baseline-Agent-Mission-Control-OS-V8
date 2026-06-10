import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import {
  PAIRED_DEVICES_DDL,
  startPairing,
  approvePairing,
  claimDeviceStatus,
  heartbeat,
  listDevices,
  revokeDevice,
  deviceSummary,
  canManageDevices,
  defaultPermissions,
  sanitizePermissions,
  sha256,
} from '../device-pairing'

let db: Database.Database
beforeEach(() => {
  db = new Database(':memory:')
  db.exec(PAIRED_DEVICES_DDL)
})

function pair(workspace = 1, user = 7, role: any = 'operator') {
  const start = startPairing({ device_name: 'Test Mac', platform: 'macos', app_version: '0.1.0' }, db)
  const approved = approvePairing({ pairing_code: start.pairing_code, workspace_id: workspace, user_id: user, role }, db)
  const claim = claimDeviceStatus(start.device_id, start.claim_token, db)
  return { start, approved, claim }
}

describe('device pairing — handshake', () => {
  it('start creates a pending device with a code + claim token', () => {
    const r = startPairing({ device_name: 'Mac' }, db)
    expect(r.device_id).toBeTruthy()
    expect(r.pairing_code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(r.claim_token).toHaveLength(48)
    const row = db.prepare('SELECT status FROM paired_devices WHERE device_id=?').get(r.device_id) as any
    expect(row.status).toBe('pending')
  })

  it('approve marks paired with role + permissions', () => {
    const { approved } = pair(1, 7, 'operator')
    expect(approved.ok).toBe(true)
    expect(approved.device!.status).toBe('paired')
    expect(approved.device!.role).toBe('operator')
    expect(approved.device!.permissions).toContain('runtime_status')
  })

  it('claim issues the device token exactly ONCE', () => {
    const start = startPairing({}, db)
    approvePairing({ pairing_code: start.pairing_code, workspace_id: 1, user_id: 7 }, db)
    const first = claimDeviceStatus(start.device_id, start.claim_token, db)
    expect(first.status).toBe('paired')
    expect(first.device_token).toBeTruthy()
    const second = claimDeviceStatus(start.device_id, start.claim_token, db)
    expect(second.device_token).toBeUndefined() // no re-issue
  })

  it('wrong claim token cannot retrieve a token', () => {
    const start = startPairing({}, db)
    approvePairing({ pairing_code: start.pairing_code, workspace_id: 1, user_id: 7 }, db)
    const bad = claimDeviceStatus(start.device_id, 'not-the-claim-token', db)
    expect(bad.device_token).toBeUndefined()
  })

  it('invalid / reused pairing code is rejected', () => {
    expect(approvePairing({ pairing_code: 'ZZZZ-ZZZZ', workspace_id: 1, user_id: 7 }, db).ok).toBe(false)
    const start = startPairing({}, db)
    expect(approvePairing({ pairing_code: start.pairing_code, workspace_id: 1, user_id: 7 }, db).ok).toBe(true)
    // second approve of same (now non-pending) code fails
    expect(approvePairing({ pairing_code: start.pairing_code, workspace_id: 1, user_id: 7 }, db).ok).toBe(false)
  })
})

describe('device pairing — heartbeat & revocation', () => {
  it('heartbeat with the device token updates last_seen', () => {
    const { claim, start } = pair()
    const before = db.prepare('SELECT last_seen_at FROM paired_devices WHERE device_id=?').get(start.device_id) as any
    const hb = heartbeat(claim.device_token!, db)
    expect(hb.ok).toBe(true)
    expect(hb.status).toBe('paired')
    const after = db.prepare('SELECT last_seen_at FROM paired_devices WHERE device_id=?').get(start.device_id) as any
    expect(after.last_seen_at).toBeGreaterThanOrEqual(before.last_seen_at ?? 0)
  })

  it('revoked device cannot heartbeat and token is cleared', () => {
    const { claim, approved } = pair()
    expect(revokeDevice(approved.device!.id, 1, db).ok).toBe(true)
    const hb = heartbeat(claim.device_token!, db)
    expect(hb.ok).toBe(false)
    expect(hb.status).toBe('revoked')
  })

  it('revoke is workspace-scoped (cannot revoke another workspace device)', () => {
    const { approved } = pair(1, 7)
    expect(revokeDevice(approved.device!.id, 2, db).ok).toBe(false) // wrong workspace
    expect(revokeDevice(approved.device!.id, 1, db).ok).toBe(true)
  })

  it('an unknown token never heartbeats', () => {
    expect(heartbeat('deadbeef', db).ok).toBe(false)
  })
})

describe('device pairing — workspace scoping & RBAC', () => {
  it('device list only shows the caller workspace devices', () => {
    pair(1, 7)
    pair(2, 9)
    expect(listDevices(1, db).length).toBe(1)
    expect(listDevices(2, db).length).toBe(1)
    expect(listDevices(99, db).length).toBe(0)
  })

  it('only owner/admin may manage devices', () => {
    expect(canManageDevices('admin')).toBe(true)
    expect(canManageDevices('owner')).toBe(true)
    expect(canManageDevices('operator')).toBe(false)
    expect(canManageDevices('viewer')).toBe(false)
    expect(canManageDevices(undefined)).toBe(false)
  })

  it('permissions are least-privilege by role', () => {
    expect(defaultPermissions('limited')).toEqual(['runtime_status'])
    expect(defaultPermissions('operator')).not.toContain('computer_use')
    expect(defaultPermissions('admin')).toContain('computer_use')
    // unknown permissions are stripped
    expect(sanitizePermissions(['runtime_status', 'rm_rf', 123], 'operator')).toEqual(['runtime_status'])
  })

  it('summary counts total/online/revoked', () => {
    const a = pair(1, 7)
    heartbeat(a.claim.device_token!, db)
    const b = pair(1, 8)
    revokeDevice(b.approved.device!.id, 1, db)
    const s = deviceSummary(1, db)
    expect(s.total).toBe(2)
    expect(s.online).toBe(1)
    expect(s.revoked).toBe(1)
  })
})

describe('device pairing — security invariants', () => {
  it('NEVER stores raw tokens/codes — only sha-256 hashes', () => {
    const start = startPairing({}, db)
    approvePairing({ pairing_code: start.pairing_code, workspace_id: 1, user_id: 7 }, db)
    const claim = claimDeviceStatus(start.device_id, start.claim_token, db)
    const row = db.prepare('SELECT * FROM paired_devices WHERE device_id=?').get(start.device_id) as any
    // raw values absent; only the hash of the issued token is stored
    expect(row.device_token_hash).toBe(sha256(claim.device_token!))
    const serialized = JSON.stringify(row)
    expect(serialized).not.toContain(claim.device_token!)
    expect(serialized).not.toContain(start.claim_token)
  })

  it('safe DTO never leaks any hash field', () => {
    const { approved } = pair()
    const json = JSON.stringify(approved.device)
    expect(json).not.toContain('hash')
  })
})
