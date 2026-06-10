/**
 * WACRM — WhatsApp CRM operated by OpenClaw or Hermes.
 *
 * The actual WACRM is a separate Next.js app (Supabase + WhatsApp Business
 * API). This page is the dashboard's control panel for it:
 *   - Pick which agent operates the CRM (OpenClaw default, Hermes alt)
 *   - Quick-task composer routed to the chosen agent
 *   - Status probe of the local WACRM dev server on :3000
 *   - Contacts panel reading from ~/.claude-os/wacrm/contacts.json
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, Box, Cpu, ExternalLink, RefreshCw, Sparkles, Users, Send, Workflow, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/wacrm")({
  head: () => ({
    meta: [
      { title: "WACRM — Baseline Automations" },
      { name: "description", content: "WhatsApp CRM, operated by OpenClaw or Hermes." },
    ],
  }),
  component: WACRMPage,
});

const TONE = "#25D366"; // WhatsApp green

const AGENTS = [
  { id: "openclaw" as const, label: "OpenClaw", desc: "Multi-channel native — preferred for outbound", icon: <Box size={14} style={{ color: "#EF4444" }} /> },
  { id: "hermes-mcp" as const, label: "Hermes", desc: "Long-running pipelines — preferred for nurture", icon: <Cpu size={14} style={{ color: "#06B6D4" }} /> },
];

const QUICK_TASKS = [
  "Triage today's WhatsApp inbox and tag urgent threads",
  "Build a broadcast template for our Q3 product launch",
  "Move deals stuck in Discovery > 7 days to a re-engagement automation",
  "Summarize this week's conversation activity by sales rep",
];

function WACRMPage() {
  const [agent, setAgent] = useState<"openclaw" | "hermes-mcp">("openclaw");
  const [task, setTask] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [crmStatus, setCrmStatus] = useState<"checking" | "live" | "down">("checking");

  useEffect(() => {
    let cancel = false;
    fetch("http://localhost:3000/api/health", { signal: AbortSignal.timeout(2500) })
      .then((r) => { if (!cancel) setCrmStatus(r.ok ? "live" : "down"); })
      .catch(() => { if (!cancel) setCrmStatus("down"); });
    return () => { cancel = true; };
  }, []);

  async function dispatch(text: string) {
    if (!text.trim() || sending) return;
    setSending(true);
    setResult(null);
    let out = "";
    try {
      const r = await fetch("/__ai_chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent,
          prompt: `You are operating WACRM (the WhatsApp CRM at https://github.com/WaltLuv/wacrm). It's a self-hosted Next.js + Supabase CRM running on http://localhost:3000 with: shared inbox, contacts + tags + custom fields, sales pipelines (Kanban), broadcast templates, no-code automations, real-time dashboard. The user wants:

"${text}"

Produce a concrete plan with: (1) the exact WACRM modules/screens involved, (2) Supabase tables to query/update, (3) step-by-step actions, (4) any automations to set up, (5) what to verify before considering it done. Be specific — assume you can drive the UI via Playwright/browser-use if needed.`,
        }),
      });
      if (!r.body) throw new Error("no body");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line) as { type?: string; delta?: string };
            if (evt.type === "delta" && evt.delta) { out += evt.delta; setResult(out); }
          } catch { /* skip */ }
        }
      }
    } catch (e) { setResult(`Error: ${String(e)}`); }
    setSending(false);
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}>
          <MessageCircle size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#dcfce7" }}>WACRM · WhatsApp CRM</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
            Operated by {AGENTS.find((a) => a.id === agent)?.label} · {crmStatus === "live" ? "CRM dev server live" : "CRM dev server offline"}
          </div>
        </div>
        <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] transition" style={{ background: `${TONE}12`, border: `1px solid ${TONE}33`, color: "#dcfce7" }}>
          <ExternalLink size={12} /> Open CRM (:3000)
        </a>
      </header>

      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {/* Main: composer + result */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scroll">
          <div className="panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Workflow size={14} style={{ color: TONE }} />
                <h3 className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Operator</h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {AGENTS.map((a) => {
                const active = agent === a.id;
                return (
                  <button key={a.id} onClick={() => setAgent(a.id)} className="flex items-start gap-2 p-3 rounded-lg text-left transition" style={{ background: active ? `${TONE}18` : "transparent", border: `1px solid ${active ? TONE : "var(--panel-border)"}`, color: active ? "#fff" : "var(--fg-dim)" }}>
                    <span className="mt-0.5">{a.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold">{a.label}</div>
                      <div className="text-[10.5px] opacity-65 mt-0.5">{a.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={4}
              placeholder="What should the CRM operator do? e.g. 'Send today's hot-leads broadcast to everyone tagged warm in the last 14 days'"
              className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-y"
              style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", color: "var(--fg)" }}
            />

            <div className="flex items-center justify-between gap-2">
              <div className="text-[10.5px]" style={{ color: "var(--fg-dimmer)" }}>
                {crmStatus === "down" && <span style={{ color: "#fbbf24" }}>⚠ CRM dev server not detected on :3000</span>}
              </div>
              <button
                onClick={() => dispatch(task)}
                disabled={!task.trim() || sending}
                className="px-4 h-[36px] rounded-lg flex items-center gap-1.5 text-sm font-semibold transition disabled:opacity-40"
                style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, color: TONE }}
              >
                {sending ? <><RefreshCw size={14} className="animate-spin" /> Planning…</> : <><Send size={14} /> Dispatch</>}
              </button>
            </div>

            {result && (
              <pre className="scroll overflow-auto p-4 rounded-lg text-[12.5px] leading-relaxed whitespace-pre-wrap max-h-[460px]" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)", fontFamily: "'JetBrains Mono',monospace" }}>{result}</pre>
            )}
          </div>

          <div className="panel p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={13} style={{ color: TONE }} />
              <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Quick tasks</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {QUICK_TASKS.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTask(t); dispatch(t); }}
                  disabled={sending}
                  className="text-left p-3 rounded-lg text-[12px] transition disabled:opacity-40"
                  style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: setup */}
        <aside className="flex flex-col overflow-y-auto border-l p-4 space-y-3 scroll" style={{ width: "min(360px, 36vw)", borderColor: "var(--panel-border)" }}>
          <div className="panel p-4 space-y-3" style={{ background: "rgba(0,0,0,0.25)" }}>
            <div className="flex items-center gap-2">
              <Users size={13} style={{ color: TONE }} />
              <h3 className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>What you get</h3>
            </div>
            <ul className="text-[11.5px] leading-relaxed space-y-1.5" style={{ color: "var(--cream-dim)" }}>
              <li>• Shared WhatsApp inbox · multi-agent</li>
              <li>• Contacts + tags + custom fields</li>
              <li>• Sales pipelines (Kanban)</li>
              <li>• Broadcast templates · delivery tracking</li>
              <li>• No-code automations · visual builder</li>
              <li>• Real-time dashboard · response times</li>
            </ul>
          </div>

          <div className="panel p-4 space-y-2" style={{ background: "rgba(0,0,0,0.25)" }}>
            <div className="flex items-center gap-2">
              <AlertCircle size={13} style={{ color: "#fbbf24" }} />
              <h3 className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Setup</h3>
            </div>
            <pre className="text-[10.5px] font-mono whitespace-pre-wrap break-all p-2 rounded" style={{ background: "rgba(0,0,0,0.4)", color: TONE }}>{`git clone https://github.com/WaltLuv/wacrm.git ~/code/wacrm
cd ~/code/wacrm && npm install
cp .env.local.example .env.local
# fill Supabase + Meta WhatsApp creds
npm run dev    # → http://localhost:3000`}</pre>
          </div>

          <div className="panel p-4 space-y-2" style={{ background: "rgba(0,0,0,0.25)" }}>
            <h3 className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Stack</h3>
            <div className="text-[11px]" style={{ color: "var(--cream-dim)" }}>
              Next.js 16 · Supabase (Postgres + Auth + RLS) · Tailwind · WhatsApp Business API · AES-256-GCM token encryption · HMAC webhooks
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
