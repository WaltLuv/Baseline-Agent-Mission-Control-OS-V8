/**
 * Production Unlock Center (Baseline OS) — data + wiring tests (bun test).
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { UNLOCK_ITEMS, unlockItemsByImpact, getUnlockItem } from "./production-unlock";

describe("Baseline OS Production Unlock Center", () => {
  test("covers the core production integrations", () => {
    for (const id of [
      "claude_code",
      "elevenlabs",
      "realtime_voice",
      "openrouter",
      "notebooklm",
      "obsidian",
      "notion",
      "pinecone",
      "higgsfield",
      "github",
      "telegram",
      "stripe",
      "vercel",
      "ollama",
    ]) {
      expect(getUnlockItem(id)).toBeTruthy();
    }
  });

  test("every item has env vars, features, impact, where-used, and setup instructions", () => {
    for (const u of UNLOCK_ITEMS) {
      expect(["critical", "high", "medium", "low"]).toContain(u.impact);
      expect(u.requiredEnvVars.length).toBeGreaterThan(0);
      expect(u.featuresUnlocked.length).toBeGreaterThan(0);
      expect(u.whereUsed.length).toBeGreaterThan(0);
      expect(u.setupInstructions.length).toBeGreaterThan(0);
    }
  });

  test("Agent Factory primary = Claude Code; Ollama is an optional fallback", () => {
    expect(getUnlockItem("claude_code")!.impact).toBe("critical");
    const ollama = getUnlockItem("ollama")!;
    expect(ollama.impact).toBe("low");
    expect(ollama.setupInstructions.toLowerCase()).toMatch(/optional fallback/);
  });

  test("sorted critical → low", () => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    const ranks = unlockItemsByImpact().map((u) => order[u.impact]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  test("route exists and is nav-visible; status is probed (no fake-ready)", () => {
    const route = readFileSync("src/routes/production-unlock.tsx", "utf8");
    expect(route).toContain('createFileRoute("/production-unlock")');
    expect(route).toContain("/__os_config"); // probes real local config
    expect(route).toContain("Setup needed");

    const nav = readFileSync("src/components/app-sidebar.tsx", "utf8");
    expect(nav).toContain('to: "/production-unlock"');
  });
});
