/**
 * Mansa Musa design system (Baseline OS ONLY) — visual layer.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { MANSA_MUSA, MANSA_PALETTE, MANSA_MOTIFS, mansaCssVars } from "./mansa-musa";

describe("Mansa Musa design tokens", () => {
  test("palette + motifs + gold accent + OS-only scope", () => {
    expect(MANSA_PALETTE.gold).toMatch(/^#/);
    expect(MANSA_MOTIFS).toContain("sankore-arch");
    expect(MANSA_MOTIFS).toContain("knowledge-network");
    expect(MANSA_MUSA.scope).toBe("baseline-os-only");
    expect(mansaCssVars()["--mm-gold"]).toBe(MANSA_PALETTE.gold);
  });
});

describe("Mansa Musa is a visual layer only (no functional change)", () => {
  const motif = readFileSync("src/components/mansa-musa-motif.tsx", "utf8");
  const hero = readFileSync("src/components/workforce-os-hero.tsx", "utf8");
  test("motifs are decorative SVG (aria-hidden, no handlers)", () => {
    expect(motif).toContain("aria-hidden");
    expect(motif).not.toMatch(/onClick|useState|fetch\(/);
  });
  test("applied as an accent on the home hero", () => {
    expect(hero).toContain('data-testid="mansa-musa-accent"');
    expect(hero).toContain("SankoreArch");
    expect(hero).toContain("GoldRule");
  });
});

import { test as v2t, expect as v2e, describe as v2d } from "bun:test";
import { readFileSync as v2read } from "node:fs";
import { MANSA_V2, mansaSurfaceStyle } from "./mansa-musa";

v2d("Mansa Musa V2 (HUD foundation)", () => {
  v2t("V2 tokens: carbon glass, HUD cyan, regal violet, per-surface tones", () => {
    v2e(MANSA_V2.hudCyan).toMatch(/^#/);
    v2e(MANSA_V2.regalViolet).toMatch(/^#/);
    v2e(MANSA_V2.surfaceTone.flightDeck).toBeDefined();
    v2e(MANSA_V2.surfaceTone.graphify).toBeDefined();
  });
  v2t("mansaSurfaceStyle is a glass treatment (border + blur + glow), no behavior", () => {
    const s = mansaSurfaceStyle(MANSA_V2.hudCyan) as Record<string, unknown>;
    v2e(String(s.backdropFilter)).toContain("blur");
    v2e(String(s.boxShadow)).toContain("rgba");
  });
  v2t("surface primitives are decorative wrappers (no handlers/state)", () => {
    const s = v2read("src/components/mansa-surface.tsx", "utf8");
    v2e(s).toContain("MansaSurface");
    v2e(s).toContain("MansaHeader");
    v2e(s).not.toMatch(/onClick|useState|fetch\(/);
  });
  v2t("applied to Graphify (flagship) — visual only", () => {
    const g = v2read("src/routes/graphify.tsx", "utf8");
    v2e(g).toContain("MansaHeader");
    v2e(g).toContain("MANSA_V2.surfaceTone.graphify");
  });
});
