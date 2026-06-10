import { createFileRoute } from "@tanstack/react-router";
import { HermesGoalView } from "@/components/hermes-control-room";

export const Route = createFileRoute("/agents/hermes/goal")({
  head: () => ({
    meta: [
      { title: "Hermes Goal Mode — Baseline Automations" },
      { name: "description", content: "Autonomous long-runs. Drop one goal, watch Hermes run end-to-end." },
    ],
  }),
  component: HermesGoalView,
});
