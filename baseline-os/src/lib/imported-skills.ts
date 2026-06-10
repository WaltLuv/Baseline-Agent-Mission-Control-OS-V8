/**
 * Imported skills — distilled from the audited source folders/files and
 * classified for the Skills Library / Marketplace. Each entry records what the
 * skill does, where it wires into the product, the credentials it needs, and
 * the proof a successful run must produce.
 *
 * TRUTH-FIRST: data only. Forbidden names (per Walt's cleanup rule) are NOT
 * carried over — these are neutral, product-owned descriptions. Skills needing
 * credentials stay setup-needed until those providers are connected.
 */

export type ImportedCategory =
  | "Knowledge"
  | "Creative"
  | "Content"
  | "Memory"
  | "DevOps"
  | "Ops"
  | "AI Agents"
  | "Data";

export type ApprovalTier = "auto" | "review" | "walt-only";

export interface ImportedSkill {
  slug: string;
  name: string;
  category: ImportedCategory;
  /** Original source file/folder this was distilled from. */
  source: string;
  summary: string;
  pricing: "free" | "paid";
  priceUsd: number;
  approvalTier: ApprovalTier;
  /** Credential/provider ids required to execute live ([] = none). */
  requiredCredentials: string[];
  proofExpectations: string;
  /** Product surfaces this skill wires into. */
  wiresInto: string[];
}

export const IMPORTED_SKILLS: ImportedSkill[] = [
  {
    slug: "business-insight",
    name: "Business Insight Dashboard",
    category: "Data",
    source: "Business-Insight-Skill",
    summary: "Turn workspace/revenue data into an executive insight + revenue dashboard.",
    pricing: "free",
    priceUsd: 0,
    approvalTier: "auto",
    requiredCredentials: [],
    proofExpectations: "Revenue dashboard + insight summary (trends, deltas, risks).",
    wiresInto: ["Executive Briefing", "ROI / Value", "Daily Brief", "Business Insight panel"],
  },
  {
    slug: "notebooklm-automation",
    name: "NotebookLM Automation",
    category: "Knowledge",
    source: "NotebookLMSkill.md",
    summary:
      "Programmatic NotebookLM: create notebooks, add sources (URL/YouTube/PDF/audio), generate artifacts, download formats.",
    pricing: "free",
    priceUsd: 0,
    approvalTier: "review",
    requiredCredentials: ["notebooklm", "google_drive"],
    proofExpectations: "Notebook created + artifact generated + downloaded file path.",
    wiresInto: ["NotebookLM Brain Layer 4", "Knowledge OS"],
  },
  {
    slug: "notebooklm-powerpoint",
    name: "NotebookLM → PowerPoint Converter",
    category: "Creative",
    source: "SKILL.md",
    summary:
      "Convert NotebookLM slide decks (PDF) into editable PPTX / PNG / HTML via the NotebookLM MCP.",
    pricing: "free",
    priceUsd: 0,
    approvalTier: "auto",
    requiredCredentials: ["notebooklm"],
    proofExpectations: "Exported .pptx / .png set from the source deck.",
    wiresInto: ["NotebookLM Brain Layer 4", "Claude Code Studio"],
  },
  {
    slug: "presentation-builder",
    name: "Presentation Builder",
    category: "Creative",
    source: "Presentation Builder.md",
    summary:
      "Generate self-contained HTML slide decks (style/density/images configurable) — one .html file, no dependencies.",
    pricing: "free",
    priceUsd: 0,
    approvalTier: "auto",
    requiredCredentials: [],
    proofExpectations: "Single self-contained .html deck that opens in any browser.",
    wiresInto: ["Claude Code Studio", "Agent Factory", "Marketing workflows", "YouTube workflow"],
  },
  {
    slug: "youtube-production",
    name: "YouTube Transcript & Production",
    category: "Content",
    source: "YouTube.md",
    summary:
      "Scrape a channel’s transcripts via the YouTube Data API + yt-dlp (.vtt), then feed content workflows.",
    pricing: "free",
    priceUsd: 0,
    approvalTier: "review",
    requiredCredentials: ["youtube_api", "yt_dlp"],
    proofExpectations: "Per-video .vtt transcripts + a structured content index.",
    wiresInto: [
      "Claude Code Studio",
      "Video Editing Team",
      "Creative Provider Matrix",
      "Publishing checklist",
    ],
  },
  {
    slug: "publish-github-vercel",
    name: "Publish to GitHub + Vercel",
    category: "DevOps",
    source: "publish-to-github-vercel.md",
    summary:
      "End-to-end: push a web project to GitHub and deploy it live on Vercel (handles the known gotchas).",
    pricing: "free",
    priceUsd: 0,
    approvalTier: "walt-only",
    requiredCredentials: ["github", "vercel"],
    proofExpectations:
      "New/updated GitHub repo + live Vercel URL (approval required before deploy).",
    wiresInto: ["Agent Factory", "Pipeline", "Claude Code Studio", "Deployment workflow"],
  },
  {
    slug: "morning-brief",
    name: "Morning Brief",
    category: "Ops",
    source: "morning brief",
    summary:
      "Personalized animated HTML morning-brief dashboard (priority emails, calendar, news, action items, stats).",
    pricing: "free",
    priceUsd: 0,
    approvalTier: "auto",
    requiredCredentials: ["gmail", "google_calendar"],
    proofExpectations: "Single-page HTML brief with the user’s configured sections + data.",
    wiresInto: ["Daily Brief", "Executive Briefing"],
  },
  {
    slug: "memory-recall",
    name: "Memory Recall",
    category: "Memory",
    source: "🧠 Memory System OS/commands/recall.md",
    summary:
      "Recall permanent context from the vector memory before answering (semantic search over stored memories).",
    pricing: "free",
    priceUsd: 0,
    approvalTier: "auto",
    requiredCredentials: ["pinecone"],
    proofExpectations: "Top-k recalled memories with sources injected into context.",
    wiresInto: ["Memory Browser", "PI Agent", "Knowledge OS", "Pinecone"],
  },
  {
    slug: "memory-wrap-up",
    name: "Memory Wrap-Up",
    category: "Memory",
    source: "🧠 Memory System OS/commands/wrap-up.md",
    summary:
      "At session end, summarize decisions/progress and store them permanently (chunked, deduped, no secrets indexed).",
    pricing: "free",
    priceUsd: 0,
    approvalTier: "auto",
    requiredCredentials: ["pinecone"],
    proofExpectations: "Stored memory entries + a session summary (secrets excluded).",
    wiresInto: ["Memory Browser", "PI Agent", "Knowledge OS", "Pinecone"],
  },
  {
    slug: "memory-strategy",
    name: "Strategy Memory",
    category: "Memory",
    source: "🧠 Memory System OS/commands/strategy.md",
    summary:
      "Maintain a living strategy document in long-term memory, recalled and updated across sessions.",
    pricing: "free",
    priceUsd: 0,
    approvalTier: "review",
    requiredCredentials: ["pinecone"],
    proofExpectations: "Updated strategy doc persisted to memory + recall proof.",
    wiresInto: ["PI Agent", "Knowledge OS", "Pinecone"],
  },
  {
    slug: "pinecone-memory-architecture",
    name: "Pinecone Memory 2.0",
    category: "Memory",
    source: "Claude + Pinecone 2.0 UNSTOPPABLE Memory.txt",
    summary:
      "Permanent vector-memory architecture: chunk → embed → dedupe → upsert → query, with proof and no secrets indexed.",
    pricing: "free",
    priceUsd: 0,
    approvalTier: "auto",
    requiredCredentials: ["pinecone"],
    proofExpectations: "Upsert + query proof; dedupe report; secret-scan clean before indexing.",
    wiresInto: ["Memory Browser", "PI Agent", "Knowledge OS", "Pinecone"],
  },
  {
    slug: "notebooklm-antigravity",
    name: "NotebookLM × Antigravity Research",
    category: "Knowledge",
    source: "NotebookLM has a NEW SuperPower (AntiGravity).txt",
    summary:
      "Drive NotebookLM research from the Antigravity multi-agent runtime (notebook chat → synthesized output).",
    pricing: "free",
    priceUsd: 0,
    approvalTier: "review",
    requiredCredentials: ["notebooklm", "antigravity"],
    proofExpectations:
      "Antigravity-driven research run + NotebookLM-sourced synthesis with citations.",
    wiresInto: ["NotebookLM Brain Layer 4", "Antigravity"],
  },
];

const CATEGORIES: ImportedCategory[] = [
  "Knowledge",
  "Creative",
  "Content",
  "Memory",
  "DevOps",
  "Ops",
  "AI Agents",
  "Data",
];

export function importedSkillsByCategory(): Record<ImportedCategory, ImportedSkill[]> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, [] as ImportedSkill[]])) as Record<
    ImportedCategory,
    ImportedSkill[]
  >;
  for (const s of IMPORTED_SKILLS) out[s.category].push(s);
  return out;
}

export function getImportedSkill(slug: string): ImportedSkill | undefined {
  return IMPORTED_SKILLS.find((s) => s.slug === slug);
}

export const IMPORTED_SKILLS_COUNT = IMPORTED_SKILLS.length;
