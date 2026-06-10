/**
 * Baseline OS local credential store — used ONLY by the vite sidecar.
 *
 * Walt's rule for local Baseline OS: "Bring Your Own Keys by default."
 * Local storage strategy:
 *   - Path: ~/.claude-os/credentials.local.json
 *   - Permissions: 0600 (owner read/write only) — set on every write.
 *   - Format: { providers: { <id>: { secrets: {...}, public_config: {...},
 *              status, mode, last_verified_at, last_error, updated_at } } }
 *   - We DO write plaintext on the local box (no shared-DB risk) but the
 *     file is explicitly named *.local.json + gitignored. The sidecar
 *     never returns raw secrets to the browser; it returns a masked
 *     preview only.
 *
 * If the operator wants OS-keychain-backed storage later, swap this module
 * for a keychain implementation — the public surface is intentionally
 * minimal so the sidecar contract doesn't have to change.
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CRED_DIR = join(homedir(), ".claude-os");
const CRED_FILE = join(CRED_DIR, "credentials.local.json");

type StoredRecord = {
  secrets: Record<string, string>;
  public_config: Record<string, string>;
  status: "pending" | "connected" | "error" | "revoked";
  mode: "bring_your_own_key" | "mission_control_credits" | "both";
  last_verified_at: number | null;
  last_error: string | null;
  updated_at: number;
};

type StoredShape = {
  version: 1;
  providers: Record<string, StoredRecord>;
};

function emptyStore(): StoredShape {
  return { version: 1, providers: {} };
}

function load(): StoredShape {
  if (!existsSync(CRED_FILE)) return emptyStore();
  try {
    const raw = readFileSync(CRED_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoredShape;
    if (parsed && parsed.version === 1 && parsed.providers) return parsed;
  } catch {
    // fall through to empty
  }
  return emptyStore();
}

function persist(shape: StoredShape): void {
  if (!existsSync(CRED_DIR)) {
    mkdirSync(CRED_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(CRED_FILE, JSON.stringify(shape, null, 2), { mode: 0o600 });
  // Re-apply 0600 in case the file already existed with looser perms.
  try { chmodSync(CRED_FILE, 0o600); } catch { /* noop */ }
}

function preview(secrets: Record<string, string>): string {
  for (const k of Object.keys(secrets)) {
    const v = secrets[k];
    if (typeof v === "string" && v.length > 0) {
      if (v.length <= 8) return "••••";
      return `${v.slice(0, 4)}…${v.slice(-4)}`;
    }
  }
  return "";
}

export type PublicCredentialView = {
  provider_id: string;
  status: StoredRecord["status"];
  mode: StoredRecord["mode"];
  secret_preview: string | null;
  public_config: Record<string, string>;
  last_verified_at: number | null;
  last_error: string | null;
  updated_at: number;
};

function toView(id: string, rec: StoredRecord): PublicCredentialView {
  return {
    provider_id: id,
    status: rec.status,
    mode: rec.mode,
    secret_preview: preview(rec.secrets) || null,
    public_config: rec.public_config,
    last_verified_at: rec.last_verified_at,
    last_error: rec.last_error,
    updated_at: rec.updated_at,
  };
}

export function listCredentialsLocal(): PublicCredentialView[] {
  const data = load();
  return Object.entries(data.providers).map(([id, rec]) => toView(id, rec));
}

export function getCredentialLocal(providerId: string): PublicCredentialView | null {
  const data = load();
  const rec = data.providers[providerId];
  return rec ? toView(providerId, rec) : null;
}

export function upsertCredentialLocal(args: {
  providerId: string;
  secrets: Record<string, string>;
  publicConfig?: Record<string, string>;
  mode?: StoredRecord["mode"];
}): PublicCredentialView {
  const data = load();
  const prev = data.providers[args.providerId];
  const next: StoredRecord = {
    secrets: { ...(prev?.secrets ?? {}), ...args.secrets },
    public_config: args.publicConfig ?? prev?.public_config ?? {},
    status: "pending",
    mode: args.mode ?? prev?.mode ?? "bring_your_own_key",
    last_verified_at: prev?.last_verified_at ?? null,
    last_error: null,
    updated_at: Math.floor(Date.now() / 1000),
  };
  data.providers[args.providerId] = next;
  persist(data);
  return toView(args.providerId, next);
}

export function deleteCredentialLocal(providerId: string): boolean {
  const data = load();
  if (!data.providers[providerId]) return false;
  delete data.providers[providerId];
  persist(data);
  return true;
}

/**
 * INTERNAL — returns the raw secret object for the runtime that needs to
 * make the actual API call. NEVER expose this through an HTTP endpoint.
 */
export function readSecretLocal(providerId: string): Record<string, string> | null {
  const data = load();
  const rec = data.providers[providerId];
  if (!rec) return null;
  return { ...rec.secrets };
}

export const CRED_FILE_PATH = CRED_FILE;
