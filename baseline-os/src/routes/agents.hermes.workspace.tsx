import { createFileRoute } from "@tanstack/react-router";
import { HermesWorkspaceView } from "@/components/hermes-control-room";

export const Route = createFileRoute("/agents/hermes/workspace")({
  head: () => ({
    meta: [
      { title: "Hermes Workspace — Baseline Automations" },
      { name: "description", content: "Typed buckets where Hermes drops outputs. Preview videos, audio, images, PDFs, HTML, text." },
    ],
  }),
  component: HermesWorkspaceView,
});
