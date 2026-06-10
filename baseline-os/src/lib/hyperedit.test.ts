/**
 * HyperEdit regression guard (bun test).
 *
 * Root cause of the "everything was removed / can't use it" report: the page
 * defaulted the embedded editor to port 5173 — which is Baseline OS itself —
 * so it iframed the dashboard into itself and the cross-origin status probe
 * always CORS-failed to "offline". Nothing was deleted from the file (git: it
 * only grew, 146→238 lines, last touched e143cfc on 2026-06-05). These tests
 * lock in the fix: editor port is OFF 5173 and status is probed server-side.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";

const page = readFileSync("src/routes/hyperedit.tsx", "utf8");
const sidecar = readFileSync("vite.config.ts", "utf8");

describe("HyperEdit page", () => {
  test("route is registered", () => {
    expect(page).toContain('createFileRoute("/hyperedit")');
  });

  test("does NOT default the embedded editor to Baseline OS's own port (5173)", () => {
    expect(page).toContain("const DEFAULT_PORT = 5174");
    expect(page).not.toContain("const DEFAULT_PORT = 5173");
  });

  test("editor status is probed server-side via the sidecar (no CORS false-offline)", () => {
    expect(page).toContain("/__hyperedit_status");
    // the old cross-origin direct probe that always CORS-failed is gone
    expect(page).not.toContain("fetch(`http://localhost:${port}/`");
  });

  test("retains the full control surface (no stripped shell)", () => {
    for (const marker of [
      "Component drafter", // AI Remotion composition drafter
      "__hyperedit_ffmpeg_start", // FFmpeg auto-start control
      "ffmpeg server down", // honest provider/runtime status
      "<iframe", // live editor embed
      "Start the editor", // setup card when offline
      "Render button to export MP4", // workflow/proof steps
      "github.com/WaltLuv/hyperedit", // repo link
      "RuntimeCredentialStatus", // provider/runtime status
    ]) {
      expect(page, `missing HyperEdit section: ${marker}`).toContain(marker);
    }
  });

  test("sidecar probes the editor on 5174+ (never 5173) and reports the port", () => {
    expect(sidecar).toContain("__hyperedit_status");
    expect(sidecar).toContain("HYPEREDIT_PORT");
    expect(sidecar).toContain("[5174, 5175, 5176, 5177, 5178]");
    expect(sidecar).toContain("ports: { editor:");
  });
});
