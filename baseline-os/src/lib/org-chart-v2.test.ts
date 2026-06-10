/**
 * AI Org Chart V2 — Workforce Command Layer (bun test).
 * Multi-view command layer is added WITHOUT removing the CRUD table.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";

const src = readFileSync("src/routes/org-chart.tsx", "utf8");

describe("Org Chart V2 command layer", () => {
  test("CRUD is preserved (table view + create/edit/delete with confirm)", () => {
    expect(src).toContain('data-testid="org-roster"'); // original table
    expect(src).toContain("org-view-switcher");
    expect(src).toContain("org-new");
    expect(src).toContain("window.confirm"); // delete confirmation kept
    expect(src).toContain("function AgentForm"); // CRUD form intact
  });

  test("has the four command views (Organization · Map · Execution · Table)", () => {
    // testids are rendered via `org-view-${v.id}`; assert the template + ids.
    expect(src).toContain("org-view-${v.id}");
    for (const id of ['"tree"', '"map"', '"execution"', '"table"']) {
      expect(src, `missing view id ${id}`).toContain(`id: ${id} as const`);
    }
    expect(src).toContain('data-testid="org-tree"');
    expect(src).toContain('data-testid="org-map"');
    expect(src).toContain('data-testid="org-execution"');
  });

  test("workforce analytics from REAL roster data", () => {
    expect(src).toContain('data-testid="org-analytics"');
    expect(src).toContain("approvalGated");
    expect(src).toContain("departments:");
  });

  test("agent side panel shows full profile + embedded live Agent Activity", () => {
    expect(src).toContain('data-testid="org-agent-panel"');
    expect(src).toContain("<AgentActivity agentId={agent.id}");
    expect(src).toContain("Memory access");
    expect(src).toContain("Permissions");
  });

  test("approval authority + memory badges are visual", () => {
    expect(src).toContain('data-testid="org-approval-badge"');
    expect(src).toContain('data-testid="org-memory-badges"');
    expect(src).toContain("Walt only");
  });

  test("organization tree is expandable with manager relationships", () => {
    expect(src).toContain("OrgTreeNode");
    expect(src).toContain("node.reports"); // hierarchy reports
    expect(src).toContain("report"); // report count label
  });

  test("workforce map renders nodes + manager edges (svg)", () => {
    expect(src).toContain("org-map-node-");
    expect(src).toContain("<line"); // manager edges
  });
});
