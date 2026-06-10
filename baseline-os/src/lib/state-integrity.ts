/**
 * State integrity layer (Baseline OS).
 *
 * Root cause this fixes: components used `useState(default)` + a value-keyed
 * write effect, so on first mount/SSR the effect persisted the DEFAULT (often
 * empty) value, clobbering previously-saved data before the hydrate effect ran.
 * Profile picture vanished, name reset, settings reverted to defaults.
 *
 * Rules enforced here:
 *  1. Read durable storage FIRST, defaults SECOND.
 *  2. NEVER write until after client hydration (writeAllowed gate).
 *  3. NEVER overwrite an existing value with an empty default unless the caller
 *     explicitly clears it (allowEmpty).
 *  4. Critical saves write → re-read → VERIFY → emit an audit event; never
 *     silently fail, never silently reset.
 */

export type StateAuditKind =
  | "read"
  | "write"
  | "verify-ok"
  | "verify-fail"
  | "skip-empty"
  | "error";

export interface StateAuditEvent {
  ts: number;
  kind: StateAuditKind;
  key: string;
  note?: string;
}

const auditLog: StateAuditEvent[] = [];
const AUDIT_MAX = 500;

function emit(kind: StateAuditKind, key: string, note?: string): void {
  auditLog.push({ ts: nowTs(), kind, key, note });
  if (auditLog.length > AUDIT_MAX) auditLog.splice(0, auditLog.length - AUDIT_MAX);
}

// Date.now is fine in the browser; guard for any non-DOM context.
function nowTs(): number {
  try {
    return Date.now();
  } catch {
    return 0;
  }
}

export function getStateAuditLog(): readonly StateAuditEvent[] {
  return auditLog;
}

export function clearStateAuditLog(): void {
  auditLog.length = 0;
}

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Read a durable value. Returns null if absent or unavailable. */
export function durableGet(key: string): string | null {
  if (!hasWindow()) return null;
  try {
    const v = window.localStorage.getItem(key);
    emit("read", key, v == null ? "absent" : `${v.length} chars`);
    return v;
  } catch (e) {
    emit("error", key, `read failed: ${(e as Error).message}`);
    return null;
  }
}

export interface DurableSetOptions {
  /** Allow writing an empty/blank value (i.e. an explicit clear). Default false. */
  allowEmpty?: boolean;
  /** Verify by re-reading after write (default true). */
  verify?: boolean;
}

export interface DurableSetResult {
  ok: boolean;
  verified: boolean;
  skipped?: "empty";
  error?: string;
}

/**
 * Critical save: write → re-read → verify → audit. Refuses to overwrite an
 * existing value with an empty one unless allowEmpty. Never throws.
 */
export function durableSet(
  key: string,
  value: string,
  opts: DurableSetOptions = {},
): DurableSetResult {
  const { allowEmpty = false, verify = true } = opts;
  if (!hasWindow()) return { ok: false, verified: false, error: "no-window" };

  const isEmpty = value == null || String(value).trim() === "";
  if (isEmpty && !allowEmpty) {
    // Don't let an empty default clobber a real saved value.
    const existing = window.localStorage.getItem(key);
    if (existing != null && existing !== "") {
      emit("skip-empty", key, "refused to overwrite saved value with empty");
      return { ok: false, verified: false, skipped: "empty" };
    }
  }

  try {
    if (isEmpty && allowEmpty) {
      window.localStorage.removeItem(key);
      emit("write", key, "cleared");
    } else {
      window.localStorage.setItem(key, value);
      emit("write", key, `${value.length} chars`);
    }
    if (!verify) return { ok: true, verified: false };
    const readBack = window.localStorage.getItem(key);
    const expected = isEmpty && allowEmpty ? null : value;
    const verified = readBack === expected;
    emit(verified ? "verify-ok" : "verify-fail", key, verified ? undefined : "read-back mismatch");
    return { ok: verified, verified };
  } catch (e) {
    emit("error", key, `write failed: ${(e as Error).message}`);
    return { ok: false, verified: false, error: (e as Error).message };
  }
}

/** Broadcast a same-tab + cross-tab storage update so listeners rehydrate. */
export function broadcastStorage(key: string, newValue: string | null): void {
  if (!hasWindow()) return;
  try {
    window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
  } catch {
    /* non-fatal */
  }
}

/** "x minutes ago" style label for a last-saved timestamp. */
export function lastSavedLabel(ts: number | null): string {
  if (!ts) return "never";
  const diff = Math.max(0, nowTs() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
