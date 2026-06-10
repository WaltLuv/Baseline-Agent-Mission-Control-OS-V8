/**
 * SEO — Content pipeline page.
 * Generate SEO articles from a keyword + transcript using Claude.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Sparkles, Play, Square, FileText, ClipboardPaste, Globe, BookOpen } from "lucide-react";
import { FullChat } from "@/components/full-chat";

export const Route = createFileRoute("/seo")({
  head: () => ({
    meta: [
      { title: "SEO Pipeline — Baseline Automations" },
      { name: "description", content: "AI-powered SEO content generation pipeline." },
    ],
  }),
  component: SEOPage,
});

const TONE = "#a3e635";

type Tab = "generate" | "chat" | "guide";

function SEOPage() {
  const [tab, setTab] = useState<Tab>("generate");
  const [keyword, setKeyword] = useState("");
  const [transcript, setTranscript] = useState("");
  const [generating, setGenerating] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState<{ code: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: "generate", label: "Generate" },
    { id: "chat",     label: "SEO Chat" },
    { id: "guide",    label: "SEO Guide" },
  ];

  async function generate() {
    if (!keyword.trim() || generating) return;
    setGenerating(true);
    setLog([]);
    setDone(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const r = await fetch("/__ai_chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          agent: "seo",
          prompt: `You are an expert SEO content writer and digital marketing strategist. Generate a comprehensive, high-ranking SEO article for the keyword: "${keyword}"\n\n${transcript ? `Source transcript/context:\n${transcript}\n\n` : ""}Write a 1500-2000 word article with:\n- Compelling H1 title with target keyword\n- Meta description (exactly 155-160 chars)\n- Engaging introduction with hook\n- 5-6 H2 sections with detailed, actionable content\n- Bullet points and numbered lists for scannability\n- Natural keyword usage (LSI keywords too)\n- Internal linking suggestions [in brackets]\n- Strong conclusion with clear CTA\n\nFormat as clean markdown. Include a separate "SEO Notes" section at the end with: primary keyword density target, secondary keywords to use, suggested title tags.`,
        }),
      });

      if (!r.body) throw new Error("no body");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done: rdone } = await reader.read();
        if (rdone) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line) as { type?: string; delta?: string; code?: number };
            if (evt.type === "delta" && evt.delta) setLog((arr) => [...arr, evt.delta!]);
            else if (evt.type === "done") setDone({ code: evt.code ?? 0 });
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setLog((arr) => [...arr, `\n[error] ${String(e)}\n`]);
    }
    setGenerating(false);
  }

  function stop() { abortRef.current?.abort(); setGenerating(false); }

  const SEO_GUIDE = `# SEO Content Pipeline — Setup Guide

## Overview

This pipeline uses Claude to generate 5 unique SEO articles per keyword across 5 different sites. Each article is tailored to the specific site's voice and audience.

## Prerequisites

1. **Claude Code** installed and authenticated
2. **Sites configured** in ~/.claude-os/seo-sites.json
3. **Transcripts** saved to ~/.claude-os/seo-transcripts/

## Workflow

### 1. Gather Source Material
- Record a YouTube video, podcast, or stream about your topic
- Export the transcript (YouTube auto-captions, Descript, etc.)
- Paste it into the Transcript field

### 2. Set Your Keyword
- Enter your target keyword (e.g. "best AI agent framework 2025")
- The slug auto-generates from the keyword
- Customize if needed

### 3. Generate
- Click "Generate Article"
- Claude writes a comprehensive 1500-2000 word article
- Optimized for the target keyword with LSI keywords
- Formatted in clean markdown

### 4. Deploy
- Copy the generated markdown
- Paste into your CMS (WordPress, Ghost, Webflow, etc.)
- Add featured image, internal links, and publish

## Tips for Best Results

- **Specific keywords work better**: "hermes mcp server setup tutorial" beats "AI tools"
- **Include a transcript**: Gives Claude unique insights no AI competitor has
- **Review before publishing**: Always add your personal take and check facts
- **Internal links**: Add 3-5 links to other posts on the same site
- **Featured image**: Use Midjourney or DALL-E 3 with the prompt from the Studio tab

## Keyword Research Framework

\`\`\`
Primary keyword: [your main term]
LSI keywords: [related terms Claude suggests]
Intent: informational / transactional / navigational
Search volume: use Ahrefs / Semrush / Google Keyword Planner
Difficulty: target < 30 KD for new sites
\`\`\`

## Content Calendar Template

| Week | Keyword | Status | Live URL |
|------|---------|--------|----------|
| W1   | ...     | ✓ Live | ...      |
| W2   | ...     | Draft  | ...      |

Run the SEO Chat for keyword brainstorming, content strategy, and optimization advice.`;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      <header
        className="flex items-center gap-3 px-4 py-0 shrink-0 border-b"
        style={{ background: `${TONE}08`, borderColor: `${TONE}28` }}
      >
        <Globe size={16} style={{ color: TONE, margin: "8px 0" }} />
        <span className="text-[13px] font-bold mr-1" style={{ color: "#f0fce4" }}>SEO Pipeline</span>
        <div className="flex items-end gap-0 ml-1">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-4 py-3 text-[12px] font-semibold border-b-2 transition-colors"
                style={{ borderBottomColor: active ? TONE : "transparent", color: active ? "#f0fce4" : "rgba(255,255,255,0.45)" }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto my-2">
          <span
            className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border font-semibold uppercase tracking-[0.18em]"
            style={{ background: `${TONE}14`, borderColor: `${TONE}44`, color: TONE }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE }} />
            READY
          </span>
        </div>
      </header>

      {tab === "generate" && (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="panel p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} style={{ color: TONE }} />
              <h3 className="text-sm font-semibold">Generate SEO Article</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest" style={{ color: "var(--cream-mute)" }}>Target Keyword</label>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && generate()}
                  placeholder="e.g. best AI agent framework 2025"
                  className="mt-1 w-full h-[38px] px-3 rounded-lg text-sm outline-none"
                  style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", color: "var(--fg)" }}
                />
              </div>
              <div className="flex items-end justify-end">
                {generating ? (
                  <button onClick={stop} className="w-full h-[38px] rounded-lg flex items-center justify-center gap-1.5 text-sm" style={{ background: "rgba(196,96,126,0.15)", border: "1px solid rgba(196,96,126,0.45)", color: "#f87171" }}>
                    <Square size={14} /> Stop Generation
                  </button>
                ) : (
                  <button onClick={generate} disabled={!keyword.trim()} className="w-full h-[38px] rounded-lg flex items-center justify-center gap-1.5 text-sm font-semibold transition disabled:opacity-40" style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, color: TONE }}>
                    <Play size={14} /> Generate Article
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest flex items-center gap-1" style={{ color: "var(--cream-mute)" }}>
                <ClipboardPaste size={10} /> Source Transcript (optional — makes content unique)
              </label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={5}
                placeholder="Paste a YouTube transcript, podcast notes, or source content here. This gives Claude unique insights no competitor has."
                className="mt-1 w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-y"
                style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", color: "var(--fg)", fontFamily: "'JetBrains Mono',monospace" }}
              />
            </div>
          </div>

          {(generating || log.length > 0) && (
            <div className="panel p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText size={14} style={{ color: TONE }} />
                  Generated Article
                  {generating && <span className="inline-flex gap-0.5 ml-2"><span className="tick" style={{ color: TONE }} /><span className="tick" style={{ color: TONE, animationDelay: ".15s" }} /><span className="tick" style={{ color: TONE, animationDelay: ".3s" }} /></span>}
                </div>
                <div className="flex items-center gap-2">
                  {done && <span className="text-[10px] uppercase tracking-widest" style={{ color: done.code === 0 ? "var(--emerald)" : "var(--plum)" }}>{done.code === 0 ? "✓ Complete" : `Exit ${done.code}`}</span>}
                  {log.length > 0 && (
                    <button
                      onClick={() => navigator.clipboard.writeText(log.join(""))}
                      className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-md transition"
                      style={{ background: "rgba(243,235,218,0.06)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>
              <pre
                className="scroll overflow-auto p-4 rounded-lg text-[12.5px] leading-relaxed whitespace-pre-wrap max-h-[600px]"
                style={{ background: "rgba(0,0,0,0.45)", border: "1px solid var(--panel-border)", fontFamily: "'JetBrains Mono',monospace", color: "var(--fg-dim)" }}
              >
                {log.join("") || "Starting…"}
              </pre>
            </div>
          )}
        </div>
      )}

      {tab === "chat" && (
        <FullChat
          agent="seo"
          agentName="SEO Agent"
          agentColor={TONE}
          storageKey="claude-os.chat.seo.v1"
          welcomeMessage="📝 SEO content agent ready. I can write articles, do keyword research, optimize existing content, craft meta descriptions, build content calendars, and develop full SEO strategies. What do you need?"
          placeholder="Ask about SEO strategy, keyword research, content optimization…"
          className="flex-1 min-h-0"
        />
      )}

      {tab === "guide" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="panel p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={16} style={{ color: TONE }} />
              <h3 className="text-sm font-semibold">SEO Pipeline Setup Guide</h3>
            </div>
            <pre
              className="whitespace-pre-wrap text-[13px] leading-relaxed"
              style={{ color: "var(--fg-dim)", fontFamily: "Manrope, sans-serif" }}
            >
              {SEO_GUIDE}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
