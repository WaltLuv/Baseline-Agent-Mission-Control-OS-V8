/**
 * Graphify runtime brain (Phase 4.5) — PI-Agent context injection + wiring.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { buildGraph, type FileInput } from "./graph";
import { buildGraphContext } from "./context";

const files: FileInput[] = [
  { path: "src/lib/auth.ts", imports: [] },
  { path: "src/routes/login.tsx", imports: ["src/lib/auth.ts"] },
  { path: "src/routes/dashboard.tsx", imports: ["src/lib/auth.ts"] },
];
const graph = buildGraph(files, 1, "h");

describe("PI Agent → Graphify context injection", () => {
  test("locates files + dependencies + confidence + a prompt block for a task", () => {
    const ctx = buildGraphContext(graph, "fix the auth login flow");
    expect(ctx.files).toContain("src/lib/auth.ts");
    expect(ctx.confidence).toBeGreaterThan(0);
    expect(ctx.promptBlock).toContain("Graphify");
    expect(ctx.promptBlock).toContain("src/lib/auth.ts");
    // dependency awareness: auth is imported-by login/dashboard
    const authDep = ctx.dependencies.find((d) => d.file === "src/lib/auth.ts");
    expect(authDep?.importedBy.length ?? 0).toBeGreaterThan(0);
  });

  test("emits replay events (graph query → files located) — shared-brain trail", () => {
    const ctx = buildGraphContext(graph, "auth", 1000);
    expect(
      ctx.replayEvents.some((e) => e.kind === "tool_call" && /Graphify query/.test(e.label)),
    ).toBe(true);
    expect(ctx.replayEvents.some((e) => e.kind === "file_touched")).toBe(true);
    expect(ctx.replayEvents[0].agent).toBe("PI Agent");
  });

  test("empty graph / empty task → zero confidence, no injection (honest)", () => {
    expect(buildGraphContext(null, "x").confidence).toBe(0);
    expect(buildGraphContext(graph, "").promptBlock).toBe("");
    expect(buildGraphContext(graph, "zzqqxx-nomatch").nodes.length).toBe(0);
  });
});

describe("Runtime wiring — graph-first injection + structural-awareness panel", () => {
  const vite = readFileSync("vite.config.ts", "utf8");
  const activity = readFileSync("src/components/agent-activity.tsx", "utf8");

  test("/__agent_run injects the located graph slice before the agent runs", () => {
    expect(vite).toContain("Graphify runtime brain");
    expect(vite).toContain("graphify-out");
    expect(vite).toContain("parsed.messages = [");
    expect(vite).toContain("send({ graph: graphCtx })");
  });

  test("Agent Activity shows a Structural Awareness panel", () => {
    expect(activity).toContain('testid="aa-structural"');
    expect(activity).toContain("Graphify");
    expect(activity).toContain("/__graphify");
  });
});
