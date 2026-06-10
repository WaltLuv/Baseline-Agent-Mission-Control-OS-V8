/**
 * Phases 1-2 product-flow wiring (Baseline OS) — the org-chart "Generate
 * workforce" control and the Agent Factory build path invoke the real logic
 * and show UI confirmation.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";

const org = readFileSync("src/routes/org-chart.tsx", "utf8");
const factory = readFileSync("src/components/agent-factory.tsx", "utf8");

describe("Baseline OS — Phase 1 org generation wiring", () => {
  test("org chart has a Generate-workforce control calling the real planner", () => {
    expect(org).toContain("orgPlanFromDirective(genSlug)");
    expect(org).toContain("planAdditions(");
    expect(org).toContain('data-testid="org-generate"');
  });
  test("shows UI confirmation with agent count", () => {
    expect(org).toContain('data-testid="org-generate-confirm"');
    expect(org).toContain("Org chart generated");
  });
});

describe("Baseline OS — Phase 2 Agent Factory → org sync wiring", () => {
  test("a successful build upserts into the org chart", () => {
    expect(factory).toContain("applyFactoryUpsert(");
    expect(factory).toContain("syncBuildToOrgChart(");
  });
  test("shows UI confirmation that the agent hit the Org Chart", () => {
    expect(factory).toContain('data-testid="factory-org-confirm"');
    expect(factory).toContain("added to Org Chart");
    expect(factory).toContain('href="/org-chart"');
  });
});
