/**
 * Hermes Enterprise Operator (Baseline OS) — registries, approval engine,
 * 6-system integration + tab wiring.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import {
  buildOperatorView,
  defaultRegistries,
  resolveApproval,
  HERMES_CAPABILITIES,
} from "./hermes-enterprise";

describe("Hermes Enterprise engine", () => {
  test("operator view organizes tools/skills/providers/runtimes + honest counts", () => {
    const v = buildOperatorView({
      ...defaultRegistries(),
      mcpOnline: true,
      runtimes: [
        { id: "h", name: "Hermes", state: "connected", health: "healthy", permissions: ["fs"] },
        { id: "x", name: "X", state: "setup_needed", health: "down", permissions: [] },
      ],
      approvals: [{ ts: 1, action: "deploy", decision: "pending" }],
    });
    expect(v.counts.tools).toBeGreaterThan(0);
    expect(v.counts.runtimes).toBe(2);
    expect(v.counts.healthyRuntimes).toBe(1);
    expect(v.counts.pendingApprovals).toBe(1);
    expect(v.mcp.online).toBe(true);
  });

  test("nothing is fabricated: default tools/providers are setup_needed until connected", () => {
    const v = buildOperatorView(defaultRegistries());
    expect(v.tools.find((t) => t.id === "graphify")?.state).toBe("connected"); // internal
    expect(v.tools.find((t) => t.id === "github")?.state).toBe("setup_needed"); // needs creds
    expect(v.providers.every((p) => p.state === "setup_needed")).toBe(true);
  });

  test("approval engine resolves a pending approval", () => {
    const out = resolveApproval(
      [{ ts: 1, action: "deploy", decision: "pending" }],
      0,
      "approved",
      "walt",
      99,
    );
    expect(out[0].decision).toBe("approved");
    expect(out[0].by).toBe("walt");
  });

  test("declares all nine enterprise-operator capabilities", () => {
    for (const c of [
      "MCP status",
      "Tools",
      "Skills",
      "Providers",
      "Execution log",
      "Approval log",
      "Replay",
      "Graphify",
      "Proof",
    ]) {
      expect(HERMES_CAPABILITIES).toContain(c as (typeof HERMES_CAPABILITIES)[number]);
    }
  });
});

describe("Hermes Enterprise tab wired into the Hermes page", () => {
  const src = readFileSync("src/routes/agents.hermes.tsx", "utf8");
  test("Operator tab shows registries + logs + Agent Activity (graph/replay/proof)", () => {
    // enterprise-tab/approvals/execlog use a literal data-testid; the registry
    // cards are rendered by a <Reg testid="…"/> subcomponent (data-testid={testid}).
    for (const t of ["hermes-enterprise-tab", "hermes-approvals", "hermes-execlog"]) {
      expect(src, `missing ${t}`).toContain(`data-testid="${t}"`);
    }
    for (const t of ["hermes-mcp-status", "hermes-tools", "hermes-skills", "hermes-providers", "hermes-runtimes"]) {
      expect(src, `missing ${t}`).toContain(`testid="${t}"`);
    }
    expect(src).toContain('agentId="hermes"');
    expect(src).toContain("/__hermes_status"); // live probe, not fake
  });
});
