# Pinecone Connector — Knowledge Intelligence (Layer 2)

> Customer-facing name: **Knowledge Intelligence**
> Status: connector scaffolding shipped; embedding job is opt-in.

## What it does

Pinecone is the **semantic recall layer** of Baseline OS. Every workspace
gets its own namespace inside a single Pinecone index. AI employees query
it for similar past tasks, customer context, and reasoning hints before
they execute work.

## Setup

1. Create a Pinecone serverless index (1536-dim, cosine).
2. Set in `.env.local`:
   ```
   PINECONE_API_KEY=pcsk_...
   PINECONE_INDEX=baseline-os
   PINECONE_REGION=us-east-1
   PINECONE_EMBED_MODEL=text-embedding-3-small
   ```
3. Mission Control → Settings → Baseline OS Memory → **Connect Knowledge
   Intelligence**.
4. The connector creates `workspace_<id>` as the namespace and writes
   `memory_sources` row with `status='connected'`.

## What we embed

- New workforce memory entries (`workforce_memory.kind = 'task-completed' | 'decision' | 'hire' | 'install'`)
- Indexed Notion pages (Layer 3) — chunked, secret-redacted
- Optional: indexed Obsidian notes (Layer 1) when
  `OBSIDIAN_ROUTE_TO_PINECONE=true`

## Retrieval contract

```ts
import { semanticRecall } from '@/lib/baseline-os/recall'

const hits = await semanticRecall({
  workspaceId,
  query: 'How did we handle the last 1099 reconciliation discrepancy?',
  k: 5,
  filter: { kind: ['task-completed', 'decision'] },
})
```

`hits` carries `source`, `confidence` (cosine sim), `agentSlug`, and a
ready-to-render `snippet`. AI employees include `hits` in their reasoning
prompt and record which hit they used in the audit trail.

## Privacy

- One namespace per workspace. **No cross-namespace queries are possible.**
- API key lives only on the server.
- Secret-redactor runs before every embed.
- Forget: `POST /api/baseline-os/memory-sources { sourceType: 'pinecone', action: 'forget' }`
  deletes the workspace namespace.

## Cost guardrails

- Embedding cost is charged in **workforce credits** (mark-up applied as
  per `pricing_configs.event_type='embedding'`).
- Operator can cap monthly embedding spend via workspace autoreload's hard
  cap (default $50/mo).

## Common errors

| Error | Cause | Fix |
| --- | --- | --- |
| `PINECONE_API_KEY missing` | Env not set | Add to `.env.local`, restart |
| `Index not found` | `PINECONE_INDEX` mismatch | Recreate index or update env |
| `Embed model dimension mismatch` | Index dim ≠ model dim | Recreate index at 1536 |
