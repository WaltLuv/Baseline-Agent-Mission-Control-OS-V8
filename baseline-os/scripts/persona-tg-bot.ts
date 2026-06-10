#!/usr/bin/env bun
/**
 * persona-tg-bot.ts — Telegram bot bridge for any Hermes persona.
 *
 * Usage:
 *   PERSONA=saul TG_TOKEN=xxx ALLOWED_CHAT_ID=yyy bun run scripts/persona-tg-bot.ts
 *
 * What it does:
 *   - Polls Telegram getUpdates for the given bot token
 *   - For every text message from ALLOWED_CHAT_ID, forwards to /__agent_run
 *     with the specified persona
 *   - Streams the persona's reply back to the chat
 *
 * Designed to run under launchd (one bot per persona). Build per-persona
 * plists with PERSONA + TG_TOKEN + ALLOWED_CHAT_ID env vars.
 */

const PERSONA = process.env.PERSONA;
const TG_TOKEN = process.env.TG_TOKEN;
const ALLOWED_CHAT_ID = process.env.ALLOWED_CHAT_ID;
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "http://127.0.0.1:8081";

if (!PERSONA || !TG_TOKEN) {
  console.error("Required env: PERSONA, TG_TOKEN. Optional: ALLOWED_CHAT_ID, DASHBOARD_URL.");
  process.exit(2);
}

const API = `https://api.telegram.org/bot${TG_TOKEN}`;
let offset = 0;
let me: { username?: string } = {};

interface TgUpdate {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
    from?: { id: number; first_name?: string };
  };
}

async function tg(method: string, body: object): Promise<any> {
  const r = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function callPersona(prompt: string): Promise<string> {
  const r = await fetch(`${DASHBOARD_URL}/__agent_run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent: PERSONA, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!r.ok || !r.body) {
    return `(error: ${r.status}) — /__agent_run unavailable`;
  }
  // /__agent_run streams SSE: data: {"delta":"...","done":false}
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let out = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      // Try SSE format first
      if (line.startsWith("data:")) {
        try {
          const evt = JSON.parse(line.slice(5).trim());
          if (evt.delta) out += evt.delta;
        } catch { /* skip */ }
        continue;
      }
      // NDJSON
      try { const evt = JSON.parse(line); if (evt.delta) out += evt.delta; else if (evt.type === "delta" && evt.delta) out += evt.delta; } catch { /* skip */ }
    }
  }
  return out.trim() || "(empty reply)";
}

async function handle(u: TgUpdate) {
  if (!u.message?.text) return;
  const chatId = u.message.chat.id;
  if (ALLOWED_CHAT_ID && String(chatId) !== ALLOWED_CHAT_ID) {
    console.warn(`[${PERSONA}] dropped message from unauthorized chat ${chatId}`);
    return;
  }
  const text = u.message.text;
  console.log(`[${PERSONA}] ← ${u.message.from?.first_name ?? "?"}: ${text.slice(0, 60)}`);
  await tg("sendChatAction", { chat_id: chatId, action: "typing" });
  try {
    const reply = await callPersona(text);
    // Telegram message max length is 4096; chunk if necessary
    const CHUNK = 3900;
    for (let i = 0; i < reply.length; i += CHUNK) {
      await tg("sendMessage", { chat_id: chatId, text: reply.slice(i, i + CHUNK) });
    }
    console.log(`[${PERSONA}] → ${reply.slice(0, 60)}…`);
  } catch (e) {
    await tg("sendMessage", { chat_id: chatId, text: `Error: ${String(e)}` });
  }
}

async function poll() {
  try {
    const r = await fetch(`${API}/getUpdates?offset=${offset}&timeout=25`, { signal: AbortSignal.timeout(30_000) });
    const j = await r.json() as { ok: boolean; result?: TgUpdate[] };
    if (j.ok && j.result) {
      for (const u of j.result) {
        offset = u.update_id + 1;
        // Don't await — let messages run in parallel
        handle(u).catch((e) => console.error(`[${PERSONA}] handler error:`, e));
      }
    }
  } catch (e) {
    if (!String(e).includes("timeout")) console.error(`[${PERSONA}] poll error:`, e);
  }
  setImmediate(poll);
}

(async () => {
  const meRes = await tg("getMe", {});
  me = meRes.result ?? {};
  console.log(`[${PERSONA}] bot @${me.username} online · dashboard=${DASHBOARD_URL} · allowed=${ALLOWED_CHAT_ID ?? "any"}`);
  poll();
})();
