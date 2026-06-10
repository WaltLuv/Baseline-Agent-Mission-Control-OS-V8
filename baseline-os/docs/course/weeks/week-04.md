# Week 4 — Three Brains: Obsidian, Notion, Pinecone

> **Outcome:** All three memory layers are wired and you can articulate which one a piece of state belongs to *before* you write it down.

## Why this week matters

Context windows are short-term memory. They reset. Real systems need long-term memory, and there's no single "right" place for everything — different state belongs in different brains.

**The 3-brain model:**
| Brain | Best for | Wins because |
|---|---|---|
| **Obsidian (file)** | Daily journal, goals, voice-captured thought | Survives offline, you own the markdown, no API |
| **Notion (structured cloud)** | Shared docs, project state, agent reports | Multi-device, multiplayer, query language |
| **Pinecone (vector)** | Recall by meaning, cross-session facts | Semantic search — *what something means*, not what it says |

## Pre-class reading (~30 min)

- `/__pinecone_query`, `/__pinecone_upsert` in `vite.config.ts`
- `/__notion_search`, `/__notion_page` in `vite.config.ts`
- The Pinecone "multilingual-e5-large" model card (1024 dim, cosine)

## Live lecture outline (60 min)

**0:00 — Where state should live (15 min)** — Decision tree. Personal vs structured vs semantic.

**0:15 — Embeddings explained (15 min)** — Cosine similarity, 1024-dim vectors, why semantic search beats keyword search. Live demo: search "real estate operator" vs "property manager" — same meaning, different keywords.

**0:30 — Mirroring writes (15 min)** — Why `goals.tsx` and `journal.tsx` write to *both* Obsidian and Notion via `Promise.allSettled`. The pattern: redundant memory beats single point of failure.

**0:45 — The /memory 3D graph (15 min)** — Each cluster = a source. Watch nodes from Obsidian, Local Claude, Notion, and Pinecone render around the central hub.

## Hands-on lab (2 hours)

### Step 1 — Pinecone setup (30 min)

1. Create index at https://app.pinecone.io (serverless, 1024 dim, cosine, model: `multilingual-e5-large`)
2. Copy `PINECONE_API_KEY` + `PINECONE_INDEX_HOST` into `.env.local`
3. Restart `bun run dev`
4. Visit `/pinecone` — status should turn green

### Step 2 — Seed 10 memories (30 min)

In `/pinecone`, store 10 distinct facts about yourself or your business. Examples:
- "I run property operations in Columbus, Ohio"
- "My core stack is Next.js + Supabase + Stripe"
- "I prefer Karpathy's four principles over generic 'best practices'"

Then test semantic search:
- Query "Where am I based?" → should surface the Columbus fact
- Query "What's my tech stack?" → should surface the Next.js fact

### Step 3 — Notion root page (30 min)

1. In Notion, create a page called "Baseline Automations"
2. Share it with your "Slim Charles Memory Layer" integration
3. In `/notion`, search → find the page → click **Pin as Root**
4. Quick-create a child page from the right panel — verify it appears in Notion

### Step 4 — Mirror a goal (30 min)

1. Open `/goals`, add a goal
2. Save → check both Obsidian vault AND Notion for the new entry
3. Open `/memory`, click the Notion chip — see the new page show up in the 3D graph

## Self-study (2 hours)

- Read [`memory.tsx`](../../../src/routes/memory.tsx) — see how `extraNodes` flows into the graph component.
- Build a personal "what's my decision rule for this brain?" cheat sheet.

## Deliverable

- ✅ Pinecone live with 10 seeded memories
- ✅ Notion root page pinned, 1 quick-create page created
- ✅ A goal saved → mirrored to both Obsidian + Notion
- ✅ 1-paragraph cheat sheet on which brain you use for what

## Common issues

- **Pinecone returns 0 results** even after upsert → indexing takes ~10 seconds for new vectors
- **Notion search returns nothing** → you haven't shared pages with the integration yet (Notion → Share → Add connections)
- **Notion mirror fails silently in goals** → expected if no root page pinned; Obsidian still works
