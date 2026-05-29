# Multi-Tenant Activation — Audit Report

> P0 audit per user mandate: "Do not guess. Inspect the repo."
> Run date: 2026-05-29
> Auditor: E1

This document tells the truth about what exists, what's wired, and what's missing — before any code is changed.

---

## 1. What EXISTS in the database (real, present, populated)

| Table | Columns | Row count | Used by |
|-------|---------|-----------|---------|
| `users` | `id, username, display_name, password_hash, role, provider, provider_user_id, email, avatar_url, is_approved, approved_by, approved_at, workspace_id, last_login_at, created_at, updated_at` | 1 (admin) | `/api/auth/login`, `/api/auth/me` |
| `user_sessions` | `id, token, user_id, expires_at, ip_address, user_agent, workspace_id` | 97 | session validation |
| `workspaces` | `id, slug, name, tenant_id, created_at, updated_at` | 1 (default) | `/api/workspaces`, `lib/workspaces.ts` |
| `tenants` | `id, slug, display_name, linux_user, plan_tier, status, openclaw_home, workspace_root, gateway_port, dashboard_port, config, created_by, created_at, updated_at` | 1 | provisioning system (separate from SaaS workspaces) |
| `access_requests` | (Google approval queue) | 0 | `/api/auth/access-requests` |
| `settings` | key/value scoped via `user.<username>.<key>` | 6 | onboarding state, prefs |

**Tables that are scoped by `workspace_id` (verified migration 021/022/023):**
`users, user_sessions, tasks, agents, comments, activities, notifications, quality_reviews, standup_reports, skills, projects, tokens_usage, github_syncs, alert_rules, settings (some keys), credit_ledger, customer_subscriptions, …` — ~30+ tables.

So workspace-isolation columns **do** exist on most operational tables. That's real.

## 2. What EXISTS in source

| Surface | File | State |
|---------|------|-------|
| Single-admin setup page | `src/app/setup/page.tsx` | Working — creates the first admin when DB is empty |
| Login page | `src/app/login/page.tsx` | Working — username/password only |
| `/api/auth/login` | `src/app/api/auth/login/route.ts` | Working — local password |
| `/api/auth/google` | exists | Scaffolded — needs Google client ID/secret + redirect URI |
| `/api/auth/logout`, `/api/auth/me` | exists | Working |
| `/api/auth/access-requests` | exists | Working — Google approval queue |
| Workspaces API (`/api/workspaces`) | `src/app/api/workspaces/route.ts` | Working — admin-only |
| Onboarding wizard page | `src/app/onboarding/page.tsx` | Working — picks vertical, calls `/api/workspaces` |
| `/api/onboarding` (state tracking) | exists | Working — per-user setting keys |
| `lib/workspaces.ts` | exists | `listWorkspacesForTenant`, `createWorkspace`, `switchWorkspace` |
| Vertical templates | `src/lib/business-templates.ts` | All 9 verticals present |
| Workspace switcher UI | `src/components/layout/workspace-switcher.tsx` | Working — but only renders for admin |

## 3. What is NOT WIRED (the gaps)

| Gap | Severity | Why it matters |
|-----|----------|----------------|
| **No `/signup` page** for the Nth customer | P0 | The only signup flow is `/setup` which is "first admin ever" — once it runs, it disables itself. No way for a stranger to register. |
| **No `/api/auth/signup` endpoint** | P0 | Same as above. |
| **`users.workspace_id` is 1:1** | P0 | A user belongs to exactly ONE workspace. There is **no `workspace_memberships` table** for users-in-multiple-workspaces. |
| **`users.role` is global, not per-workspace** | P1 | Owner / admin / operator / viewer are stored once per user, not per workspace. So invite-as-admin-to-workspace-B is structurally impossible without a membership row. |
| **No invites table** | P0 | Cannot generate an invite token, accept it, and attach a user to a workspace with a role. |
| **No password reset table / endpoint** | P1 | "Forgot password" is wired in UI only — clicks go nowhere. |
| **Login key is `username`, not `email`** | P1 | `email` column exists but `authenticateUser()` looks up by `username`. Customers expect email-based login. |
| **Google OAuth not finished** | P1 | `provider`/`provider_user_id` columns exist; `/api/auth/google` is scaffolded; **the OAuth dance needs a real Google client ID/secret/redirect URI from the user**. |
| **Workspace switcher hidden for non-admin** | P2 | Even if multi-workspace membership existed, the UI gates the switcher behind `role: admin`. |
| **Stripe customer per workspace** | P1 | `customer_subscriptions` table exists and IS workspace-scoped — good — but the existing checkout flow doesn't create one on signup. |
| **No SMTP / Resend wiring** | P1 | Required for password reset emails and invite emails. No provider configured. |

## 4. The user's premise — "wired, just needs hooking up"

**Half-true.** Specifically:
- ✅ Workspace tables exist
- ✅ `workspace_id` columns exist on ~30 tables
- ✅ Onboarding wizard exists and writes to `workspaces` via `/api/workspaces`
- ✅ Vertical templates exist for all 9 verticals
- ❌ **There is no path for a stranger to become a customer.** `/setup` only fires once; `/login` requires an account; no `/signup` exists.
- ❌ **One user = one workspace** structurally (single FK column, no membership table).
- ❌ **Invites, password reset, Google OAuth finish, email-based login, per-workspace roles** — all require code, not just wiring.

## 5. Realistic execution plan

I'm proposing 4 phases. Phase 1 ships **this pass**. Phases 2-4 each need explicit go-aheads and (for some) external credentials.

### Phase 1 — Customer signup path (ship now, no external creds needed)

1. New `/signup` page (email + password + name + company + vertical)
2. New `/api/auth/signup` endpoint:
   - creates a workspace (uses existing `createWorkspace`)
   - creates a user with `role='owner'`, `provider='local'`, `workspace_id=<new>`, `email=<form>`
   - login uses `email` as identifier (alongside `username` for backward compat)
   - creates a session
   - returns redirect → `/onboarding`
3. Onboarding wizard already writes to the new workspace via `/api/workspaces` — verified.
4. Update login page to accept email OR username.
5. Update vitest to assert new flow.

**Acceptance:** a stranger can hit `/signup`, create an account + workspace, and land in onboarding without admin help.

### Phase 2 — Password reset + email-based identity (needs SMTP)

Requires: Resend API key OR SMTP credentials (host, port, user, password, from-address).

1. New `password_reset_tokens` table
2. `/forgot-password` page + `/api/auth/forgot-password`
3. `/reset-password` page + `/api/auth/reset-password`
4. Sends email via Resend / SMTP
5. Make `email` UNIQUE on users (after de-dup)

### Phase 3 — Google OAuth completion (needs Google credentials)

Requires: Google Cloud project + OAuth Client ID + Client Secret + authorised redirect URIs.

1. Wire `/api/auth/google` to the actual Google OAuth2 endpoints
2. Callback creates user with `provider='google'` if first login
3. Approval queue (`access_requests`) already wired — just exposes the new flow
4. Google sign-in button on signup + login pages

### Phase 4 — Invites + multi-workspace memberships (largest change)

Requires: Phase 2 (email) and a one-time data migration.

1. New `workspace_memberships(user_id, workspace_id, role, invited_by, joined_at)` table
2. New `invites(token, email, workspace_id, role, expires_at, used_by_user_id)` table
3. Migration: backfill memberships from `users.workspace_id`
4. New endpoints: `POST /api/workspaces/:id/invites`, `POST /api/invites/:token/accept`, `DELETE /api/invites/:id`
5. Members panel UI
6. Switch `requireRole()` to check **per-workspace** role from memberships
7. Workspace switcher visible to all users with >1 membership
8. Vitest: cross-workspace-leak tests, role permission tests

## 6. External credentials needed (cannot proceed past Phase 1 without these)

| Credential | Used by | Where to get it |
|-----------|---------|-----------------|
| **Resend API key** OR SMTP host/port/user/pass | Phase 2 password reset, Phase 4 invites | https://resend.com/api-keys (free tier OK) |
| **Google OAuth Client ID + Secret** | Phase 3 Google sign-in | https://console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 |
| **Google authorised redirect URI** | Phase 3 | `https://mission.baselineautomations.com/api/auth/google/callback` (and the preview URL during dev) |
| **Stripe live API key** | Workspace-scoped billing | Already configured in test mode; live key needed for first paying customer |

## 7. Destructive change warnings (need explicit approval)

| Change | Risk | Mitigation |
|--------|------|------------|
| Make `users.email` UNIQUE | Existing rows have `email IS NULL` for admin | Migration with conditional unique index where `email IS NOT NULL` |
| Allow `email` as login identifier | Could collide with usernames in edge cases | Lookup `email` first, fall back to `username` |
| Add `workspace_memberships` table | Doubles role storage; need to migrate from `users.workspace_id` + `users.role` | One-time backfill migration + dual-write period |
| Hide `/setup` once first admin exists | Already does this — verified | None |

---

## Bottom line

The repo is **not** a "wired multi-tenant system that needs hooking up." It is a **single-admin operator console with workspace-isolation columns on the data layer but no public signup, no invites, no password reset, no Google OAuth completion, and no multi-workspace membership**.

Phase 1 (customer signup → workspace → onboarding) is **doable in this pass** with no external dependencies and ~150 lines of new code on top of the existing tables and helpers. It produces a real "stranger becomes a customer" path.

Phases 2–4 require credentials from the operator and 2–5 days of focused work each. They cannot be silently shipped in one context.
