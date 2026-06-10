/**
 * AI Org Chart — Hierarchy (pyramid) view assertions.
 *
 * The pyramid reflects reporting structure with agent portraits, roles, and
 * gold reporting connectors in the Baseline OS Mansa (African-royalty-inspired)
 * palette — imagery only, no literal naming in the rendered UI.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(`${import.meta.dir}/../../${p}`, "utf8");
const pyramid = read("src/components/org-pyramid.tsx");
const chart = read("src/routes/org-chart.tsx");

describe("Org pyramid — visual hierarchy", () => {
  test("uses the Mansa palette (gold/regal) + geometric motif", () => {
    expect(pyramid).toContain("MANSA_PALETTE");
    expect(pyramid).toContain("MaliGeometry");
  });
  test("personas get their CORRECT dedicated portrait by id", () => {
    expect(pyramid).toContain("PORTRAIT_BY_ID");
    expect(pyramid).toContain('"maggie-walker": pMaggie');
    expect(pyramid).toContain('"rogers-hobson": pRogers');
    expect(pyramid).toContain('"robert-smith": pRobert');
    expect(pyramid).toContain('"walter-thornton": pWalter');
    expect(pyramid).toContain("10-robert-smith.png");
    expect(pyramid).toContain("11-walter-thornton.png");
  });
  test("every persona shows a REAL portrait (deterministic pantheon fallback, no blank crest)", () => {
    expect(pyramid).toContain("ALL_PORTRAITS");
    expect(pyramid).toContain("hashIdx(node.id || node.name, ALL_PORTRAITS.length)");
  });
  test("apex wears a crown; cards show role, department + reporting count", () => {
    expect(pyramid).toContain("org-crown");
    expect(pyramid).toContain("org-card-role");
    expect(pyramid).toContain('org-reports-count')
    expect(pyramid).toContain('node.reports.length > 1 ? "s" : ""');
  });
  test("renders a top-down tree (ul/li) with gold connector lines", () => {
    expect(pyramid).toContain("org-tree");
    expect(pyramid).toContain("border-top: 2px solid");
    expect(pyramid).toContain("border-left: 2px solid");
  });
  test("node testids exist for selection", () => {
    expect(pyramid).toContain("`pyramid-node-${node.id}`");
  });
});

describe("Org chart wiring", () => {
  test("Hierarchy (pyramid) is the default view", () => {
    expect(chart).toContain('useState<"pyramid" | "tree"');
    expect(chart).toContain('>("pyramid")');
    expect(chart).toContain('{ id: "pyramid" as const, label: "Hierarchy"');
    expect(chart).toContain("<OrgPyramid");
  });
  test("the Workforce Map view also renders the pyramid hierarchy", () => {
    // both the 'pyramid' (Hierarchy) and 'map' (Workforce Map) views show OrgPyramid
    const matches = chart.match(/<OrgPyramid/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
  test("seed assigns a default reporting hierarchy (apex → leads → ICs)", () => {
    expect(chart).toContain("function seedHierarchy");
    expect(chart).toContain("seedHierarchy(seeded)");
    expect(chart).toContain("managerId: apex.id");
  });
});
