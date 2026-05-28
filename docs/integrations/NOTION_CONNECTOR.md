# Notion Connector — Business Knowledge Base (Layer 3)

> Customer-facing name: **Business Knowledge Base**
> Status: connector scaffolding shipped; OAuth + sync job opt-in.

## What it does

Connects the operator's Notion workspace to Baseline OS. Selected
databases & pages (SOPs, customer playbooks, content calendars, project
docs, internal CRM notes) become **structured business knowledge** that
the AI workforce consults during reasoning.

## Setup

1. Create a Notion integration:
   - https://www.notion.so/profile/integrations
   - Type: Internal · capabilities: Read content
2. In Notion, **share** the databases/pages you want the workforce to read
   with that integration.
3. Set in `.env.local`:
   ```
   NOTION_OAUTH_CLIENT_ID=...
   NOTION_OAUTH_CLIENT_SECRET=...
   NOTION_REDIRECT_URI=https://your-host/api/integrations/notion/callback
   ```
4. Mission Control → Settings → Baseline OS Memory → **Connect Business
   Knowledge Base**. Complete OAuth.
5. Hit **Resync** to ingest.

## What we ingest

- Page title → searchable
- Block content → chunked, secret-redacted
- Page properties (status, owner, due date) → searchable facets
- Database schema → workflow context (e.g., "Customer Playbooks" DB →
  routing hint for support-style queries)

## What we never do

- Read pages the OAuth integration was not shared with — Notion's own ACL
  is enforced server-side.
- Mutate Notion content. Read-only by design.
- Re-share Notion content across workspaces.

## Privacy

- OAuth refresh token stored encrypted server-side (`NOTION_TOKEN_KEK`).
- Namespace per workspace inside Pinecone for embeddings.
- Forget: `POST /api/baseline-os/memory-sources { sourceType: 'notion', action: 'forget' }`
  - drops the OAuth token
  - deletes every Notion-sourced row from `workforce_memory`
  - deletes vectors from the workspace's Pinecone namespace

## Retrieval contract

`baselineOsContext({ workspaceId, query })` returns a unified bundle of
Internal + Pinecone (semantic) + Notion (structured) hits with provenance
tags so the reasoning step records *why* it used each.

## Common errors

| Error | Cause | Fix |
| --- | --- | --- |
| `Notion OAuth invalid_grant` | Refresh token revoked in Notion | Reconnect from settings |
| `Notion rate limit` | More than 3 req/s | Built-in exponential backoff |
| `Page not found` | Page unshared from integration | Resync — the stale row is purged |
