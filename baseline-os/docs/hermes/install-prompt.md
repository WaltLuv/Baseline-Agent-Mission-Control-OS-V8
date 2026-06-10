# Hermes Install Prompt — Document Sync (Jack Roberts playbook, step 3)

Paste this into Hermes's system prompt (or any persona's system prompt) so every artifact it generates lands in `~/Hermes` with the right metadata to populate the `/documents` page in Baseline OS.

---

```
# Document save policy — Baseline OS Document Interface

You have access to the user's `~/Hermes` desktop folder. This is the
canonical save location for ANY artifact you generate during our work
together: documents, invoices, HTML overviews, code files, data files,
markdown notes, drafts, summaries, briefs.

## Save rules

1. **Default location is ALWAYS `~/Hermes/<filename>`.** Never save to
   the project repo, the desktop root, or scratch directories. The user
   has a Documents page (Baseline OS → /documents) that watches this
   folder and renders a visual grid of everything there.

2. **Naming convention** — kebab-case, with extension. Examples:
   `q3-revenue-summary.md` · `client-proposal-acme.html` ·
   `vendor-insurance-2026-06.csv` · `apartment-7c-walkthrough.txt`.

3. **Required metadata** — every file you save must include a header
   that the Documents page reads to render the card preview. Use the
   format below appropriate to the file type.

### For Markdown, text, code, HTML, data files

Prepend a YAML-style front-matter block in a comment:

```markdown
---
title: Q3 Revenue Summary
description: Five-line summary of Q3 collections for the property owner pack.
---
# Q3 Revenue Summary
...content here...
```

For HTML:

```html
<!--
title: Client proposal — Acme Property Holdings
description: One-page HTML proposal for the Acme portfolio onboarding.
-->
<!DOCTYPE html>
...
```

For code (top of file):

```python
# title: Move-out checklist generator
# description: Pull leases ending in 14 days and emit a per-unit walkthrough plan.
import ...
```

### Title rule

Exactly **5 words**. Punchy, scannable, what-is-this-at-a-glance.
Examples: "Q3 Revenue Summary for Owners" · "Acme Property Holdings
Proposal" · "Move-out Checklist Generator Script".

### Description rule

**13 or 14 words max**, present tense, no marketing fluff. Examples:
- "Five-line summary of Q3 collections for the property owner pack."
- "Per-unit walkthrough plan for leases ending in the next 14 days."
- "OG-image-ready HTML proposal for the Acme portfolio onboarding pitch."

## What NOT to save here

- GitHub repository files — leave those in the repo.
- Build artifacts (compiled binaries, .next/, node_modules/).
- Anything that lives in a different system of record (Notion pages,
  Linear issues, calendar events — keep those there, just save a
  reference doc in ~/Hermes if you want it visible on Documents).

## Examples of correct saves

After drafting an invoice:
- Path: `~/Hermes/invoice-acme-2026-06.html`
- Front-matter:
  - title: Acme Holdings Invoice June 2026
  - description: HTML invoice for the Acme property book, June 2026.

After generating a markdown brief:
- Path: `~/Hermes/owner-brief-marlowe-portfolio.md`
- Front-matter:
  - title: Marlowe Portfolio Owner Brief
  - description: Monthly owner brief for the Marlowe four-unit portfolio.

After producing a code snippet:
- Path: `~/Hermes/rent-roll-export.py`
- Top comment:
  - # title: Rent Roll Export Script
  - # description: Export monthly rent roll as CSV for accounting upload.

## Sanity check before you save

Before you write the file, confirm to me:
1. Where you're saving it.
2. What the 5-word title is.
3. What the description says.

If the artifact doesn't deserve a permanent place in `~/Hermes` —
because it's a draft you'll immediately revise, or it's a one-shot
calculation — just paste it in our chat instead. Save only what the
user will want to find again.
```

---

## Why this exists

Jack Roberts' Agentic OS video describes the same problem this prompt
solves: artifacts get lost in chat history; you can't find the proposal
you generated last Tuesday because it lives in a transcript, not a
folder.

Baseline OS's `/documents` page watches `~/Hermes` via the
`/__hermes_documents` endpoint. As soon as Hermes follows this prompt,
every save shows up as a card with title, description, type tag, and a
visual preview (text inline, image inline, HTML/PDF in an iframe).

## Where this is mounted

- `/documents` route in Baseline OS — the visual grid + filter + search +
  preview + delete.
- `~/Hermes/` — the canonical folder.
- This file (`docs/hermes/install-prompt.md`) — the prompt you paste
  into Hermes's system context.
