/**
 * Maestro — cross-agent communication bus.
 *
 * Every agent (Gemini / OpenClaw / Hermes / ClaudeClaw / Codex / Studio / SEO)
 * can post a message to the shared log. Other agents can read peer messages
 * on their next turn — the system prompt notes the bus exists.
 *
 *   GET  /__agent_message?to=<agent>   → recent messages
 *   POST /__agent_message              → { from, to, subject, body }
 */

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Network, Send, RefreshCw, ArrowRight, Sparkles } from "lucide-react";
import { RuntimeCredentialStatus } from "@/components/runtime-credential-status";
import { MaestroPanel } from "@/components/maestro-panel";

export const Route = createFileRoute("/maestro")({
  head: () => ({
    meta: [
      { title: "Maestro — Baseline Automations" },
      { name: "description", content: "Cross-agent communication bus." },
    ],
  }),
  component: MaestroPage,
});

const TONE = "#a78bfa";

const AGENTS = [
  { id: "gemini",     label: "Gemini",     color: "#4F8EF7" },
  { id: "openclaw",   label: "OpenClaw",   color: "#EF4444" },
  { id: "hermes-mcp", label: "Hermes",     color: "#06B6D4" },
  { id: "claudeclaw", label: "ClaudeClaw", color: "#D97757" },
  { id: "codex",      label: "Codex",      color: "#22c55e" },
  { id: "studio",     label: "Studio",     color: "#a855f7" },
  { id: "seo",        label: "SEO",        color: "#a3e635" },
  { id: "all",        label: "All",        color: "#9ca3af" },
] as const;

type AgentId = typeof AGENTS[number]["id"];

interface Message {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  ts: number;
  threadId?: string;
}

function MaestroPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState<AgentId>("gemini");
  const [to, setTo] = useState<AgentId>("openclaw");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [dispatchPeer, setDispatchPeer] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/__agent_message?limit=100");
      const j = await r.json() as { messages: Message[] };
      setMessages((j.messages || []).slice().reverse());
    } catch { /* skip */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [load]);

  async function send() {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/__agent_message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, to, subject, body }),
      });

      // If dispatchPeer, also forward to the target agent's chat
      if (dispatchPeer && to !== "all") {
        try {
          await fetch("/__ai_chat", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              agent: to,
              prompt: `[MAESTRO MESSAGE from ${from}]\nSubject: ${subject || "(no subject)"}\n\n${body}\n\n[end message]\n\nRespond as ${to} would, then write a reply back to ${from} by calling POST /__agent_message with { from:"${to}", to:"${from}", subject:"Re: ${subject || "(no subject)"}", body:"<your reply>" }.`,
            }),
          });
        } catch { /* skip */ }
      }

      setBody("");
      setSubject("");
      load();
    } catch { /* skip */ }
    setSending(false);
  }

  function agentMeta(id: string) {
    return AGENTS.find((a) => a.id === id.toLowerCase()) ?? { id, label: id, color: "#888" };
  }

  return (
    <div className="flex flex-col gap-4" style={{ minHeight: "calc(100vh - 56px)" }}>
      <div className="px-4 pt-3">
        <RuntimeCredentialStatus providerIds={["maestro"]} variant="inline" />
      </div>

      {/* Dominant section — the actual Maestro CLI orchestration surface.
          Walt: "Maestro is the local-first conductor for multi-agent
          software engineering." This panel reads /__maestro_status and
          surfaces every whitelisted subcommand from the sidecar. */}
      <div className="px-4">
        <MaestroPanel />
      </div>

      <header className="flex items-center gap-3 px-4 py-3 shrink-0 border-b mt-4" style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${TONE}20`, border: `1px solid ${TONE}44`, color: TONE }}>
          <Network size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold" style={{ color: "#e9d5ff" }}>Cross-agent message bus</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>
            {messages.length} message{messages.length !== 1 ? "s" : ""} in log · shared across every agent
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg" style={{ background: "rgba(243,235,218,0.04)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {/* Left: message log */}
        <div className="flex-1 overflow-y-auto p-6 scroll">
          {messages.length === 0 && (
            <div className="text-center py-12" style={{ color: "var(--fg-dimmer)" }}>
              <Network size={36} style={{ opacity: 0.25, margin: "0 auto 12px" }} />
              <div className="text-[13px] mb-1" style={{ color: "var(--fg)" }}>No messages yet</div>
              <div className="text-[11px]">Send the first peer message →</div>
            </div>
          )}
          <div className="space-y-3 max-w-3xl">
            {messages.map((m) => {
              const fa = agentMeta(m.from);
              const ta = agentMeta(m.to);
              return (
                <div key={m.id} className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)" }}>
                  <div className="flex items-center gap-2 text-[11px] mb-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded font-semibold" style={{ background: `${fa.color}22`, color: fa.color, border: `1px solid ${fa.color}55` }}>{fa.label}</span>
                    <ArrowRight size={11} style={{ color: "var(--fg-dimmer)" }} />
                    <span className="px-2 py-0.5 rounded font-semibold" style={{ background: `${ta.color}22`, color: ta.color, border: `1px solid ${ta.color}55` }}>{ta.label}</span>
                    <span className="ml-auto text-[10px]" style={{ color: "var(--fg-dimmer)" }}>{new Date(m.ts).toLocaleString()}</span>
                  </div>
                  {m.subject && <div className="text-[12.5px] font-semibold mb-1" style={{ color: "#fff" }}>{m.subject}</div>}
                  <div className="text-[12px] whitespace-pre-wrap leading-relaxed" style={{ color: "var(--fg)" }}>{m.body}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: composer */}
        <aside className="flex flex-col overflow-y-auto border-l p-4 space-y-3 scroll" style={{ width: "min(400px, 38vw)", borderColor: "var(--panel-border)" }}>
          <div className="panel p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Send size={13} style={{ color: TONE }} />
              <h3 className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Compose message</h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <div className="text-[10px] mb-1" style={{ color: "var(--fg-dimmer)" }}>From</div>
                <select value={from} onChange={(e) => setFrom(e.target.value as AgentId)} className="w-full px-2 py-1.5 rounded text-[12px] outline-none" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "var(--fg)" }}>
                  {AGENTS.filter((a) => a.id !== "all").map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-[10px] mb-1" style={{ color: "var(--fg-dimmer)" }}>To</div>
                <select value={to} onChange={(e) => setTo(e.target.value as AgentId)} className="w-full px-2 py-1.5 rounded text-[12px] outline-none" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "var(--fg)" }}>
                  {AGENTS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </label>
            </div>

            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (optional)"
              className="w-full px-3 py-2 rounded text-[12px] outline-none"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "var(--fg)" }}
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Message body…"
              className="w-full px-3 py-2 rounded text-[12px] outline-none resize-y"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--panel-border)", color: "var(--fg)" }}
            />

            <label className="flex items-center gap-2 text-[11.5px] cursor-pointer" style={{ color: "var(--cream-dim)" }}>
              <input type="checkbox" checked={dispatchPeer} onChange={(e) => setDispatchPeer(e.target.checked)} />
              <Sparkles size={11} style={{ color: TONE }} />
              Also dispatch to {agentMeta(to).label} (live chat call)
            </label>

            <button
              onClick={send}
              disabled={!body.trim() || sending}
              className="w-full py-2 rounded-full text-[12.5px] font-semibold transition disabled:opacity-40"
              style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, color: TONE }}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>

          <div className="panel p-4 space-y-2 text-[11.5px]" style={{ background: "rgba(0,0,0,0.25)", color: "var(--cream-dim)" }}>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>How agents read the bus</h3>
            <p>
              Every agent's system prompt notes that <code style={{ color: TONE }}>/__agent_message</code> exists. Agents can call <code>GET /__agent_message?to=&lt;self&gt;</code> at the start of a turn to fetch peer messages, then act on them or reply via <code>POST</code>.
            </p>
            <p>
              The shared log is persisted at <code style={{ color: TONE }}>~/.claude-os/maestro/messages.jsonl</code>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
