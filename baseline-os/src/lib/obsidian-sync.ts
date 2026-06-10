// Utility module for syncing content to your Obsidian vault via the
// /__obsidian_write and /__os_config Vite middleware endpoints.
// All calls are loopback-only — data never leaves your machine.

export interface ObsidianWriteResult {
  ok: boolean;
  error?: string;
  vaultPath?: string;
}

/**
 * Write `content` to `relativePath` inside your configured Obsidian vault.
 * The server creates parent directories as needed.
 *
 * Example:
 *   await writeToVault("Journal/2026-05-24.md", "# Today\n...");
 */
export async function writeToVault(
  relativePath: string,
  content: string,
): Promise<ObsidianWriteResult> {
  try {
    const res = await fetch("/__obsidian_write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relativePath, content }),
    });
    const data = await res.json();
    return data as ObsidianWriteResult;
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Network error" };
  }
}

/**
 * Retrieve the configured vault path from ~/.claude-os/config.json.
 * Returns null if no vault is configured.
 */
export async function getVaultPath(): Promise<string | null> {
  try {
    const res = await fetch("/__os_config");
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.obsidianVaultPath as string) ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns the date formatted as "YYYY-MM-DD" (e.g. "2026-05-24"). */
export function dateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns the date formatted for display, e.g. "Sunday, May 24". */
export function displayDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Returns the year-month key, e.g. "2026-05". */
export function monthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
