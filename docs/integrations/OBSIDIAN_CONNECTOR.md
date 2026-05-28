# Obsidian Connector — Operator Memory (Layer 1)

> Customer-facing name: **Operator Memory**
> Status: connector scaffolding shipped; sync job is opt-in.

## What it does

Indexes the operator's local Obsidian vault into Baseline OS so the AI
workforce can draw on the operator's doctrines, SOPs, and strategy notes
when reasoning. **Operator-only — never surfaced to customer workspaces.**

## Setup

1. `cp .env.example .env.local`
2. Set:
   ```
   OBSIDIAN_VAULT_PATH=/home/operator/Notes
   OBSIDIAN_INDEX_GLOB=**/*.md
   OBSIDIAN_IGNORE_GLOB=**/private/**,**/.trash/**
   ```
3. In Mission Control → Settings → Baseline OS Memory → **Connect Operator
   Memory**.
4. Hit **Resync** to index. The job runs server-side, never sending vault
   contents through the browser.

## What we index

- Markdown headings → document outline
- Frontmatter tags → searchable facets
- `[[wikilinks]]` → cross-document edges (used by Memory Graph)
- Body text → chunked, secret-redacted, ready for embedding

## What we never index

- Files under `OBSIDIAN_IGNORE_GLOB`
- Any file containing a recognized secret pattern (warning surfaced; file
  skipped until cleaned up)
- Operator binaries / images (text-only indexer)

## Privacy

- Vault path stored in `memory_sources.metadata` as relative path (no token).
- File contents never leave the operator's machine in the default
  configuration; embeddings are produced server-side only if Pinecone is
  also connected with an explicit `routeOperatorToPinecone=true` flag.
- Forget: `POST /api/baseline-os/memory-sources { sourceType: 'obsidian', action: 'forget' }`
  removes every Obsidian-sourced row from `workforce_memory` for the
  current workspace.

## Common errors

| Error | Cause | Fix |
| --- | --- | --- |
| `OBSIDIAN_VAULT_PATH not readable` | Path doesn't exist or supervisor user can't read it | `chmod +r` vault directory, restart |
| `Secret pattern detected in note.md` | A markdown file contains an API key | Move the key to a `.env`, restart sync |
| `Sync timed out` | Vault is enormous (>50k files) | Tighten `OBSIDIAN_INDEX_GLOB` to a working subset |
