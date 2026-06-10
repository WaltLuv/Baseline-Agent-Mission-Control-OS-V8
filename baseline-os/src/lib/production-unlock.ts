/**
 * Production Unlock Center data (Baseline OS / local-first).
 *
 * Lists every external system required to unlock full production functionality,
 * with the env var / config key it maps to, where it's used, what it unlocks,
 * setup steps, and a production-impact weight.
 *
 * TRUTH-FIRST: data only. Live status is probed at render time from the local
 * sidecar config (`/__os_config`) + presence of the env/config key. Anything
 * not detected renders as "Setup needed" — no fake-ready states.
 */
export type ProductionImpact = "critical" | "high" | "medium" | "low";

export interface UnlockItem {
  id: string;
  name: string;
  impact: ProductionImpact;
  /** Env var name(s) / config keys that satisfy this item. */
  requiredEnvVars: string[];
  /** Where it's consumed in Baseline OS. */
  whereUsed: string;
  /** Features unlocked once configured. */
  featuresUnlocked: string[];
  setupInstructions: string;
  setupUrl?: string;
}

export const UNLOCK_ITEMS: UnlockItem[] = [
  {
    id: "claude_code",
    name: "Claude Code runtime",
    impact: "critical",
    requiredEnvVars: ["ANTHROPIC_API_KEY"],
    whereUsed: "Agent Factory primary build engine + Claude Code session ingest.",
    featuresUnlocked: ["Agent Factory (Claude Code primary)", "Session/skill ROI ingest"],
    setupInstructions:
      "Install + authenticate the Claude Code CLI (the Agent Factory primary engine). Ollama is an optional local fallback, never required.",
    setupUrl: "https://docs.anthropic.com/en/docs/claude-code",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs (Slim voice)",
    impact: "high",
    requiredEnvVars: ["ELEVENLABS_API_KEY"],
    whereUsed: "Slim Charles voice synthesis (Baseline OS private assistant).",
    featuresUnlocked: ["Slim Charles real voice", "Audio briefs"],
    setupInstructions:
      "Add your ElevenLabs API key to ~/.claude-os/config.json. Voice ID rWyjfFeMZ6PxkHqD3wGC is wired; without a key the voice tab stays setup-needed.",
    setupUrl: "https://elevenlabs.io",
  },
  {
    id: "realtime_voice",
    name: "OpenAI Realtime / Gemini Live",
    impact: "high",
    requiredEnvVars: ["OPENAI_API_KEY", "GEMINI_API_KEY"],
    whereUsed: "Native speech-to-speech voice path for Slim Charles.",
    featuresUnlocked: ["Realtime interruptible voice"],
    setupInstructions:
      "Add an OpenAI key (GPT Realtime) and/or Gemini key (Gemini Live). Either unlocks the native realtime path; otherwise voice falls back honestly.",
    setupUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    impact: "high",
    requiredEnvVars: ["OPENROUTER_API_KEY"],
    whereUsed: "Free Claude Code / multi-model routing + live PAYG balance.",
    featuresUnlocked: ["Multi-provider routing", "Live balance + burn rate"],
    setupInstructions: "Add OPENROUTER_API_KEY to .env.local or ~/.claude-os/config.json.",
    setupUrl: "https://openrouter.ai/keys",
  },
  {
    id: "notebooklm",
    name: "NotebookLM / Google Drive",
    impact: "medium",
    requiredEnvVars: ["NOTEBOOKLM_REFRESH_TOKEN"],
    whereUsed: "Notebook page — Brain Layer 4 import + previews.",
    featuresUnlocked: ["NotebookLM import center", "Drive ingest"],
    setupInstructions:
      "Authorize NotebookLM via the notebooklm CLI (Google consent required). No public write API — import/preview are honest about sign-in.",
    setupUrl: "https://notebooklm.google.com",
  },
  {
    id: "obsidian",
    name: "Obsidian vault",
    impact: "medium",
    requiredEnvVars: ["obsidianVaultPath"],
    whereUsed: "Goals / Journal / Guide sync (Brain Layer 1).",
    featuresUnlocked: ["Obsidian vault sync"],
    setupInstructions:
      "Set obsidianVaultPath in ~/.claude-os/config.json (or via Settings) to your vault folder.",
    setupUrl: "https://obsidian.md",
  },
  {
    id: "notion",
    name: "Notion",
    impact: "medium",
    requiredEnvVars: ["NOTION_API_KEY"],
    whereUsed: "Brain Layer 2 — structured business memory.",
    featuresUnlocked: ["Notion-backed memory + skills"],
    setupInstructions:
      "Create a Notion internal integration, share the databases with it, and add NOTION_API_KEY.",
    setupUrl: "https://www.notion.so/my-integrations",
  },
  {
    id: "pinecone",
    name: "Pinecone",
    impact: "medium",
    requiredEnvVars: ["PINECONE_API_KEY"],
    whereUsed: "Brain Layer 3 — vector memory graph.",
    featuresUnlocked: ["Vector indexes in Memory graph"],
    setupInstructions: "Create a Pinecone index and add PINECONE_API_KEY (and index name).",
    setupUrl: "https://app.pinecone.io",
  },
  {
    id: "higgsfield",
    name: "Higgsfield Supercomputer",
    impact: "medium",
    requiredEnvVars: ["HIGGSFIELD_API_KEY"],
    whereUsed: "Higgsfield page — AI video + image generation.",
    featuresUnlocked: ["Higgsfield video/image generation"],
    setupInstructions: "Add HIGGSFIELD_API_KEY to enable live generation.",
    setupUrl: "https://higgsfield.ai",
  },
  {
    id: "github",
    name: "GitHub",
    impact: "medium",
    requiredEnvVars: ["GITHUB_TOKEN"],
    whereUsed: "Repo memory, PR drafting, engineering escalations.",
    featuresUnlocked: ["Repo memory", "PR drafting"],
    setupInstructions: "Create a fine-grained token and add GITHUB_TOKEN.",
    setupUrl: "https://github.com/settings/tokens",
  },
  {
    id: "telegram",
    name: "Telegram",
    impact: "medium",
    requiredEnvVars: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
    whereUsed: "Human-in-the-loop approvals + mobile alerts.",
    featuresUnlocked: ["Approval gate", "Mobile alerts"],
    setupInstructions: "Create a bot with @BotFather; add the bot token + numeric chat id.",
    setupUrl: "https://t.me/BotFather",
  },
  {
    id: "stripe",
    name: "Stripe (+ webhook)",
    impact: "low",
    requiredEnvVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    whereUsed: "Optional local billing experiments (Baseline OS is local-first).",
    featuresUnlocked: ["Local checkout experiments"],
    setupInstructions:
      "Add the Stripe secret key + webhook secret only if running local billing. Mission Control owns customer billing.",
    setupUrl: "https://dashboard.stripe.com/apikeys",
  },
  {
    id: "vercel",
    name: "Vercel",
    impact: "low",
    requiredEnvVars: ["VERCEL_TOKEN"],
    whereUsed: "Deploy skills.",
    featuresUnlocked: ["Vercel deploy skills"],
    setupInstructions: "Add VERCEL_TOKEN for deploy automations.",
    setupUrl: "https://vercel.com/account/tokens",
  },
  {
    id: "ollama",
    name: "Ollama (optional fallback)",
    impact: "low",
    requiredEnvVars: ["OLLAMA_HOST"],
    whereUsed: "Optional local/offline fallback for Agent Factory. Never required.",
    featuresUnlocked: ["Offline local generation"],
    setupInstructions:
      "Install Ollama, pull a model, and set OLLAMA_HOST. Optional fallback only — Agent Factory builds through Claude Code by default.",
    setupUrl: "https://ollama.com",
  },
];

const IMPACT_ORDER: Record<ProductionImpact, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function unlockItemsByImpact(): UnlockItem[] {
  return [...UNLOCK_ITEMS].sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]);
}

export function getUnlockItem(id: string): UnlockItem | undefined {
  return UNLOCK_ITEMS.find((u) => u.id === id);
}
