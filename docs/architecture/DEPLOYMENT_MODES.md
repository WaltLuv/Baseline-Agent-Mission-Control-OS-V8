# Deployment Modes — Baseline OS vs Mission Control

> Status: **canonical** as of 2026-06-04 (operator directive).
> Audience: customers choosing between local and cloud, and engineers
> deciding where a new capability should land.

---

## TL;DR

Baseline OS and Mission Control are not parent/child products. They are
**two deployment modes of the same AI workforce control plane.**

| Mode | Product | Runs on | Best for |
|---|---|---|---|
| Mode 1 — Local | **Baseline OS** | Local machine, Mac mini, VPS, private workstation, self-hosted server | Operators who want local control, local agents, local files, private memory, desktop workflows |
| Mode 2 — Cloud | **Mission Control** | DigitalOcean / cloud production server | Customers who want a hosted dashboard, team access, cloud billing, marketplace, remote runtime connections |

Both stand alone. Both are real products. Neither requires the other.

---

## What the customer sees

Customers choose at the top of the funnel:

- **"I want local control."** → Use Baseline OS. Setup fees and
  done-for-you services may apply.
- **"I want hosted cloud access."** → Use Mission Control. Free to enter.
  Pay for usage credits, paid marketplace skills, and paid marketplace
  workflows. No required monthly software subscription, no setup fee.

These billing models do not transfer between modes. Done-for-you setup
revenue belongs to Baseline OS; usage + marketplace revenue belongs to
Mission Control.

---

## What both modes must support

Every capability listed below should exist in both modes, or carry a
truthful "setup needed" / "not suitable for cloud" state in the mode
where it does not.

- Runtime Registry
- Workforce Router
- Tool Registry
- Approval Engine (4-tier LOW / MEDIUM / HIGH / BLOCKED)
- Kanban Dispatcher (see `kanban.event.v1` below)
- CLI Anything
- Skills (free + paid marketplace)
- Shared Memory
- Employee Personas
- Documents
- Library
- Notebook
- Google NotebookLM Agent
- Browser Use
- Maestro
- Hermes MCP Loop
- Higgsfield
- HyperEdit
- Video Studio / Hermes Video Agent
- Flight Deck (desktop companion for either mode)
- Codex CLI
- Claude Code CLI
- Antigravity
- Ruflo
- Triad Council
- Goals
- SEO
- Daily Brief
- ROI
- Marketplace

For each capability, the per-mode implementation must be classified as
one of:

1. **Cloud-native** — the cloud mode implements it natively, no localhost.
2. **Remote runtime integration** — the cloud mode connects out to a
   runtime/agent the customer runs anywhere (Mac mini, VPS, Docker,
   another cloud server) via API key + heartbeat.
3. **Embedded launcher** — the cloud mode embeds or links to an
   externally-hosted tool (read-only iframe with auth pass-through).
4. **Setup-needed state** — the surface is visible but truthfully
   labelled as requiring a one-time setup; the page shows the actual
   setup command.
5. **Not suitable for cloud** — the capability is local-only by design;
   the cloud mode displays a documented "use Baseline OS for this"
   pointer.

Blind iframing is disallowed.

---

## Direct runtime connection (Mode 2 must support this)

Mission Control (cloud) must accept direct runtime connections from
agents the customer runs anywhere. The supported set:

- Claude Code
- Codex CLI
- OpenClaw / OpenCode
- Hermes
- Ruflo
- Antigravity
- Google NotebookLM Agent
- Browser Use
- Maestro
- Any other supported runtime/agent

The cloud mode provides:

- Runtime API keys
- Remote connection commands
- Webhook / API registration
- Runtime heartbeat ingestion
- Task assignment
- Proof ingestion
- Tool execution receipts
- Approval queue
- Activity feed
- Billing / credit usage
- Marketplace purchases

A user must be able to point a runtime running on a local laptop, a Mac
mini, a VPS, a Docker container, or another cloud server at Mission
Control's API and have it work, without installing Baseline OS first.

---

## Optional sync between modes

If a customer is running both modes, Baseline OS may push events to
Mission Control. The contracts:

- `kanban.event.v1` — task lifecycle events (created, claimed, done,
  failed, approval_required, approval_decided).
- (Future) `proof.event.v1` — tool-execution proofs.
- (Future) `runtime.heartbeat.v1` — runtime liveness pings.

These are **outbound from Baseline OS, inbound to Mission Control**. If
the cloud endpoint is unreachable, Baseline OS keeps a local queue and
retries — it must not block local work.

Mission Control does not call Baseline OS. Cloud → local push is out of
scope by design.

---

## Flight Deck

Flight Deck is the desktop companion (Tauri 2 app). It connects to
**either** mode, selected at runtime:

- "Connect to local Baseline OS" — points at `http://localhost:8081`
  (or the operator's configured local port).
- "Connect directly to cloud Mission Control" — points at the customer's
  Mission Control tenant URL + runtime API key.

A single Flight Deck install can switch between modes per workspace.

---

## Billing implications

- **Mission Control cloud:** free platform access; no required monthly
  subscription; no setup fee. Customers pay only for AI/API usage
  credits and paid marketplace items.
- **Baseline OS local:** sold separately. Setup fees, monthly
  support / service, and done-for-you installation are Baseline OS
  offerings, not Mission Control offerings.

Pricing pages and marketing copy must reflect this split. The legacy
"Mission Control Starter $499/mo + $1,500 setup" framing is no longer
canonical and must be removed from the Mission Control surface.

---

## What this rule changes about engineering

When adding a new capability, ask in order:

1. Is this local-only by design (file system, hardware, private memory)?
   → Implement in Baseline OS; show a truthful "use Baseline OS for
   this" note in Mission Control. No iframe.
2. Can the cloud host it natively without security or cost issues?
   → Implement in Mission Control. Mirror the API contract in Baseline
   OS for parity.
3. Is the capability a runtime that the customer runs anywhere?
   → Build the cloud-side ingestion endpoint + heartbeat + API-key flow.
   Mode 1 customers can self-run the same runtime against Baseline OS.
4. Is the capability genuinely an embedded third-party tool?
   → Embed/launch with auth pass-through. Document it as such.

No surface should pretend to be connected when it isn't. No surface
should require the *other* mode to function.

---

## References

- Blueprint for current cycle:
  `~/code/claude-os/architecture/cycle-2026-06-backlog-of-7.md`
- Parity matrix:
  `~/code/mc-v8/docs/architecture/FEATURE_PARITY_MATRIX.md`
- Do-not-break list:
  `~/code/claude-os/execution/no-break-list.md`
