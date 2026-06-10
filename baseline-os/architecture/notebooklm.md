# SOP: NotebookLM Integration

## What It Is
NotebookLM (Google) is an AI-first research notebook that understands your sources.
The `notebooklm-mcp-cli` bridges it to Claude Code and this dashboard.

## Installation
```bash
# With uv (recommended):
uv tool install notebooklm-mcp-cli

# Or with pipx:
pipx install notebooklm-mcp-cli

# Installs two binaries:
# - nlm (CLI tool)
# - notebooklm-mcp (MCP connector)
```

## Authentication
```bash
nlm login
# Opens browser → sign in to Google account with NotebookLM
# Login saved for 2-4 weeks
```

## Wire Into Claude
```bash
nlm setup add claude-code
# Then restart Claude Code
```

## The 4-Tab Interface
1. **Library** — List all notebooks in your Google account
2. **Chat** — Ask questions about the active notebook's sources
3. **Studio** — Generate artifacts (audio, video, slides, mind maps, etc.)
4. **Assets** — View/play downloaded artifacts inline

## Artifact Types
- audio — AI-generated podcast overview
- video — Video summary
- slide_deck — Presentation slides
- mind_map — Visual knowledge map
- infographic — Visual summary
- flashcards — Study cards
- quiz — Knowledge test
- data_table — Structured data
- report — Written report (export to Google Docs only)

## Vault Sync
All chat sessions saved to: `{vault}/Baseline Automations/Notebooks/{notebookName}/chat-YYYY-MM-DD.md`
Downloaded artifacts saved to: `{vault}/Baseline Automations/Notebooks/_assets/{notebookName}/`

## Detection
- `/__notebooklm_status` → `{ nlmInstalled, mcpInstalled, authenticated }`
- Checks `~/.local/bin/nlm`, `~/.config/nlm/credentials.json`

## Common Issues
| Error | Fix |
|---|---|
| "Authentication expired" | Run `nlm login` again |
| "No notebooks found" | Wrong Google account — re-run `nlm login` |
| Report won't download | Reports only export to Google Docs (`export_artifact`) |
| Video not playing | Download not complete — check file size, wait and refresh |
