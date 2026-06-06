# Consolidation architecture — Phases A–E

> **Status:** Architecture review. Walt's directive: *"Do not deploy yet.
> Architecture first."* This document classifies every Downloads asset and
> external repo Walt named, then proposes a clean separation across
> Knowledge OS (Phase A), Hermes V16 (Phase B), PI Agent (Phase C), Skills
> Audit (Phase D), and Slim (Phase E).
>
> No product code lands in this commit. Phases B/C/D/E each have a
> downstream commit chain once Walt signs off on the boundaries below.

---

## 0) Phase E correction — Slim and PI Agent are separate

Per Walt's explicit note: **"Keep Slim and PI Agent separate."**

| Agent | Role | Owns |
|---|---|---|
| **Slim Charles** | Voice Ops Commander | Telegram + Google Calendar + voice + browser-use + agent coordination + the Slim knowledge-base / config repos. *Does **not** own memory.* |
| **PI Agent** | Chief Memory Officer | The four-brain memory model: Working / Project / Knowledge / Strategic. Owns Obsidian + Pinecone + NotebookLM + memory ingestion + cleanup + retrieval. *Does **not** own coding, marketing, sales, ops.* |

This split is the single biggest architectural decision in this doc. Merging them produces the "does everything" agent Walt explicitly warned against.

---

## 1) Downloads audit (12 items)

For each item, the table classifies it as:
**reuse** (already covered) · **port** (lift into a new home) · **skill** (becomes a marketplace/library skill) · **page** (becomes a new tab/route) · **doc** (becomes docs only) · **workflow** (becomes a workforce-template workflow) · **skip** (duplicate/obsolete/unsafe).

| # | Item | Type | Classification | Target home |
|---|---|---|---|---|
| 1 | `agent-os-pack 7` | Install + config docs | **doc** | `claude-os/docs/install/` — already covered by setup; lift any new install steps |
| 2 | `🧠 Memory System OS` | Folder (commands / examples / skills / templates) | **port** + **skill** | Phase C PI Agent: ingest templates + skills; the `commands/` dir becomes PI Agent CLI verbs |
| 3 | `morning brief` | HTML morning-brief templates | **reuse** | Already covered by MC's existing **Daily Brief** + Executive Briefing path. Lift only the *style* of the HTML template into the existing surface |
| 4 | `Business-Insight-Skill` | HTML dashboard + `business-insight.skill` + revenue-dashboard.jsx | **skill** | Phase D import — verify it's not a dup of the existing ROI / business-insights panel; if new, register in `/marketplace` |
| 5 | `Voice assistant agent (with Telegram and Gcal) (1).json` | n8n workflow JSON | **doc** | n8n is a separate runtime; the workflow JSON is a spec, NOT a Mission Control workflow. Lift as **reference doc** for Phase E Slim, not a literal import |
| 6 | `EMAI Command Center OS` | Obsidian vault overlay | **port** | Phase A Knowledge OS — its Obsidian patterns inform the Knowledge-OS section design |
| 7 | `EMAI Update Pack` | Obsidian vault update overlay | **port** | Phase A — same destination as #6 |
| 8 | `three-brain-SKILL.md` | Codex/Gemini routing skill | **skill** | Phase D — install as a skill (auto-route work to Codex / Gemini per the trigger rules). Already aligned with claude-os's existing codex/gemini agents |
| 9 | `Claude + Pinecone 2.0 UNSTOPPABLE Memory.txt` | **YouTube transcript** (not a system) | **skip** as a "system"; **doc** for inspiration | Read-only reference. The actual Pinecone integration already exists at `/pinecone` in claude-os. Do not treat the transcript as a build spec |
| 10 | `Presentation Builder.md` | Skill spec | **skill** + **workflow** | Phase D — register in marketplace; also lands as a workflow step in the AI Product Launch Team template (#85) |
| 11 | `publish-to-github-vercel.md` | Skill spec | **skill** + **workflow** | Phase D — register as a skill; wires into the existing AI Product Launch Team's `ipt-wf-deployment-env` + `ipt-wf-github-export` workflows. Ties into existing GitHub / Vercel credentials |
| 12 | `Pi Agent Setup.md` | Pi (pi-coding-agent) install docs | **doc** | Phase C — Pi is **not** PI Agent. Pi is the open-source CLI from `@mariozechner/pi-coding-agent`. The PI Agent (Chief Memory Officer) is conceptually different — same name, different scope. Keep Pi as an optional runtime backend, document the naming carefully so users don't conflate them |

### Duplicates to ignore

- `agent-os-pack.zip`, `agent-os-pack (1).zip`, `agent-os-pack 2/3/4/5/6` — only `agent-os-pack 7` is authoritative.
- `EMAI Command Center OS 2.zip`, `EMAI Command Center OS (1).zip` — only the canonical folder.
- `🧠 Memory System OS-…zip` — only the canonical folder.

### Important naming clash

**"PI Agent" vs "Pi"** — Walt's `Pi Agent Setup.md` documents the `pi` CLI (`@mariozechner/pi-coding-agent`) which is an OpenRouter-backed coding agent. Walt's other directive talks about **PI Agent** as the Chief Memory Officer — a *different* concept that just happens to share the name.

**Recommendation:** rename the memory-manager agent to **`Memnos`** (Greek for "memory") or **`Mneme`** internally. Surface label stays "PI Agent" if Walt prefers, but the codebase uses an unambiguous slug. This avoids future "is this the coding agent or the memory agent?" confusion when a customer reads CLAUDE.md or grep'd code.

---

## 2) External repos audit

| Repo | Purpose | Disposition |
|---|---|---|
| `WaltLuv/slim-charles-agency-knowledge-base.git` | Slim's KB | Phase E — clone to `~/.claude-os/slim/kb/`, sync into Documents library, register Slim's knowledge tab |
| `WaltLuv/slim-charles-config.git` | Slim runtime config | Phase E — clone to `~/.claude-os/slim/config/`, source per-launch |
| `WaltLuv/Ai-agent-harness-browser-use.git` | Browser-use harness shared across agents | Wire into existing `/browser` page; expose as a setup-needed credential under the existing `browser_use` provider in `credentials/catalog.ts` |
| `WaltLuv/gstack-Y-Combinator-Skills.git` | Skill bundle | Phase D — clone, audit each skill, import only those that pass the classification checklist below |
| `WaltLuv/notebooklm-py.git` | NotebookLM Python bridge | Already wired (claude-os has `/agents/notebooklm` and `notebook.tsx`). Add the optional CLI install path + setup-needed surface; no rewrite |

**Security check on repos:** before any clone runs in production, the import script must `git log --all | grep -iE "TELEGRAM_BOT_TOKEN|sk-|ghp_|AAEN"` to refuse any repo whose history leaks credentials.

---

## 3) Phase A — Knowledge OS section

New top-level section in both repos, NOT scattered across random pages.

### Routes (claude-os)

```
/knowledge                          — landing dashboard
/knowledge/vault                    — Vault Browser (read .md files from configured vault)
/knowledge/command-center           — Command Center (today's planning + agenda)
/knowledge/quick-capture            — Quick Capture (single-input → vault note)
/knowledge/morning-brief            — Morning Brief view (consumes existing Daily Brief)
/knowledge/close-day                — Close Day reflection (writes to vault)
/knowledge/writing-style            — Writing Style Engine (style profile editor)
/knowledge/graph                    — Knowledge Graph viewer (already exists as memory.tsx — port + relabel)
/knowledge/sync                     — Obsidian Sync Status
```

### Routes (mc-v8)

```
/app/knowledge                      — same dashboard, cloud-side mirror
/app/knowledge/vault                — read-only mirror of vault metadata (no raw file content unless workspace user opted in)
/app/knowledge/command-center       — cloud command center
```

### Reuse vs new

| Feature | Status | Plan |
|---|---|---|
| Vault Browser | Not built | New — reads `~/.claude-os/config.json` for `obsidianVaultPath` (already set up) |
| Command Center Dashboard | Not built | New — composes existing Daily Brief + Tasks + Approvals into one view |
| Daily Planning | Existing: `/goals` | Reuse — link from command center |
| Quick Capture | Not built | New — small surface, single-input |
| Morning Brief | **Existing**: Daily Brief in MC + the briefings panel in Baseline OS | **Reuse** — wire the new card to the existing endpoint |
| Close Day | Existing: `/journal` | Reuse — alias |
| Writing Style Engine | Not built | New — style profile JSON in vault |
| Knowledge Graph | Existing: `/memory` in claude-os | Reuse — relabel within Knowledge OS |
| Obsidian Sync Status | Partial: existing `/__obsidian_write` sidecar | Polish — add a status check surface |
| Memory Browser | Existing: `/memory` | Reuse — promote into Knowledge OS nav |

### EMAI integration

The `EMAI Command Center OS` and `EMAI Update Pack` are Obsidian vault overlays. They're **content patterns**, not code. The Knowledge OS section should:
- Document them in `claude-os/architecture/emai-vault.md`.
- The Vault Browser renders any vault that has the EMAI structure; no special-casing required.

---

## 4) Phase B — Hermes V16

### Current state (probed read-only)

```
$ hermes --version
Hermes Agent v0.15.1 (2026.5.29)
```

Target per Walt's directive: **v16** (= v0.16.x or whatever the maintainer ships as 16.x). Two unknowns:

1. Is "v16" a real release tag, or does Walt mean "the latest 0.16-line"?
2. The `hermes update` CLI exists (`hermes --help` shows the verb). Behavior unverified.

### Plan

```
Phase B.1   Verify the target version is shipped (gh release list on the
            hermes repo + check the changelog for 0.16.x notes). NOT
            running `hermes update` until we know what we're upgrading
            to — silent breakage between minors is the failure mode to
            avoid.
Phase B.2   Run `hermes update` with a dry-run flag if available; capture
            the diff (changelog, manifest delta) into
            claude-os/execution/hermes-update-2026-06-XX.md.
Phase B.3   Run the actual update; verify with `hermes --version` post-
            update.
Phase B.4   If the update breaks any existing claude-os Hermes page
            (agents.hermes.*.tsx — 6 surfaces), patch in the same commit.
```

### VPS Hermes — runtime registration

The VPS-side Hermes already speaks the same protocol as local Hermes. The cleanest path:

1. **Local box:** save a runtime API key in `/settings/api-keys` under a new provider `hermes_vps` (URL = VPS host, secret = API key the VPS Hermes accepts).
2. **MC cloud:** the existing runtime_keys mechanism + `runtime_handshakes` already supports remote runtimes. Add a `hermes-remote` runtime type that points at the VPS URL.
3. **UI:** new section on `/agents/hermes` (claude-os) and a card on `/app/runtimes` (mc-v8) labeled "VPS Hermes" with status / heartbeat / skill inventory / Telegram status / update status.
4. **No direct DB connection.** The local box probes the VPS via HTTPS; cloud reads via the existing runtime telemetry path.

### Out of scope for this commit

No code changes to Hermes pages until Phase B.1 verifies the target version.

---

## 5) Phase C — PI Agent (Chief Memory Officer)

### Identity

- **Surface name:** PI Agent
- **Internal slug:** `memnos` (to avoid the Pi-CLI clash)
- **Role:** Chief Memory Officer
- **Personality:** custodial, careful, refuses to summarize without source
- **Owns:** memory only. Routes coding/marketing/sales/ops to other agents.

### Four-brain memory model

| Brain | Backing store | Owner |
|---|---|---|
| **1. Working Memory** | Current session context + `~/.claude/projects/**/*.jsonl` rolling buffer | PI Agent + Claude Code natively |
| **2. Project Memory** | Per-repo `.maestro/`, `memory/decisions.md`, `memory/findings.md` | PI Agent reads; Maestro owns the source-of-truth |
| **3. Knowledge Memory** | Obsidian vault + NotebookLM notebooks + Pinecone index | PI Agent owns ingestion + retrieval + cleanup |
| **4. Strategic Memory** | The user-explicit memory store (Walt's auto-memory at `~/.claude/projects/-Users-walt/memory/MEMORY.md`) | PI Agent reads; Claude Code owns writes per the existing /remember flow |

### Routes (claude-os)

```
/agents/pi-agent                — landing
/agents/pi-agent/working        — Working Memory inspector
/agents/pi-agent/project        — Project Memory across all repos
/agents/pi-agent/knowledge      — Knowledge Memory (Obsidian + NotebookLM + Pinecone)
/agents/pi-agent/strategic      — Strategic Memory (the MEMORY.md store)
/agents/pi-agent/ingest         — Memory ingestion controls
/agents/pi-agent/cleanup        — Compaction + dedup tools
```

### What PI Agent does NOT do

Per Walt's spec:
- No coding
- No marketing
- No sales
- No ops

If a customer asks PI Agent to write code, it deflects to Codex / Claude Code with a one-line handoff.

### Reuse

- `/memory` (existing) becomes Brain 3 → Working Memory inspector.
- `/pinecone` (existing) becomes Brain 3 → vector backend admin.
- `/notebook` + `/agents/notebooklm` become Brain 3 → NotebookLM admin.

---

## 6) Phase D — Skills audit (gstack + Downloads)

### Hard rule (Walt's verbatim)

> "Do not blindly install hundreds of skills. Audit and classify first."

### Classification checklist (each skill must pass)

```
[ ] name                                  — unique, no duplicate slug
[ ] description                           — one sentence, customer-facing
[ ] category                              — matches catalog
[ ] inputs                                — declared
[ ] outputs                               — declared
[ ] required credentials                  — listed (cross-checked with catalog)
[ ] pricing / free / included state       — declared
[ ] install status                        — provable on a fresh workspace
[ ] proof / test                          — at minimum a smoke command
[ ] history scan                          — `git log` clean of secrets
```

### Source repos / files to audit

| Source | Approx skill count | Plan |
|---|---|---|
| `gstack-Y-Combinator-Skills` | TBD | Clone → run classification checklist → import survivors into `workforce_skills` |
| `agent-os-pack 7 / source/` | TBD | Mostly install docs; lift any embedded skills |
| `🧠 Memory System OS / skills/` | TBD | PI Agent skills — Brain 3 ingestion verbs |
| `Business-Insight-Skill / business-insight.skill` | 1 | Direct import after dedup check against existing ROI panel |
| `three-brain-SKILL.md` | 1 | Direct import; aligns with claude-os's existing routing |
| `Presentation Builder.md` | 1 | Direct import; also workflow in AI Product Launch Team |
| `publish-to-github-vercel.md` | 1 | Direct import; ties to existing GitHub + Vercel credentials |

### Marketplace tier mapping

Each imported skill maps to one of: `free` (no credit cost), `included` (covered by the workspace's existing template), `credits` (priced per call). The Insurance + Property Management + AI Product Launch templates already establish these tiers; new skills must declare which tier they slot into.

---

## 7) Phase E — Slim (Voice Ops Commander)

### Identity

- **Surface name:** Slim
- **Internal slug:** `slim-charles`
- **Role:** Voice Ops Commander — field command for Walt's AI workforce
- **Owns:** voice (Telegram), calendar (Google), browser-use, agent coordination
- **Does NOT own:** memory (PI Agent), coding (Claude Code / Codex), product strategy (Priya)

### Routes (claude-os only — voice agent is local-first per Walt)

```
/agents/slim                    — landing
/agents/slim/voice              — voice input/output + Telegram bridge
/agents/slim/calendar           — Google Calendar
/agents/slim/browser            — Browser-Use harness (Walt's harness repo wired here)
/agents/slim/knowledge          — Slim's KB (cloned from slim-charles-agency-knowledge-base)
/agents/slim/coordination       — Agent handoff dashboard
```

### Routes (mc-v8 — read-only mirror)

```
/app/slim                       — status mirror (Voice / Calendar / Browser availability)
                                   No voice surface in cloud; Slim is a local-first agent.
```

### Repos integration

| Repo | Local path | Use |
|---|---|---|
| `slim-charles-agency-knowledge-base` | `~/.claude-os/slim/kb/` | Cloned on first run of `/agents/slim`; surfaces under `/agents/slim/knowledge` |
| `slim-charles-config` | `~/.claude-os/slim/config/` | Sourced per Slim launch; **must never be committed back to claude-os** |
| `Ai-agent-harness-browser-use` | `~/.claude-os/slim/browser-harness/` | Wires into the existing `/browser` page as a shared harness for every agent |

### Credentials needed (all already in catalog, surfaced as setup-needed)

- `telegram_bot` — Slim's voice channel
- `google_calendar` (OAuth) — already shipped in #84
- `browser_use` — already in catalog
- `slim-charles-config` — new provider `slim_config` (repo URL + access token)

---

## 8) Cross-cutting concerns

### Security

Walt's standing rules apply:
- Every clone runs `git log --all | grep -iE "<sensitive-pattern>"` before import — refuse on hit.
- No secret lands in MEMORY.md (post-2026-06-06 incident, this is enforced policy).
- All Slim + PI Agent credentials route through the Credentials Manager (#81), never `.env` paste.

### Quality gate

Each phase commit runs the full mc-v8 + claude-os gate (lint / typecheck / vitest / build) and ships its own tests:
- Phase A: route guard tests for Knowledge OS (no circular CTAs, all panels resolve).
- Phase B: `hermes --version` assertion post-update; VPS heartbeat probe test.
- Phase C: PI Agent verb tests (ingest / retrieve / cleanup); memory-source attribution test.
- Phase D: skill classification checklist test (every imported skill passes).
- Phase E: Slim setup-needed states surface honestly; KB + harness install paths covered.

### Dependency order

```
A   Knowledge OS                — independent; can start anytime
B   Hermes V16                  — independent; do first because it might break existing Hermes pages
C   PI Agent (Chief Memory)     — depends on A (Knowledge OS routes) being in place
D   Skills audit                — depends on D classification checklist; can start anytime
E   Slim                        — depends on B (Hermes V16 must be stable) + existing Credentials Manager
```

---

## 9) What's intentionally NOT in this commit

- No new routes, no new components, no migrations, no API endpoints.
- No `hermes update` execution (Phase B.1 verification first).
- No git clone of the five external repos (security history scan + Walt sign-off required).
- No skill imports — every skill from gstack must pass the classification checklist before landing.
- No Pi CLI install — that's a runtime backend decision Walt can make separately from the PI Agent (memory commander) design.

---

## 10) Decisions — answered 2026-06-06

The five open questions from the architecture-review pass were
answered by Walt on 2026-06-06. Each row is the rule the codebase
must follow; the **Why** is Walt's reason; the **How** is the concrete
predicate Phase-F-and-after work checks against.

### D-A1 · PI Agent naming

- **Display name:** `PI Agent`
- **Internal slug:** `pi-agent` (**not** `memnos`)
- **Role:** Chief Memory Officer — owns the four brain layers
  (Working / Project / Knowledge / Strategic)
- **Why:** Walt prefers the customer-facing name; `memnos` was an
  internal proposal that adds zero clarity for the operator.
- **How to apply:** all UI labels read `PI Agent`. Code identifiers,
  route paths, slugs, and DB rows use `pi-agent`. PI Agent never owns
  coding/marketing/sales/ops — those stay with Slim or Maestro.

### D-A2 · Hermes V16 — audit, don't fake

- **Rule:** `hermes --version` is the source of truth. Today it
  reports `0.15.1` (283 commits behind upstream). If `hermes update`
  surfaces a `v16.x` tag, that's the version. If it doesn't, the UI
  reports the actual latest available version, **never a fabricated
  `v16`**.
- **Why:** Walt's standing "no fake states" rule. A version label that
  doesn't match what the binary reports is a lie.
- **How to apply:** the Hermes runtime card surfaces (a) installed
  version, (b) latest available version when detectable, (c) update
  status, (d) VPS Hermes status, (e) `setup-needed` if unreachable.
  Phase B implementation runs `hermes update --help` + `hermes update`
  and reads the actual output — no hard-coded tag.

### D-A3 · VPS Hermes — mint runtime key

- **Runtime identity:** `hermes-vps` (display: `Hermes VPS`)
- **Required surface fields:** runtime key, heartbeat, health endpoint
  (if available), last-seen timestamp, status, capabilities, linked
  workspace, optional proof/event sync.
- **Registers with:** both Baseline OS local *and* Mission Control cloud.
- **Why:** Walt runs a VPS-hosted Hermes alongside the local one; both
  surfaces need to see it.
- **How to apply:** mint via [[credentials-manager]] runtime-key flow
  (the same path mints local agent-scoped API keys today, `users.id < 0`).
  Never hardcode the VPS key. Mirror sync is opt-in per the existing
  Phase #63 contract.

### D-A4 · EMAI vault disk root

- **Default path:** `~/Documents/EMAI-Command-Center-OS`
- **Env override:** `EMAI_VAULT_PATH`
- **Future:** Knowledge OS page surfaces a manual selector.
- **Rules:**
  - never overwrite an existing vault without confirmation
  - update pack must dry-run first
  - preserve existing `notes/`, `projects/`, `tasks/`, `context/`
  - surface vault status in the Knowledge OS UI
- **Why:** Walt's EMAI vault is a live working set, not scratch space.
- **How to apply:** `src/lib/emai/vault-path.ts` resolves the path
  with env > default precedence. The "open EMAI vault" flow checks
  `vaultExists()` first and refuses overwrite without explicit
  `--force` from the user.

### D-A5 · gstack skills — first-25 prioritized

- **Strategy:** first-N (start with 25), not all-or-nothing.
- **Priority order:** (1) YC / startup building · (2) customer
  discovery · (3) product strategy · (4) landing pages · (5) growth
  / SEO · (6) fundraising · (7) sales / outbound · (8) product launch
  · (9) analytics · (10) operations
- **Per-skill metadata required for import:** name, category,
  description, inputs, outputs, required credentials, pricing state,
  install status, dedupe check, marketplace listing.
- **Duplicates** are skipped or merged — never re-installed.
- **Why:** Walt's "do not blindly install hundreds of skills"
  directive. The first 25 give us the highest-leverage starter pack
  without burying the marketplace.
- **How to apply:** Phase D import script audits each skill against
  the checklist before insertion, sorts by category priority, takes
  the top 25, and emits a skip-list with reasons for the rest.

---

## 11) Phase F — Oh My Pi / OMP runtime

> **Status:** Added 2026-06-06 per Walt's Phase F directive. Phase F
> sits beside Phases A–E and is the *coding-harness* counterpart to
> Phase C's PI Agent. Do not confuse them — the name collision is
> deliberate on the Pi side and routinely conflated by users.

### F.0 · Distinction (this is the whole point)

| Concept | Slug | Role | Owns |
|---|---|---|---|
| **Oh My Pi / OMP** | `omp` | Open-source coding harness/runtime | TUI, providers, models, tools, browser automation, LSP, DAP, sessions, AGENTS.md / SYSTEM.md, skills, prompt templates, extensions — all coding-side. |
| **PI Agent** | `pi-agent` | Chief Memory Officer | The four-brain memory layers, Obsidian sync, Pinecone, NotebookLM, retrieval, cleanup — all memory-side. |

OMP is a **runtime**. PI Agent is a **role**. They never share UI
labels; they never share storage; they never share credentials. The
only thing they share is the word "Pi" in their name, and even that
is disambiguated in code (`omp` vs `pi-agent`).

### F.1 · Where it lives

- **`src/lib/agent-runtimes.ts`** — `RuntimeId` extended to include
  `'omp'`. Detector follows the `detectBinary` pattern Codex/Claude
  use; installer follows the `runInstallCmd` pattern. Sits beside
  `claude`, `codex`, `hermes`, `opencode`.
- **Mission Control runtime card** — `/runtimes/omp` renders via the
  existing `[id]` route. Card surfaces install status, version, config
  path (`~/.omp/`), models path, AGENTS.md path, SYSTEM.md path, skills
  path, sessions path, connected providers, and the four supported
  modes (Interactive / Print-JSON / RPC / SDK).
- **Baseline OS route** — `/agents/pi-runtime` (or `/agents/omp` per
  the existing `agents.<name>.tsx` convention) probes the binary on
  the local machine and surfaces install + version + config paths.
- **Obsidian / Knowledge OS panel** — labelled **"Pi Coding Harness"**
  (not "PI Memory Agent"). Provides install, connect, launch, and
  context-engineering quick actions. PI Agent's memory panel sits on
  the same page but is visually separated.

### F.2 · Install paths (offered, never auto-executed)

```bash
# Walt's preferred path (bun):
bun install -g @oh-my-pi/pi-coding-agent

# Walt's GitHub fork (the install target):
git clone https://github.com/WaltLuv/oh-my-pi.git
# (clone the fork; the published npm package may not match WaltLuv/oh-my-pi
#  HEAD until upstreamed — see note F.5 below)

# Official curl|sh (preferred when bun is unavailable):
curl -fsSL https://omp.sh/install | sh

# Windows:
irm https://omp.sh/install.ps1 | iex

# Pinned (mise):
mise use -g github:can1357/oh-my-pi
```

Mission Control does **not** silently run any of these. The install
job surfaces the chosen command, asks for approval, then runs in the
background-job harness (same machinery as Hermes/OpenCode installs).

### F.3 · Credentials + model integration

OMP supports 40+ providers. We tie its provider configuration into
the existing Credentials Manager, not to a parallel store:

- OpenRouter, OpenAI, Anthropic, Gemini, MiniMax, Kimi, xAI, Ollama,
  LM Studio, Hugging Face, Groq, Mistral.
- Missing credential → `setup-needed` deep-link to `/credentials`.
- Model Catalog feeds OMP's model selector. No duplicate catalogs.

### F.4 · Skills + browser

- OMP skills + prompt templates + extensions are **audited before
  import** per the Phase D checklist. Marketplace dedupes against
  existing entries. Do not bulk-import.
- OMP's browser automation routes through the existing `/browser`
  page / Browser Use harness — they are two surfaces over the same
  Puppeteer-backed capability, with the same per-action approval gate.

### F.5 · WaltLuv/oh-my-pi.git fork

Walt's directive names `https://github.com/WaltLuv/oh-my-pi.git`
as the install source. Until that fork is upstreamed or published to
npm under Walt's scope, the install flow:

1. Probes for the `omp` binary on PATH (handles already-installed via
   bun / curl|sh / mise).
2. If absent and Walt's fork is the chosen source, clones to
   `~/.omp-src/oh-my-pi` and runs the fork's documented build path.
3. Records the source (`fork` / `npm` / `curl-sh` / `mise`) in the
   runtime status so the UI can surface "you're on the fork" honestly.

### F.6 · pi-vs-claude-code companion repo

Walt's second link, `https://github.com/WaltLuv/pi-vs-claude-code.git`,
is a reference / tutorial repo — *not* a runtime. It lives under the
coding-agent comparison page in both surfaces and is cloned read-only
when the user opts in. It does **not** register in
`agent-runtimes.ts`. Treat it as documentation source-of-truth for
the Pi-vs-Claude-Code narrative on `/agents/pi-runtime`.

### F.7 · Approval policy (Walt's gates, applied to OMP)

| Tier | Operations |
|---|---|
| **LOW / AUTO** | read files, summarize, search, inspect session tree, generate plan drafts |
| **MEDIUM** | write local notes, create prompts, create skill drafts, create documentation drafts |
| **HIGH** | code edits, git commits, GitHub pushes, deployment, provider config changes, model config changes |
| **BLOCKED** | deleting production data, exposing secrets, changing billing logic without approval, destructive filesystem actions outside project scope, unauthorized remote SSH execution |

Approval engine reuses the existing per-action gate (`approvals.ts`).
OMP runs do not bypass it.

### F.8 · Security (Walt's hard rules)

- Never auto-run destructive OMP commands.
- Never allow unrestricted FS ops from Mission Control cloud against
  a remote OMP without approval.
- Remote OMP runtimes respect: runtime key auth, workspace scoping,
  approval engine, proof receipts, [[credentials-manager]], no secret
  logging.
- The strategy line stays explicit: **80% Claude Code, 20% OMP** for
  deep customization, open-source control, and experimental multi-
  agent workflows.

### F.9 · Test surface (Phase F acceptance)

- Pi runtime card appears in Mission Control runtimes list
- Pi setup route renders
- Missing install shows `setup-needed` honestly (no fake connected)
- Installed CLI surfaces a real version string
- Credentials link deep-routes to `/credentials`
- Model Catalog link works
- PI Agent memory page exists and is visually distinct from the
  Pi Coding Harness panel
- Approval policy is exposed in the UI
- Tests cover both the live-present and live-absent install states

---

*Reviewed-by: Claude (System Pilot). Phase A–F unblocked 2026-06-06.
Implementation lands in slices, foundation first
(runtime registry + vault resolver), UI surfaces next, then VPS
Hermes registration and gstack first-25 import.*
