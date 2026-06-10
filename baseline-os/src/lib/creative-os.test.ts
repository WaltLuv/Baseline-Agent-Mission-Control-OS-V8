/**
 * Creative OS (Baseline OS) — pipelines, sources, provider orchestration + wiring.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CREATIVE_PIPELINES,
  getPipeline,
  SOURCE_ACTIONS,
  PROVIDER_ORCHESTRATION,
  orchestrationFor,
  CREATIVE_OS_SECTIONS,
} from "./creative-os";

describe("Creative OS engine", () => {
  test("ships the 10 Higgsfield-style pipelines with stages/storyboard/proof/providers", () => {
    for (const id of [
      "product-commercial",
      "youtube-documentary",
      "youtube-shorts",
      "talking-head",
      "ai-influencer",
      "ugc-ad",
      "testimonial",
      "listing-video",
      "real-estate-walkthrough",
      "social-campaign",
    ]) {
      const p = getPipeline(id);
      expect(p, `missing pipeline ${id}`).toBeTruthy();
      expect(p!.stages.length).toBeGreaterThan(2);
      expect(p!.storyboard.length).toBeGreaterThan(1);
      expect(p!.proofRequirements.length).toBeGreaterThan(0);
      expect(p!.providerChain.length).toBeGreaterThan(0);
    }
    expect(CREATIVE_PIPELINES.length).toBe(10);
  });

  test("NotebookLM-style source actions exist (chat/summarize/storyboard/scene/voiceover/shot-list)", () => {
    for (const id of ["chat", "summarize", "storyboard", "scene-plan", "voiceover", "shot-list"]) {
      expect(SOURCE_ACTIONS.some((a) => a.id === id)).toBe(true);
    }
  });

  test("provider orchestration maps every creative intent + resolves a pipeline chain", () => {
    for (const intent of ["script", "image", "video", "avatar", "voice", "music", "render"]) {
      expect(PROVIDER_ORCHESTRATION.some((r) => r.intent === intent)).toBe(true);
    }
    const routes = orchestrationFor("youtube-documentary");
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((r) => r.provider && r.handoff)).toBe(true);
  });

  test("command-center sections defined", () => {
    for (const s of [
      "Workspace",
      "Sources",
      "Storyboard",
      "Timeline",
      "Agents",
      "Providers",
      "Replay",
      "Proofs",
    ]) {
      expect(CREATIVE_OS_SECTIONS).toContain(s as (typeof CREATIVE_OS_SECTIONS)[number]);
    }
  });
});

describe("Creative OS wired into the workspace", () => {
  const ws = readFileSync("src/components/video-studio-workspace.tsx", "utf8");
  test("pipeline picker + provider chain + sources panel surfaced", () => {
    expect(ws).toContain('data-testid="creative-os-pipelines"');
    expect(ws).toContain('data-testid="creative-os-providers"');
    expect(ws).toContain('data-testid="creative-os-sources"');
    expect(ws).toContain("CREATIVE_PIPELINES");
    expect(ws).toContain("orchestrationFor");
  });
});
