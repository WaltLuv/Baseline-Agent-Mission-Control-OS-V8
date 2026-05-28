# Baseline Stack — System Identity Alignment

> Where each product/service ends and the next one begins. This is the
> canonical doc when a feature could live in two places and we need to
> pick one.

## The 5 systems

| System | Role | Customer-facing surface |
| --- | --- | --- |
| **Baseline OS** | Brain · intelligence · reasoning · memory layers · scoring · recommendations | API only; rendered by Mission Control |
| **Mission Control** | Dashboard · supervision · billing · executive briefing · settings · marketplace storefront | Web app (Next.js) |
| **Hermes** | Brain runtime + optional operator runtime for the workforce | CLI / VPS / desktop |
| **OpenClaw** | Browser / tool / VPS / external-app operator | CLI / VPS / desktop |
| **Claude Code** | Engineering / code-builder employee | Desktop / CI |
| **Baseline Studios** | Workflow/spec creation layer for operators authoring new skills & employees | (future) authoring tool |

## Boundaries — who owns what

### Identity & personas → Baseline OS
- Codename, mission, personality, strengths
- Trust score, operational dimensions (style, tone, escalation, exec
  preference, memory profile)
- Computed deterministically from the agent record so the same employee
  always reads the same persona

### Dashboards & widgets → Mission Control
- Renders identity, briefing, billing, marketplace, settings.
- Does **not** invent identity or compute scores itself — it only
  displays what Baseline OS publishes.

### Execution → AI Employees (Hermes/OpenClaw/Claude Code/adapters)
- The agents actually call LLMs and tools.
- They phone home through the agent endpoints (see
  `docs/architecture/AGENT_PHONE_HOME.md`).

### Memory → Baseline OS (via connectors)
- Internal Workforce Memory (built-in)
- Operator Memory (Obsidian)
- Knowledge Intelligence (Pinecone)
- Business Knowledge Base (Notion)
- Mission Control surfaces these in `/app/settings/baseline-os-memory`
  and `/app/memory-feed` — but it doesn't index, embed, or query them
  directly. All retrieval goes through Baseline OS.

### Billing → Mission Control
- Stripe checkout, webhook verification, ledger, credit packages,
  retail markup, auto-reload — all in Mission Control.
- AI Employees report token usage; Baseline OS reads it to score cost
  efficiency. Mission Control charges credits and shows margin.

### Marketplace → Mission Control storefront, Baseline Studios authoring
- Mission Control renders `/marketplace`, handles `Hire AI Employee`,
  `Install Skill`, `Deploy Team` CTAs.
- Authoring & spec creation for new skills/employees lives in **Baseline
  Studios** (separate authoring app — not part of Mission Control).

### Daily Optimization, Workforce Health Score, Skills ROI → Baseline OS
- Computed by Baseline OS, displayed by Mission Control.
- Baseline OS attaches *why* + *expected impact* + *recommended action*
  to every recommendation.

## Customer-facing naming rules

| Internal name | Customer name |
| --- | --- |
| Agents | AI Employees |
| Tokens | Workforce Credits |
| Orchestration | Workflow Management |
| Claude OS (legacy) | **Baseline OS** |
| Sessions | Work sessions |
| Workspace | Operator Workspace |

## What we deliberately don't do across boundaries

- **Mission Control does NOT call LLMs in its UI surfaces.** Zero token
  cost to the dashboard. All LLM calls happen inside AI Employees.
- **Baseline OS does NOT render UI.** It is API-only. This keeps it
  embeddable from a future desktop shell (Tauri / Flight Deck) or a
  third-party Mission Control variant.
- **AI Employees do NOT mutate Mission Control state without phoning
  home.** Every state change is a workspace-scoped, audited API call.

## Reference

- `docs/architecture/AGENT_PHONE_HOME.md`
- `docs/architecture/BASELINE_OS_MEMORY_LAYERS.md`
- `docs/security/MEMORY_PRIVACY_MODEL.md`
- `docs/self-hosting/COST_AND_DEPLOYMENT.md`
