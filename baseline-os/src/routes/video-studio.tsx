/**
 * Video Studio — creative production workspace.
 *
 * Primary mode is the 4-pane creative workspace (upload → preview → AI →
 * timeline → proof). The original Create (HyperFrames CLI render) + Avatar
 * (HeyGen) + render gallery are preserved under the "Studio engines" mode so
 * no functionality was removed.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { VideoStudio } from "@/components/video-studio";
import { VideoStudioWorkspace } from "@/components/video-studio-workspace";

export const Route = createFileRoute("/video-studio")({
  head: () => ({
    meta: [
      { title: "Video Studio — Baseline Automations" },
      {
        name: "description",
        content:
          "Creative production workspace — upload, preview, AI storyboard/script, HyperFrames + AI avatars, proof package.",
      },
    ],
  }),
  component: VideoStudioPage,
});

function VideoStudioPage() {
  const [mode, setMode] = useState<"workspace" | "engines">("workspace");
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      <div className="flex items-center gap-1 border-b border-white/10 px-4 py-1.5">
        <button
          onClick={() => setMode("workspace")}
          data-testid="vs-mode-workspace"
          className="rounded-md px-3 py-1 text-[11px] font-semibold"
          style={{
            background: mode === "workspace" ? "rgba(253,224,71,0.18)" : "transparent",
            color: mode === "workspace" ? "#fde047" : "rgba(255,255,255,0.5)",
          }}
        >
          Creative Workspace
        </button>
        <button
          onClick={() => setMode("engines")}
          data-testid="vs-mode-engines"
          className="rounded-md px-3 py-1 text-[11px] font-semibold"
          style={{
            background: mode === "engines" ? "rgba(253,224,71,0.18)" : "transparent",
            color: mode === "engines" ? "#fde047" : "rgba(255,255,255,0.5)",
          }}
        >
          Studio engines (HyperFrames · Avatar · Gallery)
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {mode === "workspace" ? <VideoStudioWorkspace /> : <VideoStudio />}
      </div>
    </div>
  );
}
