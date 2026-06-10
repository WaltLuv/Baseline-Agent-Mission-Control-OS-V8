import { createFileRoute, Link } from "@tanstack/react-router";
import { VideoAgentStudio } from "@/components/video-agent-studio";

export const Route = createFileRoute("/agents/openclaw/studio")({
  head: () => ({ meta: [{ title: "OpenClaw Studio — Baseline Automations" }] }),
  component: () => (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <div className="px-5 py-2 border-b shrink-0" style={{ borderColor: "var(--panel-border)" }}>
        <Link to="/agents/openclaw" className="text-[10.5px] uppercase tracking-[0.22em] hover:underline">← OpenClaw</Link>
      </div>
      <div className="flex-1 min-h-0"><VideoAgentStudio agentId="openclaw" brand="OpenClaw" tone="#EF4444" /></div>
    </div>
  ),
});
