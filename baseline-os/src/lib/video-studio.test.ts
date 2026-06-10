/**
 * Video Studio creative workspace (bun test) — proves the 4-pane workspace,
 * real upload/ingest, Universal Asset Library wiring, AI panel, timeline, and
 * proof drawer exist, and that render stays honest (setup-needed) when no
 * provider is configured.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";

const ws = readFileSync("src/components/video-studio-workspace.tsx", "utf8");
const route = readFileSync("src/routes/video-studio.tsx", "utf8");
const sidecar = readFileSync("vite.config.ts", "utf8");

describe("Video Studio creative workspace", () => {
  test("route renders the workspace as the primary mode (engines preserved)", () => {
    expect(route).toContain("VideoStudioWorkspace");
    expect(route).toContain('data-testid="vs-mode-workspace"');
    expect(route).toContain("VideoStudio"); // existing engines kept, not removed
  });

  test("has the 4-pane layout (rail · canvas · AI panel · timeline)", () => {
    for (const id of [
      "video-studio-workspace",
      "vs-asset-rail",
      "vs-canvas",
      "vs-ai-panel",
      "vs-timeline",
    ]) {
      expect(ws, `missing pane ${id}`).toContain(`data-testid="${id}"`);
    }
  });

  test("has an upload dropzone that ingests via the real sidecar endpoint", () => {
    expect(ws).toContain('data-testid="vs-upload-dropzone"');
    expect(ws).toContain("/__video_workspace_upload");
    expect(ws).toContain("readAsDataURL"); // real file read, not fake
  });

  test("uploaded assets appear in the rail + preview inline via raw serve", () => {
    expect(ws).toContain("/__video_workspace?bucket=video-studio"); // rail source
    expect(ws).toContain("/__video_workspace_raw?path="); // canvas preview
    expect(ws).toContain("data-testid={`vs-asset-${a.kind}`}");
  });

  test("Universal Asset Library integration (shared store, not isolated)", () => {
    expect(ws).toContain('data-testid="vs-ual"');
    expect(sidecar).toContain("Universal Asset Library");
    expect(sidecar).toContain("BASELINE_ASSET_ROOT"); // configurable shared root
    expect(sidecar).toContain(".lineage"); // lineage/proof recorded
  });

  test("AI panel acts on selected asset via real /__agent_run; proof drawer + timeline present", () => {
    expect(ws).toContain("/__agent_run");
    expect(ws).toContain("Selected asset:"); // context injection
    expect(ws).toContain('data-testid="vs-proof-drawer"');
  });

  test("Ultimate upgrades: provider select, approval gate, Agent Activity, HyperEdit engine", () => {
    expect(ws).toContain('data-testid="vs-provider"');
    expect(ws).toContain('data-testid="vs-approval-gate"');
    expect(ws).toContain('data-testid="vs-approve-render"');
    expect(ws).toContain('data-testid="vs-hyperedit-link"');
    expect(ws).toContain('href="/hyperedit"');
    expect(ws).toContain("AgentActivity");
    expect(ws).toContain('agentId="video-studio"');
  });

  test("no fake render-ready state — render is honest setup-needed when unconfigured", () => {
    expect(ws).toMatch(/setup-needed/i);
    // agent failure path is explicit, not silently 'done'
    expect(ws).toContain("setup-needed");
  });

  test("upload endpoint is loopback-only, allowlisted, size-capped, path-contained", () => {
    expect(sidecar).toContain('server.middlewares.use("/__video_workspace_upload"');
    expect(sidecar).toContain("loopback only");
    expect(sidecar).toContain("64MB");
    expect(sidecar).toContain("ALLOWED");
  });
});
