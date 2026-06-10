# Blueprint — Cycle 2026-06 · Backlog of 7

> B.L.A.S.T. phase: **B**lueprint (the scope contract before any code ships)
> Status: **APPROVED WITH MODIFICATIONS** (operator, 2026-06-04)
> Operator: Walter Thornton
> Pilot: Claude Code (System Pilot mode)
> Repos in scope: `~/code/claude-os` (Baseline OS) · `~/code/mc-v8` (Mission Control)

---

## ARCHITECTURE RULE (operator directive, 2026-06-04)

**Baseline OS and Mission Control are not parent/child.**
They are two deployment modes of the same AI workforce control plane.

- Mode 1 — **Baseline OS**: local / self-hosted edition.
- Mode 2 — **Mission Control**: cloud-hosted edition.

Both must stand alone. Neither may require the other. Mission Control
must support direct runtime/agent connections (Claude Code, Codex,
OpenClaw, Hermes, Ruflo, Antigravity, NotebookLM, Browser Use, Maestro,
etc.) without requiring a local Baseline OS as intermediary.

Optional sync between the two modes is permitted via the
`kanban.event.v1` (and future `*.event.v1`) channels, but neither side
may fail when the other is offline or absent.

**Implication for every item in this Blueprint:** classify each
capability as (1) cloud-native, (2) remote runtime integration,
(3) embedded launcher, (4) honest setup-needed state, or
(5) not-suitable-for-cloud-with-reason. No blind iframing.

See companion docs once landed:
- `~/code/mc-v8/docs/architecture/DEPLOYMENT_MODES.md`
- `~/code/mc-v8/docs/architecture/FEATURE_PARITY_MATRIX.md`

---

## 1. Why this cycle exists

Walt assigned a strict-ordered 7-item backlog after a correction pass. The pilot
must complete each item without breaking the contracts already shipped in
Baseline OS Phases 1–3 or the Mission Control v8 surfaces. Every change must
preserve the **no-fake-state** rule: setup-needed surfaces show the actual setup
command, never a green dot.

This Blueprint is the gate. Code may not ship for items 2–7 until the Blueprint
section for each is checked off by the operator.

---

## 2. Ordered backlog (verbatim from operator)

| # | Item | Repo | Status |
|---|---|---|---|
| 1 | Insurance Workforce template (6 personas / 12 workflows / 4-tier approval / demo data, mirroring `property-management.json`) | `claude-os` | **Shipped** — commit `59fa413` |
| 2 | SQLite Kanban Dispatcher port from `hermes-multi-agent-workflow` | `claude-os` | **Draft, paused** — `src/lib/kanban.ts` + `mc kanban` CLI subcommand written but unverified |
| 3 | Mission Control mirroring (port 20+ Baseline OS surfaces into `mc-v8` with no-fake-state) | `mc-v8` | Not started |
| 4 | Flight Deck visibility in MC (manifest endpoints, downloads, pairing) | `mc-v8` | Not started |
| 5 | MC landing-page CMS replacement (Next.js + Tailwind + MongoDB + Vercel + `/admin/client` + `/admin/master`) | `mc-v8` | Not started |
| 6 | System Pilot B.L.A.S.T. scaffold | `claude-os` | **In progress — this document is part of it** |
| 7 | CLAUDE.md operating-manual template (A–G) | both | Not started |

> Note on ordering: the operator's stop signal at the start of item 2 promoted
> item 6 ahead of items 2–5. The new effective order is **6 → audit 1–2 → 2 → 3 → 4 → 5 → 7**.

---

## 3. Hard constraints (do-not-break)

These are the operator's standing instructions. Any change that risks violating
one of these must be paused for explicit confirmation.

### 3.1 Truth standard
- No fake connected states.
- No fake tool execution.
- No fake agents / skills / data.
- Every "needs setup" surface shows the actual setup command, not a placeholder.
- No real customer data in any demo (Insurance demo uses fictional names only).

### 3.2 Contracts that must keep working
- Mission Control sync
- Daily Brief producer (`mc daily-brief`, `/api/daily-brief`)
- ROI producer (`mc roi`, `/api/roi`)
- Runtime Registry
- Tool Registry
- Approval Engine (4-tier LOW/MEDIUM/HIGH/BLOCKED)
- Workforce Router
- CLI Registry (`mc help` listing, existing subcommands)
- Property Management Workforce installer (`/api/workforces` shape)

### 3.3 Concepts the operator has banned
- No Aion UI anywhere.
- No `/agentic-os` page anywhere.
- No re-introduction of the "Mission Control App" Aion concept.

### 3.4 Ownership boundary
- **Baseline OS owns:** runtime execution, CLI execution, router logic, tool
  registry execution, approval engine logic, Daily Brief producer, ROI producer,
  shared memory logic, agent skill access, local runtime commands.
- **Mission Control owns:** UI pages, customer-facing control surfaces,
  dashboards, proof displays, approval views, task views, skill views, document
  views, runtime views, embedded/linked tools, production launcher views.

A change in the wrong repo is a violation even if it works.

---

## 4. Per-item Blueprint

### Item 1 — Insurance Workforce template · SHIPPED ✓
- **Blueprint check:** template mirrors `property-management.json` exactly so the
  existing `/api/workforces` installer accepts it without code change.
- **Verification:** `id: insurance`, 6 employees, 12 workflows, 26 skills, 12
  seed tasks, status `ready` in `catalog.json`. Confirmed via API at the time of
  commit.
- **Risk to other contracts:** none — additive JSON only.
- **Sign-off:** operator confirmed by saying "continue" after the report.

### Item 2 — SQLite Kanban Dispatcher · DRAFT, awaiting sign-off
- **Blueprint contract:**
  - Table set: `tasks · task_events · dispatcher_runs · approval_requests`.
  - Atomic claim via single transaction with status-conditional `UPDATE`.
  - Parent-deps fan-in: child stays `todo` until every parent → `done`.
  - Scoring rubric: frequency (0-35) + pain (0-35) + solvability (0-30) = 100;
    advance threshold 65; below shelves.
  - Approval gate: pending requests block dispatch; Telegram is the human gate
    (delivery wired to Saul gateway — out of scope for this item; we expose
    `requestApproval` / `decideApproval` and let the gateway call them).
  - CLI surface: `mc kanban {doctor|list|add|inspect|events|dispatch|daemon|approvals|approve|shelve}`.
  - DB lives at `~/.claude-os/kanban.sqlite`; events also tail to
    `~/.claude-os/kanban-events.jsonl` for MC sync.
- **No-break check:** the new module is additive. It does NOT touch
  Workforce Router, Tool Registry, Approval Engine, or any existing CLI command.
  The new `mc kanban` subcommand is dispatched only when `args.cmd[0] === "kanban"`.
- **Open questions for operator:**
  - (Q2.1) Should the Telegram delivery layer live in `saul-gateway` (separate
    repo) or in Baseline OS? Default plan: gateway calls Baseline OS via the
    sidecar; Baseline OS does NOT speak HTTPS to Telegram itself.
  - (Q2.2) MC sync path for kanban events: piggy-back on the existing
    `publishToolExecution` channel or stand up `publishKanbanEvent`? Default
    plan: new channel `kanban.event.v1` so MC can subscribe selectively.
  - (Q2.3) Is `bun:sqlite` acceptable (Baseline OS already runs under Bun), or
    must we use `better-sqlite3` so Node-only deployments work? Default plan:
    `bun:sqlite` (matches the rest of Baseline OS runtime).
- **Sign-off required before:** running the dispatcher against any real task,
  exposing the CLI in `mc help`, or wiring MC.

### Item 3 — Mission Control mirroring
- **Blueprint contract:** port 20+ Baseline OS surfaces into `mc-v8` as **view-only**
  pages backed by real Baseline OS endpoints. Honest unavailable states when an
  endpoint isn't reachable.
- **Surfaces in scope:** ClaudeCode, CLI, Personas, Higgsfield, HyperEdit, Goals,
  NotebookLM, Codex, Antigravity, Ruflo, CodingAgent, Triad, Skills, Library,
  Documents, Notebook, SEO, HermesMCPLoop, Understand, BrowserUse, Maestro,
  HermesVideo, HermesManage, AntCockpit.
- **Pre-flight audit required:** for each surface, confirm the Baseline OS
  endpoint exists and returns a stable shape before the MC page is built. This
  audit is part of the **L**ink phase, not Blueprint.

### Item 4 — Flight Deck visibility in MC
- **Blueprint contract:** MC reads a Flight Deck manifest from Baseline OS,
  renders download buttons that disable when the artifact is absent, and shows a
  pairing flow + runtime check.
- **Open question:** (Q4.1) Where is the manifest defined today? If it doesn't
  exist yet, this item depends on a new Baseline OS endpoint that must ship
  first.

### Item 5 — MC landing-page CMS
- **Blueprint contract:** replace the current `mc-v8` home with a Next.js + Tailwind
  CMS. MongoDB Atlas as the store. Vercel-ready deploy. Routes:
  `/` (client site) · `/admin/client` (editor w/ live iframe preview) ·
  `/admin/master` (command center).
- **Open question:** (Q5.1) `mc-v8` is already Next.js 16 + React 19 + Tailwind
  3 — confirm we extend the existing app rather than spinning a parallel one.
- **Open question:** (Q5.2) MongoDB Atlas cluster credentials — does one already
  exist for this project, or do we provision a fresh one?
- **Open question:** (Q5.3) Vercel project — link to an existing one or create
  new?

### Item 6 — System Pilot B.L.A.S.T. scaffold · in progress
- **Blueprint contract:** stand up `memory/`, `architecture/`, `execution/`
  folders with the four canonical files; ensure `CLAUDE.md` declares B.L.A.S.T.
  as the operating protocol (already done in `claude-os/CLAUDE.md`).
- **Status:** `memory/` exists (decisions.md, findings.md from earlier cycle).
  `architecture/` exists. `execution/` created in this turn. This Blueprint file
  is the first artifact of the current cycle.
- **Remaining work for item 6:**
  - `execution/progress.md` (the live ledger)
  - `execution/no-break-list.md` (extracted from §3 above for quick reference)
  - Append D-005..D-009 to `memory/decisions.md` for this cycle
  - Append a "Cycle 2026-06" section to `memory/findings.md`

### Item 7 — CLAUDE.md operating-manual template (A–G)
- **Blueprint contract:** A=Project, B=Goal, C=Stack, D=Decisions,
  E=Memory Map, F=References, G=Optional overrides. Template that can be
  dropped into any new repo and edited to taste.
- **Distribution:** lives in `architecture/templates/CLAUDE.md.tmpl` in
  `claude-os`. Cross-repo propagation is a one-time `cp` per target, not an
  automated sync.

---

## 5. Success criteria (for the whole cycle)

- [ ] Every item above is either shipped with a verification command, deferred
      with operator approval, or rejected with a written reason.
- [ ] No surface in `claude-os` or `mc-v8` regresses on the do-not-break list.
- [ ] `mc help` still lists all prior subcommands, plus any new ones, with no
      missing entries.
- [ ] `mc-v8` build still passes (`bun run build` or `npm run build`).
- [ ] No Aion / Agentic OS references reintroduced.
- [ ] `execution/progress.md` reflects reality at the close of each item.

---

## 6. Rollback plan

Each item commits separately so any one can be reverted without touching the
others.

| Item | Rollback |
|---|---|
| 1 | `git revert 59fa413` — single JSON-only commit |
| 2 | revert the kanban commit; delete `~/.claude-os/kanban.sqlite` if it exists |
| 3 | per-surface revert; each MC page lands as its own commit |
| 4 | revert MC commit + the Baseline OS manifest endpoint commit |
| 5 | this is the riskiest item — branch `cms-landing-page-v1`; merge to main only after operator review |
| 6 | scaffold is text-only; deletable without runtime impact |
| 7 | template is text-only |

---

## 7. What the operator owes the pilot before code resumes

1. ✅ / ✗ on this Blueprint as a whole.
2. Answers (or "use default") to the open questions tagged Q2.1 / Q2.2 / Q2.3 /
   Q4.1 / Q5.1 / Q5.2 / Q5.3 above.
3. Confirmation that the item-2 draft (`src/lib/kanban.ts` + `mc kanban` CLI
   block) is acceptable as drafted, or a list of changes required.

Until those three are answered, the pilot will not ship further code in this
cycle.
