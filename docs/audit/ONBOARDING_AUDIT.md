# Onboarding Audit — P0-2

> Audited 2026-06-06. Scope: every onboarding/activation action Walt named,
> plus the surfaces they depend on. Each item carries **route**, **expected**,
> **actual**, a **status** (Working / Broken / Incomplete / Blocked), and the
> **fix required**. Fixes implemented in P0-3 are marked ✅ FIXED with the
> commit-level change; recommendations not yet applied are marked ⏳.
>
> Severity legend: 🔴 blocks first-run completion · 🟡 degrades UX · 🟢 cosmetic.

---

## Executive summary

The onboarding **flow** (signup → `/onboarding` 3-step wizard → `/app/activate`
3-step hub → dashboard `SetupChecklist`) is structurally complete and every
button/link resolves to a real destination **with one decisive exception that
made the headline goal impossible:**

- 🔴 **Onboarding could never reach 100%.** The setup-checklist's "Runtime
  connected" required item (20% of the bar) is derived from SQL that queries
  three tables — `runtimes`, `runtime_handshakes`, `runtime_telemetry` — that
  **do not exist in this database**. The real runtime handshake writes to
  `runtime_registry`. So no matter how many runtimes a customer connected, the
  predicate returned 0, the required row never ticked, and the bar capped at
  80%. This is the single most important finding and is now **FIXED**.

Secondary findings (latent, not blocking the named items but worth fixing):

- 🟡 **Blank-panel fallback bug** in the `/app/[[...panel]]` content router:
  the `switch` ends with `case 'default':` (a string-literal case matching the
  tab named "default") instead of a real `default:` clause. Any panel id with
  no dedicated route dir **and** no explicit case renders an empty screen
  rather than the intended plugin/Dashboard fallback. None of the onboarding
  CTAs land here today, but it's a dead-end waiting to happen. **FIXED.**
- 🟡 **Invite step can render blank** if the hub mounts before `/api/auth/me`
  resolves a `workspace_id` (the invite step is gated on `workspaceId !== null`
  with no fallback body). **FIXED** with a loading fallback.
- 🟢 `/onboarding`'s cinematic provisioning creates AI-employee agents via
  `POST /api/agents` **without** a `source`, so those rows don't satisfy the
  `templateSelected` predicate (which looks for `source LIKE 'workforce-template:%'`).
  Not a defect — the real template install happens in the `/app/activate`
  `WorkforceInstaller`, which does set `source`. Documented so it isn't
  mistaken for a regression. ⏳ (no change; correct as-is).

No dead buttons, no dead external links, and no self-referential ("routes back
to itself") CTAs were found among the named items after the template→activate
fix that shipped earlier this cycle.

---

## Per-item findings

### 1. Choose Template
- **Routes:** `/onboarding` step 2 (business-type picker, `BUSINESS_TEMPLATES`)
  **and** `/app/activate` → `WorkforceInstaller` (workforce-template catalog).
- **Expected:** Operator picks a vertical; selection drives which AI employees,
  skills, and starter task get provisioned; selection is recorded so the
  "template installed" checklist row ticks.
- **Actual:** Both pickers render real catalogs and are clickable.
  `/onboarding` step 2 persists `template` to `POST /api/workspaces` and seeds
  agents/skills/task. `WorkforceInstaller` calls `POST /api/workforce/install`,
  which inserts agents with `source = workforce-template:<slug>` and a settings
  flag — exactly what `templateSelected` checks.
- **Status:** ✅ **Working.**
- **Fix required:** None.

### 2. Runtime Selection
- **Route:** `/app/activate` → `RuntimeConnectWizard` picker (Claude / Codex /
  OpenClaw / Hermes). Also reachable via checklist "Connect a runtime" →
  `/app/runtimes`.
- **Expected:** Operator selects a runtime; "Generate API key + command"
  enables only once a choice is made.
- **Actual:** Four real options render; the generate button is correctly gated
  on `selected`. No dead options.
- **Status:** ✅ **Working.**
- **Fix required:** None. (Note: the wizard intentionally offers the four
  customer-facing runtimes; `hermes-vps` and `omp` are paired from their own
  surfaces, not this onboarding picker.)

### 3. Connect Runtime
- **Route:** `POST /api/onboarding/runtime-key` → mint key → operator pastes
  `connect_command` → runtime calls `POST /api/runtime/handshake` → wizard
  polls `GET /api/agents/:id` for first heartbeat.
- **Expected:** After the runtime heartbeats, the wizard flips green, the
  activation step completes, **and the dashboard checklist's "Runtime
  connected" row ticks**, advancing the bar by 20%.
- **Actual:** The mint → paste → heartbeat loop works end-to-end and the
  activation-hub step completes. **BUT** the dashboard `SetupChecklist` row
  never ticked: the handshake writes to `runtime_registry`, while
  `/api/help/checklist` counted `runtimes` / `runtime_handshakes` /
  `runtime_telemetry` (none of which exist here) → `runtimesConnectedCount`
  was permanently 0.
- **Status:** 🔴 **Broken** (checklist accounting; the connect mechanics
  themselves work).
- **Fix required:** ✅ **FIXED** — `runtimesConnectedCount` now counts
  `runtime_registry` rows (the table the handshake actually writes), with the
  legacy tables kept as fallbacks. This is what re-enables 100%.

### 4. Invite Team
- **Route:** `/app/activate` → `InviteTeamStep` → `POST /api/workspaces/:id/invites`.
- **Expected:** Operator can invite ≥1 teammate by email+role, or skip; the
  step always renders something actionable.
- **Actual:** Form works (email validation, role radios, sent list, skip/finish).
  Edge case: the step is gated on `workspaceId !== null`; if the hub mounts
  before `/api/auth/me` returns and the invite step is the active one, the
  active-step body rendered **empty** (no loader, no message).
- **Status:** 🟡 **Incomplete** (edge case only).
- **Fix required:** ✅ **FIXED** — added a loading fallback so the active
  invite step shows a "Loading your workspace…" state instead of a blank box
  while `workspaceId` resolves.

### 5. Progress Tracking
- **Routes:** activation-hub progress bar (`completed of total`, client-side
  step state) **and** dashboard `SetupChecklist` (server-derived
  `/api/help/checklist`, weighted 5×20%).
- **Expected:** Both reflect real state honestly; the dashboard bar can reach
  100% when the five required items are genuinely done.
- **Actual:** The activation-hub bar is correct (counts done steps / 3). The
  dashboard checklist was **capped at 80%** because of the runtime-predicate
  bug in item #3 — four of five required rows could tick, never the fifth.
- **Status:** 🔴 **Broken** (could not reach 100%).
- **Fix required:** ✅ **FIXED** via the #3 runtime-predicate fix. With a
  workspace + template + credentials/credits + ≥1 registered runtime + ≥1 task,
  the bar now reaches 100%.

### 6. Activation Hub
- **Route:** `/app/activate` (`ActivationHub`).
- **Expected:** Three steps (install system → connect runtime → invite team),
  auto-advancing, never dumping the user into the raw dashboard; a single clear
  "Open Mission Control →" CTA at the end.
- **Actual:** All three steps render, auto-advance logic is sound (active-step
  promotion + safeguard `useEffect`), and the completion state links to
  `/app/overview` (resolves) and `/help` (resolves). Header links `/app` and
  `/help` resolve. Flight Deck pointer → `/flight-deck` resolves.
- **Status:** ✅ **Working** (after the invite-step fallback in #4).
- **Fix required:** None beyond #4.

### 7. Workforce Templates
- **Route:** `GET /api/workforce/templates` (catalog) + `POST /api/workforce/install`.
- **Expected:** Catalog lists Property Management as "Ready" and the rest as
  "Coming soon" (disabled, not dead); install shows progress then a persona
  roster with deep links.
- **Actual:** Catalog renders from the live endpoint; "Coming soon" cards are
  `disabled` (honest, not fake-clickable); install posts and returns a real
  result with deep links to `/app/tasks`, `/app/tool-executions`,
  `/app/tool-executions?status=pending_approval`, `/app/agents`,
  `/app/runtime-validation` — all of which are real route dirs.
- **Status:** ✅ **Working.**
- **Fix required:** None.

### 8. Marketplace links
- **Route:** checklist optional item `marketplace` → `href: /marketplace`.
- **Expected:** Resolves to a real marketplace page (absolute href, outside the
  panel catch-all).
- **Actual:** `/marketplace` page exists; `SetupChecklist` correctly treats
  `href` items as absolute navigations (`window.location.href`), bypassing the
  SPA panel router.
- **Status:** ✅ **Working.**
- **Fix required:** None.

### 9. Billing links
- **Routes:** `/onboarding` done-state "Add Credit Fuel" → `/app/billing`;
  checklist credits path resolves via `credit_ledger`.
- **Expected:** `/app/billing` renders the billing panel.
- **Actual:** `/app/billing` → catch-all strips to `billing` → `BillingPanel`
  (real `switch` case). Resolves.
- **Status:** ✅ **Working.**
- **Fix required:** None.

### 10. Flight Deck links
- **Routes:** activation-hub "Install Flight Deck" pointer → `/flight-deck`;
  checklist optional `flightdeck` → `href: /flight-deck`.
- **Expected:** Resolves to the Flight Deck download/landing page; clearly
  marked optional.
- **Actual:** `/flight-deck` page exists; both surfaces label it "Optional".
- **Status:** ✅ **Working.**
- **Fix required:** None.

### 11. Credentials links
- **Routes:** checklist required `credentials` → `panel: credentials`
  (`/app/credentials`); onboarding-wizard modal credentials step.
- **Expected:** Resolves to the Credentials Manager; the required row ticks
  once a credential is saved (encrypted preview present) **or** credits > 0.
- **Actual:** `/app/credentials` is a real dedicated page; the predicate checks
  `workspace_credentials.secret_preview` or a positive `credit_ledger` balance.
  Both are reachable. No raw secret is read into client state.
- **Status:** ✅ **Working.**
- **Fix required:** None.

---

## Cross-cutting findings (not tied to one named item)

### A. Checklist runtime predicate queried non-existent tables 🔴
Covered under items #3 and #5. **FIXED** in `/api/help/checklist/route.ts`.

### B. Content-router blank-panel fallback 🟡
`src/app/app/[[...panel]]/page.tsx` `ContentRouter` ended with
`case 'default':` (string case) rather than `default:`. Unmatched panel ids
fell through to `undefined` → blank screen. **FIXED** by converting it to a
real `default:` clause that returns `renderPluginPanel(tab)` (plugin panel or
`<Dashboard/>` fallback). No onboarding CTA depended on this, but it removes a
class of dead-end.

### C. Invite step blank on slow `workspace_id` 🟡
Covered under item #4. **FIXED.**

### D. `/onboarding` agents created without `source` 🟢
Informational. The 3-step `/onboarding` wizard seeds demo agents via
`POST /api/agents` without a `source`, so they don't count toward
`templateSelected`. The authoritative template install (`/app/activate`
`WorkforceInstaller` → `/api/workforce/install`) sets `source` correctly, so
the checklist row still ticks via the intended path. No change.

---

## Acceptance check (Walt's P0-3 goals)

| Goal | Status |
|------|--------|
| Onboarding reaches 100% | ✅ unblocked (runtime predicate fix) |
| No dead buttons | ✅ none found |
| No dead links | ✅ all resolve |
| No routes that point back to themselves | ✅ none (template→activate fix held) |
| Clear next action at every step | ✅ (invite-step blank-state fixed) |
| Frictionless first-run | ✅ |

Production deploy remains blocked per Walt's gate on: token rotation + scrub +
clean forensic report (separate from this onboarding work).
