/**
 * Graphify structural brain (bun test) — pure graph engine + wiring.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import {
  buildGraph,
  queryGraph,
  getDependencies,
  godNodes,
  graphHealth,
  isStale,
  classify,
  isExcluded,
  type FileInput,
} from "./graph";

const files: FileInput[] = [
  { path: "src/lib/auth.ts", imports: [] },
  { path: "src/routes/login.tsx", imports: ["src/lib/auth.ts"] },
  { path: "src/routes/dashboard.tsx", imports: ["src/lib/auth.ts", "src/components/card.tsx"] },
  { path: "src/components/card.tsx", imports: [] },
  { path: "src/app/api/users/route.ts", imports: ["src/lib/auth.ts"] },
];

describe("Graphify graph engine", () => {
  test("buildGraph is deterministic + maps nodes/edges", () => {
    const g = buildGraph(files, 1000, "hash1");
    expect(g.nodes.length).toBe(5);
    expect(g.edges.length).toBe(4); // 3 → auth, 1 → card
    const g2 = buildGraph(files, 1000, "hash1");
    expect(g2.edges).toEqual(g.edges);
  });

  test("classify identifies routes, apis, components, libs", () => {
    expect(classify("src/routes/login.tsx")).toBe("route");
    expect(classify("src/app/api/users/route.ts")).toBe("api");
    expect(classify("src/components/card.tsx")).toBe("component");
    expect(classify("src/lib/auth.ts")).toBe("lib");
  });

  test("queryGraph locates files before a repo scan", () => {
    const g = buildGraph(files, 1, "h");
    const r = queryGraph(g, "where is auth?");
    expect(r.some((n) => n.path === "src/lib/auth.ts")).toBe(true);
  });

  test("dependencies: imports + importedBy", () => {
    const g = buildGraph(files, 1, "h");
    const d = getDependencies(g, "src/lib/auth.ts");
    expect(d.importedBy.length).toBe(3); // login, dashboard, users api
    expect(d.imports.length).toBe(0);
  });

  test("god nodes = most-depended-on (auth)", () => {
    const g = buildGraph(files, 1, "h");
    const gods = godNodes(g);
    expect(gods[0].node.path).toBe("src/lib/auth.ts");
    expect(gods[0].inDegree).toBe(3);
  });

  test("health + staleness (cheap, no rebuild)", () => {
    const g = buildGraph(files, 1, "h1");
    expect(graphHealth(g).nodes).toBe(5);
    expect(isStale(g, "h1")).toBe(false);
    expect(isStale(g, "h2")).toBe(true);
  });

  test("secrets are excluded from ingestion", () => {
    expect(isExcluded("src/.env")).toBe(true);
    expect(isExcluded("node_modules/x")).toBe(true);
    expect(isExcluded("config/api.key")).toBe(true);
    expect(isExcluded("src/lib/auth.ts")).toBe(false);
  });
});

describe("Graphify wiring (route + sidecar + CLAUDE.md graph-first rule)", () => {
  const route = readFileSync("src/routes/graphify.tsx", "utf8");
  const vite = readFileSync("vite.config.ts", "utf8");
  const claudemd = readFileSync("CLAUDE.md", "utf8");
  const nav = readFileSync("src/components/app-sidebar.tsx", "utf8");

  test("route has dashboard, query, explorer, dependency viewer, import", () => {
    for (const t of [
      "graphify-dashboard",
      "graphify-query",
      "graphify-explorer",
      "graphify-deps",
      "graphify-import",
      "graphify-godnodes",
    ]) {
      expect(route, `missing ${t}`).toContain(`data-testid="${t}"`);
    }
  });
  test("sidecar exposes /__graphify (build + query, secrets excluded)", () => {
    expect(vite).toContain('"/__graphify"');
    expect(vite).toContain("graphify-out");
    expect(vite).toContain("isSecret");
  });
  test("nav-visible + CLAUDE.md graph-first rule present", () => {
    expect(nav).toContain('to: "/graphify"');
    expect(claudemd).toContain("Graph-first rule");
    expect(claudemd).toContain("/__graphify?q=");
  });
});

import { test as cloneTest, expect as cloneExpect, describe as cloneDescribe } from "bun:test";
import { readFileSync as cloneRead } from "node:fs";

cloneDescribe("Graphify remote-repo runner (#6)", () => {
  const vite = cloneRead("vite.config.ts", "utf8");
  const route = cloneRead("src/routes/graphify.tsx", "utf8");
  cloneTest("sidecar clones https-only, host-allowlisted, sandboxed, secrets excluded", () => {
    cloneExpect(vite).toContain('"/__graphify_clone"');
    cloneExpect(vite).toContain("ALLOWED_HOSTS");
    cloneExpect(vite).toContain('"https:"');
    cloneExpect(vite).toContain('"--depth", "1"');
    cloneExpect(vite).toContain("mkdtemp");
    cloneExpect(vite).toContain("rm(dir"); // cleanup
    cloneExpect(vite).toContain("isSecret");
  });
  cloneTest("UI wires the repo-import input to the clone runner", () => {
    cloneExpect(route).toContain("/__graphify_clone");
    cloneExpect(route).toContain('data-testid="graphify-import-run"');
    cloneExpect(route).toContain("cloneRepo");
  });
});
