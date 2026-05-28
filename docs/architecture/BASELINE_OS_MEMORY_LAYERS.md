# Baseline OS — 3-Layer Memory Architecture

> Status: Iteration 7 — shipped. Customer-facing surface at
> `/app/settings/baseline-os-memory`.

## Why Baseline OS owns memory

Mission Control is the **dashboard / supervision layer**.
**Baseline OS is the brain / intelligence layer** that powers Daily
Optimization, Workforce Health Score, Skills ROI, AI Employee personas,
Memory Graph, and Agent Scanner.

Memory is the asset that makes Baseline OS look intelligent over time. The
3-layer model below is what every customer workspace can opt into.

---

## Layer 0 — Internal Workforce Memory  *(built-in, always on)*

| Field | Value |
| --- | --- |
| Connector | `internal` |
| Store | SQLite table `workforce_memory` (workspace-scoped) |
| Purpose | Hires, skill installs, decisions, recommendations, optimization signals reported by AI employees |
| Visibility | Operator + AI employees in the same workspace |
| Privacy | Workspace-scoped row-level. Never crosses workspaces. |

Triggered automatically by:

- Marketplace installs (`POST /api/marketplace/purchase`)
- Optimization phone-home (`POST /api/optimization/report`)
- Workforce decisions inside Mission Control

---

## Layer 1 — Operator Memory  *(Obsidian)*

| Field | Value |
| --- | --- |
| Connector | `obsidian` |
| Customer-facing name | **Operator Memory** |
| Store | Operator's local Obsidian vault — never copied to customer workspaces |
| Purpose | Founder/operator doctrines, strategy docs, SOPs, meeting notes, daily reflections, persona instructions |
| Visibility | Operator-only |
| Privacy | Files referenced by relative path; secrets redacted before any indexing. Operator's vault contents are never returned to customer-facing surfaces. |

Use cases:

- Strategy docs
- Meeting notes
- Agent doctrines
- Daily reflections

See `docs/integrations/OBSIDIAN_CONNECTOR.md`.

---

## Layer 2 — Knowledge Intelligence  *(Pinecone)*

| Field | Value |
| --- | --- |
| Connector | `pinecone` |
| Customer-facing name | **Knowledge Intelligence** |
| Store | Pinecone serverless index (server-side credentials only) |
| Purpose | Embeddings · semantic search · similar-task retrieval · reasoning context |
| Visibility | Workspace-scoped namespace (one namespace per workspace) |
| Privacy | Credentials live in env (`PINECONE_API_KEY`); per-workspace namespace prevents cross-tenant leakage. Secrets stripped before ingestion. |

Use cases:

- Customer context recall
- Similar past tickets
- Workflow recall
- Support history

See `docs/integrations/PINECONE_CONNECTOR.md`.

---

## Layer 3 — Business Knowledge Base  *(Notion)*

| Field | Value |
| --- | --- |
| Connector | `notion` |
| Customer-facing name | **Business Knowledge Base** |
| Store | Customer's own Notion workspace via OAuth (token stored encrypted server-side) |
| Purpose | Company docs, SOPs, customer playbooks, content calendars, project docs, CRM-style notes |
| Visibility | Workspace-scoped |
| Privacy | OAuth tokens stored only on the server, never echoed to the client. Sync respects Notion ACLs — pages the OAuth user can't read are never indexed. |

Use cases:

- SOPs
- Customer playbooks
- Business plans
- Team docs

See `docs/integrations/NOTION_CONNECTOR.md`.

---

## Memory Source Registry schema

```sql
CREATE TABLE memory_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  source_type TEXT NOT NULL,         -- 'obsidian' | 'pinecone' | 'notion' | 'internal'
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_sync_at INTEGER,
  document_count INTEGER NOT NULL DEFAULT 0,
  embedding_count INTEGER NOT NULL DEFAULT 0,
  permission_scope TEXT NOT NULL DEFAULT 'workspace',
  visibility TEXT NOT NULL DEFAULT 'operator-only',
  metadata TEXT,                     -- redacted JSON (no secrets)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(workspace_id, source_type)
);
```

## Every memory item carries

- `source` (which layer it came from)
- `confidence` (0..1)
- `last_updated`
- `visibility` (operator-only | workspace | public-summary)
- `owning_workspace_id`
- `related_agent_slug` (nullable)
- `related_task_id` / `related_workflow_id` (nullable)

## Routing rule

Baseline OS consumes the layers in this order:

1. **Internal Workforce Memory** (always)
2. **Knowledge Intelligence** (if connected — semantic recall)
3. **Business Knowledge Base** (if connected — structured docs)
4. **Operator Memory** (operator-only contexts; never leaks to customer surfaces)

Each reasoning step records which sources were used so the operator can audit
why the workforce reached a given recommendation.
