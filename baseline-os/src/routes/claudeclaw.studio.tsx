import { createFileRoute, Link } from "@tanstack/react-router";
import { VideoAgentStudio } from "@/components/video-agent-studio";

export const Route = createFileRoute("/claudeclaw/studio")({
  head: () => ({ meta: [{ title: "ClaudeClaw Studio — Baseline Automations" }] }),
  component: () => (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <div className="px-5 py-2 border-b shrink-0" style={{ borderColor: "var(--panel-border)" }}>
        <Link to="/claudeclaw" className="text-[10.5px] uppercase tracking-[0.22em] hover:underline">← ClaudeClaw</Link>
      </div>
      <div className="flex-1 min-h-0"><VideoAgentStudio agentId="claudeclaw" brand="ClaudeClaw" tone="#D97757" /></div>
    </div>
  ),
});
