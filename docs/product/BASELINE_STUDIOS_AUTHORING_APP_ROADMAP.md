# Baseline Studios — Authoring App Roadmap

> Status: **Separate product.** NOT inside Mission Control. NOT inside
> Baseline OS. This document captures the canonical scope so future
> iterations of Mission Control never accidentally absorb authoring.

## What Baseline Studios is

The **AI workforce factory**. Where operators (and Emergent's own team)
*design* AI Employees, Skills, Workflows, Teams, Doctrines, and Marketplace
listings — and *publish* them as versioned, deployable manifests.

| Layer in the ecosystem | Owns |
| --- | --- |
| Mission Control | Supervise, bill, brief, share |
| Baseline OS | Reason, recommend, score, route memory |
| **Baseline Studios** | **Design, version, publish** |
| Marketplace | Distribute |
| AI Workforce | Execute |

Mission Control **consumes** Studios output. Studios never runs inside
Mission Control. Operators link out to a separate `studios.baseline.app`
deployment.

## Customer-facing language

- *Author an AI Employee.*
- *Design a Skill.*
- *Compose a Workflow.*
- *Publish to your Marketplace.*
- *Deploy to your Mission Control.*

Never: "build an agent", "code an automation", "edit a graph", "configure
a framework". Those are developer concepts.

## User journey

```
Studios:
  1. New AI Employee   → name, mission, personality, strengths, persona
  2. Attach Skills     → drag from skill library
  3. Define Workflow   → operator-grade canvas (no graph jargon)
  4. Set Memory rules  → which layers can be consulted
  5. Set Guardrails    → approvals, escalation, budget caps
  6. Choose Engine     → Hermes / OpenClaw / Claude Code / adapter
  7. Pricing           → monthly subscription or skill-install one-time
  8. Marketplace meta  → category, copy, screenshots, demo video
  9. Publish           → produces a versioned Manifest

Marketplace:
  10. Manifest listed at marketplace.baseline.app

Mission Control:
  11. Operator clicks "Hire" → deploys manifest version into workspace
  12. Baseline OS optimizes manifest behavior over time
  13. Studios shows operator-reported feedback to the author
```

## Manifest schema (v1)

```jsonc
{
  "manifest_version": "1.0",
  "kind": "ai-employee",                       // or "skill" | "workflow" | "team"
  "id": "ai-tax-document-organizer",
  "version": "1.4.0",
  "author": { "id": "...", "displayName": "Baseline Labs" },

  "identity": {
    "codename": "Athena",
    "mission": "Chase missing tax documents without your team's time.",
    "personality": "Calm. Persistent. Owner-facing copy is plain-spoken.",
    "strengths": ["document-chase", "deadline-pressure", "outreach-cadence"],
    "avatar": "📄"
  },

  "skills": [
    { "id": "document-chase",       "version": ">=1.0" },
    { "id": "sms-outbound",         "version": ">=1.0" },
    { "id": "email-followup",       "version": ">=1.0" }
  ],

  "workflows": [
    { "id": "q1-w2-collection",     "version": "1.0" }
  ],

  "memory_behavior": {
    "consults":  ["internal", "obsidian", "notion", "pinecone"],
    "writes_to": ["internal"],
    "respect_operator_only": true
  },

  "execution_engine": {
    "preferred": "openclaw",
    "fallback":  ["hermes", "claude-code"],
    "adapters_allowed": ["crewai", "langgraph", "autogen"]
  },

  "guardrails": {
    "approval_threshold_usd": 400,
    "escalate_on": ["compliance-flag", "delta>500"],
    "budget_cap_monthly_credits": 50000
  },

  "quality_gates": [
    { "name": "owner-tone-check",   "threshold": 0.85 },
    { "name": "compliance-scan",    "threshold": 1.0 }
  ],

  "billing": {
    "model": "subscription",
    "monthly_price_usd": 250,
    "marketplace_category": "CPA",
    "value_prop": "Recovers ~5 staff-hours/week chasing tax docs."
  },

  "marketplace_metadata": {
    "summary":     "Chases missing W-2s, 1099s, K-1s with zero staff time.",
    "screenshots": ["s3://...screen1.png"],
    "demo_video":  "https://...",
    "categories":  ["CPA", "Document-collection"],
    "language":    "en"
  },

  "deployment_config": {
    "auto_seed_starter_tasks": true,
    "default_workspace_tier":  "operator",
    "supported_regions":       ["us-east-1", "eu-west-1"]
  }
}
```

## Marketplace publishing flow

1. Studios POSTs a signed manifest to
   `marketplace.baseline.app/api/manifests/publish`.
2. Marketplace registers a new version row, links artifacts, builds a
   storefront card.
3. Mission Control's marketplace UI is **a thin reader** of this registry
   — no authoring inside Mission Control.

## Mission Control deployment flow

1. Operator clicks **Hire AI Employee**.
2. Mission Control calls
   `POST /api/marketplace/purchase` with the manifest ID + version.
3. Mission Control's *deployment runner* (already shipped in iter 13)
   provisions an agent row, attaches default skills/workflows from the
   manifest, queues a starter task.
4. Baseline OS starts collecting optimization signals and feeds them
   back to Studios via the *manifest feedback channel* (TBD).

## Baseline OS optimization loop

After a manifest is deployed and running:

- **Optimization phone-home** (`POST /api/optimization/report`) already
  records bottleneck / underused / overloaded / roi / cost / risk signals.
- Baseline OS aggregates these per `manifest_id + version` and pushes a
  daily diff to Studios:
  ```jsonc
  {
    "manifest_id": "ai-tax-document-organizer",
    "version":     "1.4.0",
    "deployments": 47,
    "avg_workforce_health":  78,
    "common_blockers":       ["partner-approval-latency"],
    "suggested_doctrine_updates": [
      "Reconciliation threshold should escalate at $300, not $500."
    ]
  }
  ```
- Studios surfaces these in the manifest editor → author can ship v1.5.

## MVP scope (the only build that needs to land)

The minimum Studios product that makes the Mission Control story
complete:

1. **Manifest editor (JSON-first).** No fancy canvas yet. Just the
   schema above with validation + diff.
2. **Sign + publish to marketplace.**
3. **Read deployment count + optimization diff.**

That's it. Visual workflow canvas, drag-and-drop skills, persona
generator, etc., are all **post-MVP**.

## Post-MVP roadmap

- Workflow canvas (operator-grade, hides graph jargon)
- Persona generator (auto-derive codename + mission from job description)
- Live preview against a sandbox workspace
- Versioned manifest diff with rollout controls
- Manifest marketplace-pricing experimentation tools
- Operator review surface for manifest feedback

## What Studios MUST NOT become

- Not a code editor.
- Not a graph-debugging UI.
- Not a place customers see CrewAI / LangGraph / AutoGen / framework
  internals.
- Not part of Mission Control. Always a separate deploy.

## Placeholder in Mission Control today

Mission Control currently surfaces a single link
(`/app/marketplace?from=studios-link`) pointing prospective authors to
the standalone Studios deployment. That's the entire footprint of
Studios inside Mission Control. **Do not expand it.**
