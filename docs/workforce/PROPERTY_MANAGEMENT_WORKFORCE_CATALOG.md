# Property Management Workforce Catalog

PM workforce grouped by team. Each role carries an execution level, default
runtime, tools, permissions, approval rules, and honest setup-needed states.
Runtime-dependent roles show **Needs Runtime** until connected. (Profiles:
`src/lib/agents/execution-model.ts`.)

## Executive (Level 2)
- COO / Operations Director, Portfolio Manager, Chief of Staff — oversight +
  approvals (approve_spend within delegated limit).

## Operations (Level 2 — Native Workflow Ready)
- Maintenance Dispatcher — work orders, vendors, comms, approvals, proof/replay.
- Vendor Coordinator — vendors, dispatch, invoices, proof/replay.
- Owner Relations — owner approvals, email, proof/replay.
- Leasing Coordinator, Resident Success Manager — comms + tasks.

## Finance (Level 2)
- Accounts Receivable, Accounts Payable, Budget Analyst, Asset Manager —
  ledgers/invoices/reports; **billing actions require approval**.

## AI Systems
- PI Agent — context harness (Ready; not the worker).
- Hermes / Claude Code / Codex / OpenClaw — **Level 3, Needs Runtime** until connected.
- VoiceOps / VisionOps / Market Swarm — **Level 3**, require the ecosystem app/runtime.

Autonomy is never overpromised: a role is only "Ready"/"Runtime Connected" when
its runtime + credentials are actually connected.
