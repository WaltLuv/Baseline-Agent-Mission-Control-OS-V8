import { createFileRoute, Link } from "@tanstack/react-router";
import { VideoAgentStudio } from "@/components/video-agent-studio";

export const Route = createFileRoute("/agents/hermes/studio")({
  head: () => ({ meta: [{ title: "Hermes Studio — Baseline Automations" }] }),
  component: () => (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <div className="px-5 py-2 border-b shrink-0 flex items-center gap-2" style={{ borderColor: "var(--panel-border)" }}>
        <Link to="/agents/hermes" className="text-[10.5px] uppercase tracking-[0.22em] hover:underline">← Hermes</Link>
        <Link to="/agents/hermes/workspace" className="text-[10.5px] uppercase tracking-[0.22em] opacity-70 hover:opacity-100">Workspace</Link>
        <Link to="/agents/hermes/goal" className="text-[10.5px] uppercase tracking-[0.22em] opacity-70 hover:opacity-100">Goal Mode</Link>
        <Link to="/agents/hermes/control" className="text-[10.5px] uppercase tracking-[0.22em] opacity-70 hover:opacity-100">MCP</Link>
        <span className="text-[10.5px] uppercase tracking-[0.22em] ml-1" style={{ color: "#FFD21E" }}>· Studio</span>
      </div>
      <div className="flex-1 min-h-0"><VideoAgentStudio agentId="hermes" brand="Hermes" tone="#FFD21E" /></div>
    </div>
  ),
});
