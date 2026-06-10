import { createFileRoute } from "@tanstack/react-router";
import { HermesMcpView } from "@/components/hermes-control-room";

export const Route = createFileRoute("/agents/hermes/control")({
  head: () => ({
    meta: [
      { title: "Hermes MCP Control Room — Baseline Automations" },
      { name: "description", content: "Manage Hermes' MCP servers — list, add, remove, test, login." },
    ],
  }),
  component: HermesMcpView,
});
