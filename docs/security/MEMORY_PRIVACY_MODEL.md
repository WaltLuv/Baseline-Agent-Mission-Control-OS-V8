# Baseline OS — Memory Privacy Model

> Audience: operators, security reviewers, prospective customers asking
> "what does the brain see, and what stays mine?"

## TL;DR

| Layer | What it stores | Who can see it | Where credentials live |
| --- | --- | --- | --- |
| Internal Workforce Memory | Hires, installs, decisions | Workspace operator + that workspace's AI employees | None (local DB) |
| Operator Memory (Obsidian) | Founder doctrines, SOPs | **Operator only** — never customer workspaces | Local vault path; no secret to store |
| Knowledge Intelligence (Pinecone) | Embeddings | Workspace operator + that workspace's AI employees | `PINECONE_API_KEY` in server env |
| Business Knowledge Base (Notion) | Docs, SOPs, playbooks | Workspace operator + AI employees | OAuth refresh token, encrypted at rest |

## Hard rules

1. **No cross-workspace leakage.** Every `memory_sources` and
   `workforce_memory` row carries `workspace_id` and is filtered server-side.
   There is no `getAllMemory()`-style endpoint.
2. **Operator Memory is operator-only.** Obsidian-sourced documents are never
   surfaced to customer workspaces, never embedded into a tenant's Pinecone
   namespace, and never echoed to AI employees deployed for a tenant.
3. **Secrets are redacted before indexing.** The redactor strips: `apiKey`,
   `api_key`, `token`, `secret`, `password`, `access_token`. Custom regexes
   for AWS/Stripe/GitHub keys run on ingest.
4. **Credentials never reach the client.** The Memory Connectors settings
   page (`/app/settings/baseline-os-memory`) sends only safe metadata. Real
   API keys are accepted via server-only env or a one-time POST that wipes
   the body from logs.
5. **Sync jobs are auditable.** Each sync writes a row in `usage_events` /
   `workforce_memory` with `kind='baseline-os.memory-sync'` so the operator
   sees when, what, and from which source.
6. **Disconnect = stop, not delete.** `POST { action: 'disconnect' }` flips
   the status to `disconnected`. `POST { action: 'forget' }` triggers a
   workspace-scoped delete with audit log. Operator must explicitly request
   forget.
7. **Customer-visible memory is explicitly flagged.** Every retrieval call
   filters by `visibility IN ('workspace', 'public-summary')` for customer
   surfaces, never `operator-only`.

## Threat model

| Threat | Mitigation |
| --- | --- |
| Compromised AI employee tries to read another workspace's memory | All retrieval is bound by `workspace_id` from the authenticated session; agent tokens are workspace-scoped |
| Operator leaks Obsidian notes by accident | Operator memory has its own visibility flag; never surfaced via customer-facing endpoints |
| Notion page revoked, but data was already embedded | Resync diff deletes Pinecone vectors whose Notion source page is no longer reachable |
| Pinecone vector contains an embedded API key | Pre-embed redactor strips known secret patterns; pre-commit hook scans for new patterns |
| Database backup is leaked | Memory sources do NOT store raw credentials — only safe metadata (vault path / index name / page id). Real secrets live in env or a separate encrypted vault. |

## Operator controls

- View → `/app/settings/baseline-os-memory`
- Resync (manual) → POST `/api/baseline-os/memory-sources` `{ sourceType, action: 'resync' }`
- Disconnect → POST `/api/baseline-os/memory-sources` `{ sourceType, action: 'disconnect' }`
- Audit log → `GET /api/workforce/memory?kind=baseline-os.memory-sync`

## What we deliberately don't do

- **No public "share my workforce memory" URLs.** Sharing is limited to the
  signed-snapshot briefing share (operator-controlled, expiring, no live
  workspace exposure).
- **No cross-tenant embeddings.** Every workspace gets its own Pinecone
  namespace; there is no shared "company-wide" namespace.
- **No raw secret persistence in `memory_sources`.** The table redacts
  before write.
