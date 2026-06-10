/**
 * State integrity (Baseline OS) — durable persistence + anti-reset invariants.
 * Reproduces the production reset bug and proves it's fixed (bun test).
 */
import { test, expect, describe, beforeEach } from "bun:test";
import { readFileSync } from "node:fs";

// Minimal in-memory localStorage + window so the integrity layer runs headless.
function installStorage() {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: ls,
    dispatchEvent: () => true,
    StorageEvent: class {},
  };
  (globalThis as unknown as { StorageEvent: unknown }).StorageEvent = class {
    constructor(_t: string, _i: unknown) {}
  };
  return store;
}

let store: Map<string, string>;
beforeEach(() => {
  store = installStorage();
});

async function load() {
  // Fresh import each test run is unnecessary; the module is stateless except
  // its audit log, which we clear.
  const m = await import("./state-integrity");
  m.clearStateAuditLog();
  return m;
}

describe("state-integrity durable persistence", () => {
  test("write → re-read → verify; durableGet returns the stored value", async () => {
    const { durableSet, durableGet } = await load();
    const res = durableSet("k.avatar", "data:image/png;base64,AAAA");
    expect(res.ok).toBe(true);
    expect(res.verified).toBe(true);
    expect(durableGet("k.avatar")).toBe("data:image/png;base64,AAAA");
  });

  test("defaults do NOT overwrite existing user data (empty refused)", async () => {
    const { durableSet, durableGet } = await load();
    durableSet("k.name", "Walt");
    // Simulate the mount-time clobber: an empty write must be refused.
    const res = durableSet("k.name", "", { allowEmpty: false });
    expect(res.skipped).toBe("empty");
    expect(durableGet("k.name")).toBe("Walt"); // survived
  });

  test("explicit clear with allowEmpty removes the value", async () => {
    const { durableSet, durableGet } = await load();
    durableSet("k.avatar", "x");
    const res = durableSet("k.avatar", "", { allowEmpty: true });
    expect(res.ok).toBe(true);
    expect(durableGet("k.avatar")).toBe(null);
  });

  test("audit log records read/write/verify and the refused empty", async () => {
    const { durableSet, getStateAuditLog } = await load();
    durableSet("k.name", "Walt");
    durableSet("k.name", "");
    const kinds = getStateAuditLog().map((e) => e.kind);
    expect(kinds).toContain("write");
    expect(kinds).toContain("verify-ok");
    expect(kinds).toContain("skip-empty");
  });

  test("never throws when window is unavailable", async () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    const { durableSet, durableGet } = await load();
    expect(durableGet("k")).toBe(null);
    expect(durableSet("k", "v").ok).toBe(false);
  });
});

describe("setup wizard reset bug is fixed in source", () => {
  const src = readFileSync("src/routes/setup.tsx", "utf8");

  test("name effect is hydration-gated and does not removeItem on empty mount", () => {
    expect(src).toContain("nameHydrated");
    expect(src).toContain("if (!nameHydrated.current) return;");
    // the old raw removeItem(OPERATOR_NAME_KEY) clobber is gone
    expect(src).not.toContain("window.localStorage.removeItem(OPERATOR_NAME_KEY)");
    expect(src).toContain("durableSet(OPERATOR_NAME_KEY");
  });

  test("draft effect skips the initial mount", () => {
    expect(src).toContain("draftHydrated");
  });

  test("avatar save uses verified durableSet", () => {
    expect(src).toContain("durableSet(AVATAR_STORAGE_KEY");
  });
});
