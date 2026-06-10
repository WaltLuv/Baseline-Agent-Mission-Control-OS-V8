/**
 * Studio — AI media generation and creative tools.
 * Image prompts, voice scripts, video scripts, and creative content.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Image, Mic, Video, Sparkles, Download, RefreshCw, Clapperboard } from "lucide-react";
import { FullChat } from "@/components/full-chat";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Studio — Baseline Automations" },
      { name: "description", content: "AI media generation studio — image prompts, voice scripts, video scripts." },
    ],
  }),
  component: StudioPage,
});

const TONE = "#a855f7";

type Tool = "chat" | "image" | "voice" | "video";

function StudioPage() {
  const [tool, setTool] = useState<Tool>("chat");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const tools: { id: Tool; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: "chat",  label: "Creative Chat",  icon: <Sparkles size={15} />,    desc: "Brainstorm ideas, write copy, craft narratives" },
    { id: "image", label: "Image Prompts",  icon: <Image size={15} />,        desc: "Generate DALL-E 3 & Midjourney prompts" },
    { id: "voice", label: "Voice Scripts",  icon: <Mic size={15} />,          desc: "Write ElevenLabs-optimized TTS scripts" },
    { id: "video", label: "Video Scripts",  icon: <Video size={15} />,        desc: "Full video scripts with B-roll notes" },
  ];

  const SYSTEM_PROMPTS: Record<Tool, string> = {
    chat: "",
    image: `Generate detailed image generation prompts for: "{prompt}"

Provide:
1. **DALL-E 3 Prompt** (detailed, specific, < 1000 chars)
   - Include: subject, style, lighting, mood, composition, color palette

2. **Midjourney Prompt**
   - Include: ::weight parameters, --ar ratio, --style, --v 6

3. **Style Options** (3 variations)
   - Photorealistic
   - Digital art / illustration
   - Cinematic / film still

4. **Technical Notes**
   - Recommended aspect ratio
   - Negative prompts to avoid`,

    voice: `Write a voice synthesis script for: "{prompt}"

Create a natural, engaging script optimized for ElevenLabs TTS:
- Opening hook (5-10 seconds)
- Main content with natural pacing
- Strategic pauses marked as [pause]
- Emphasis cues marked as [emphasis: word]
- Conversational tone, not robotic
- Clear pronunciation of technical terms
- Strong close / CTA

Also include: recommended ElevenLabs voice, stability/similarity settings, estimated duration.`,

    video: `Write a complete video script for: "{prompt}"

Format:
## VIDEO TITLE
**Duration**: X minutes
**Format**: [YouTube/TikTok/Reel/Long-form]

### HOOK (0:00-0:15)
[What you say + visual suggestion]

### INTRO (0:15-0:45)
[Script + B-roll notes]

### MAIN CONTENT
[Section by section with timestamps, dialogue, B-roll suggestions, graphics notes]

### CTA (Last 30 sec)
[Script + visual]

### THUMBNAIL SUGGESTIONS
[3 thumbnail concepts with text overlay ideas]

### DESCRIPTION + TAGS
[YouTube description + hashtags]`,
  };

  async function generate() {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setResult(null);
    try {
      const systemPrompt = SYSTEM_PROMPTS[tool].replace("{prompt}", prompt);
      // Route through /__agent_run — the real agentic engine — with
      // claudeclaw so generation gets full tool access (file/web/etc).
      // /__ai_chat is the legacy text-only relay; /__agent_run emits
      // `data: {"delta":"…","done":false}` SSE the same as /__ai_chat,
      // but with real tool execution when the prompt needs it.
      const r = await fetch("/__agent_run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent: "claudeclaw",
          messages: [{ role: "user", content: systemPrompt || prompt }],
        }),
      });

      if (!r.body) throw new Error("no body");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = ""; let out = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          // SSE format — each event line starts with `data: ` and the
          // payload is JSON: { delta, done, model } or { tool, … } etc.
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload) as { delta?: string; done?: boolean };
            if (typeof evt.delta === "string" && evt.delta.length > 0) {
              out += evt.delta;
              setResult(out);
            }
          } catch { /* skip non-JSON keepalives */ }
        }
      }
    } catch (e) {
      setResult(`Error: ${String(e)}`);
    }
    setGenerating(false);
  }

  const placeholder: Record<Tool, string> = {
    chat: "Describe a creative project, ask for ideas, or request copy…",
    image: "A futuristic city at sunset with flying cars and neon lights, ultra-detailed…",
    voice: "Explain why AI agents are transforming the future of work and business…",
    video: "How to set up Claude Code with Hermes for maximum AI productivity in 2025…",
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow">
          <span className="num">I</span>
          <span className="line" />
          <span className="label">AI Content Studio</span>
        </div>
        <h1 className="page-title">Studio</h1>
        <p className="page-subtitle">AI-powered content generation — images, voice, video scripts, and creative copy.</p>
      </div>

      {/* Tool selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className="panel p-4 text-left transition"
            style={{
              borderColor: tool === t.id ? `${TONE}66` : "var(--panel-border)",
              background: tool === t.id ? `${TONE}10` : "var(--panel)",
              boxShadow: tool === t.id ? `0 0 20px ${TONE}22` : undefined,
            }}
          >
            <div className="flex items-center gap-2 mb-1.5" style={{ color: tool === t.id ? TONE : "var(--fg-dim)" }}>
              {t.icon}
              <span className="text-sm font-semibold">{t.label}</span>
            </div>
            <div className="text-[11.5px]" style={{ color: "var(--cream-dim)" }}>{t.desc}</div>
          </button>
        ))}
      </div>

      {/* Active tool content */}
      {tool === "chat" ? (
        <div style={{ height: "calc(100vh - 420px)", minHeight: 300 }}>
          <FullChat
            agent="studio"
            agentName="Studio"
            agentColor={TONE}
            storageKey="claude-os.chat.studio.v1"
            welcomeMessage="🎨 Creative studio ready. I can help brainstorm ideas, write scripts, craft copy, develop brand narratives, create content strategies, and generate creative concepts. What are we creating today?"
            placeholder="Describe what you want to create…"
            className="h-full"
          />
        </div>
      ) : (
        <div className="panel p-5 space-y-4">
          <div className="flex items-center gap-2">
            {tool === "image" && <Image size={16} style={{ color: TONE }} />}
            {tool === "voice" && <Mic size={16} style={{ color: TONE }} />}
            {tool === "video" && <Clapperboard size={16} style={{ color: TONE }} />}
            <h3 className="text-sm font-semibold">
              {tool === "image" ? "Image Prompt Generator" :
               tool === "voice" ? "Voice Script Writer" :
               "Video Script Generator"}
            </h3>
          </div>

          <div className="text-[12px] p-3 rounded-lg" style={{ background: `${TONE}10`, border: `1px solid ${TONE}30`, color: "var(--cream-dim)" }}>
            {tool === "image" && "Describe the image you want — Claude generates optimized DALL-E 3 and Midjourney prompts with style variations."}
            {tool === "voice" && "Describe what you want to say — Claude writes a natural, engaging ElevenLabs-optimized TTS script with pacing cues."}
            {tool === "video" && "Describe your video topic — Claude writes a complete script with timestamps, B-roll notes, thumbnail ideas, and YouTube description."}
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder={placeholder[tool]}
            className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-y"
            style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", color: "var(--fg)" }}
          />

          <div className="flex justify-end gap-2">
            {result && (
              <button
                onClick={() => navigator.clipboard.writeText(result)}
                className="px-3 h-[36px] rounded-lg text-[12px] flex items-center gap-1.5"
                style={{ background: "rgba(243,235,218,0.06)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)" }}
              >
                <Download size={12} /> Copy
              </button>
            )}
            <button
              onClick={generate}
              disabled={!prompt.trim() || generating}
              className="px-4 h-[36px] rounded-lg flex items-center gap-1.5 text-sm font-semibold transition disabled:opacity-40"
              style={{ background: `${TONE}22`, border: `1px solid ${TONE}55`, color: TONE }}
            >
              {generating ? <><RefreshCw size={14} className="animate-spin" /> Generating…</> : <><Sparkles size={14} /> Generate</>}
            </button>
          </div>

          {result && (
            <pre
              className="scroll overflow-auto p-4 rounded-lg text-[12.5px] leading-relaxed whitespace-pre-wrap max-h-[500px]"
              style={{ background: "rgba(0,0,0,0.35)", border: "1px solid var(--panel-border)", color: "var(--fg-dim)", fontFamily: "'JetBrains Mono',monospace" }}
            >
              {result}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
