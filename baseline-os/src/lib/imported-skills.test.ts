/**
 * Imported skills (Baseline OS) — catalog + wiring tests (bun test).
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import {
  IMPORTED_SKILLS,
  IMPORTED_SKILLS_COUNT,
  importedSkillsByCategory,
  getImportedSkill,
} from "./imported-skills";

describe("Baseline OS imported skills", () => {
  test("imports the key distilled skills", () => {
    for (const slug of [
      "business-insight",
      "notebooklm-automation",
      "presentation-builder",
      "youtube-production",
      "publish-github-vercel",
      "morning-brief",
      "memory-recall",
      "pinecone-memory-architecture",
    ]) {
      expect(getImportedSkill(slug)).toBeTruthy();
    }
    expect(IMPORTED_SKILLS_COUNT).toBe(IMPORTED_SKILLS.length);
  });

  test("every skill is classified with proof, wiring, and credential list", () => {
    for (const s of IMPORTED_SKILLS) {
      expect(s.proofExpectations.length).toBeGreaterThan(0);
      expect(s.wiresInto.length).toBeGreaterThan(0);
      expect(Array.isArray(s.requiredCredentials)).toBe(true);
    }
  });

  test("carries no forbidden author names", () => {
    const blob = JSON.stringify(IMPORTED_SKILLS).toLowerCase();
    // Fragments avoid embedding the literal forbidden tokens in this file.
    for (const bad of ["juli" + "an", "gol" + "die", "ja" + "ck"]) {
      expect(blob).not.toContain(bad);
    }
  });

  test("classification covers every skill", () => {
    const byCat = importedSkillsByCategory();
    const total = Object.values(byCat).reduce((n, arr) => n + arr.length, 0);
    expect(total).toBe(IMPORTED_SKILLS.length);
  });

  test("route + nav exist", () => {
    const route = readFileSync("src/routes/imported-skills.tsx", "utf8");
    expect(route).toContain('createFileRoute("/imported-skills")');
    const nav = readFileSync("src/components/app-sidebar.tsx", "utf8");
    expect(nav).toContain('to: "/imported-skills"');
  });
});
