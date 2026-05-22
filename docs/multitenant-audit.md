# Multi-Tenant Integrity Audit — Mission Control V2

**Date:** 2026-05-22
**Scope:** All 47 API route files, workspace isolation, auth boundaries, data leakage prevention

---

## EXECUTIVE SUMMARY

**Routes audited:** 47 (+ sub-routes)
**Workspace-scoped:** ~30 routes (64%)
**Publicly accessible (no workspace filter needed):** 7 routes
**Review required:** 10 routes

**Key Finding:** Most tenant data routes correctly filter by `workspace_id` (151 workspace-aware queries found). A subset of routes query system-level data (settings, skills, sessions) that are either auth-gated or intentionally workspace-agnostic.

---

## ROUTE CLASSIFICATION

### Classification Key
| Symbol | Meaning |
|--------|---------|
| ✅ | Workspace-scoped & auth-gated (tenant-safe) |
| 🔒 | Auth-gated but system-level (no workspace filter needed) |
| ⚠️ | Review required — may need workspace scoping |
| ⚠️🔴 | Potential data leakage — needs immediate fix |

### Route-by-Route Audit

| Route | Workspace Filter | Auth Required | Classification | Notes |
|-------|-----------------|---------------|----------------|-------|
| `/api/agents` | ✅ `WHERE workspace_id = ?` | Auth | ✅ | All CRUD ops scoped correctly |
| `/api/agents/[id]` | ✅ `WHERE workspace_id = ?` | Auth | ✅ | Per-agent access controlled |
| `/api/agents/register` | ✅ `workspace_id` in payload | Public | ✅ | Registration includes workspace |
| `/api/agents/[id]/soul` | ✅ `WHERE workspace_id = ?` | Auth | ✅ | Soul content scoped |
| `/api/agents/[id]/diagnostics` | ✅ `workspaceId` context | Auth | ✅ | Diagnostics scoped |
| `/api/agents/[id]/hide` | ✅ `workspace_id` context | Auth | ✅ | — |
| `/api/tasks` | ✅ `WHERE workspace_id = ?` | Auth | ✅ | All CRUD scoped correctly |
| `/api/tasks/[id]` | ✅ `workspaceId` context | Auth | ✅ | Per-task access controlled |
| `/api/tasks/[id]/comments` | ✅ `workspaceId` context | Auth | ✅ | Comments scoped |
| `/api/tasks/[id]/broadcast` | ✅ `workspaceId` context | Auth | ✅ | — |
| `/api/tasks/[id]/branch` | ✅ `workspaceId` context | Auth | ✅ | — |
| `/api/tasks/queue` | ✅ `WHERE workspace_id = ?` | Auth | ✅ | Queue scoped |
| `/api/tasks/outcomes` | ✅ `workspaceId` context | Auth | ✅ | — |
| `/api/tasks/regression` | ✅ `workspaceId` context | Auth | ✅ | — |
| `/api/activities` | ✅ `workspaceId` | Auth | ✅ | Activity feed scoped |
| `/api/workflows` | ✅ `WHERE workspace_id = ?` | Auth | ✅ | Workflow templates scoped |
| `/api/quality-review` | ✅ `workspaceId` | Auth | ✅ | Reviews scoped |
| `/api/alerts` | ✅ `WHERE workspace_id = ?` | Auth | ✅ | Alert rules scoped |
| `/api/security-audit` | ✅ `workspaceId` | Auth | ✅ | Audit data scoped |
| `/api/notifications` | ✅ `workspaceId` | Auth | ✅ | Notifications scoped |
| `/api/notifications/deliver` | ✅ `workspaceId` | Auth | ✅ | Delivery scoped |
| `/api/tokens` | ✅ `workspaceId` | Auth | ✅ | Token usage scoped |
| `/api/tokens/by-agent` | ✅ `workspaceId` | Auth | ✅ | — |
| `/api/status` | Public | None | 🔒 | System status, no tenant data |
| `/api/workspaces` | ✅ N/A | Auth | ✅ | Workspace CRUD (admin) |
| `/api/workspaces/[id]` | ✅ By ID | Auth | ✅ | Workspace access |
| `/api/workload` | ✅ `workspaceId` | Auth | ✅ | Workload metrics scoped |
| `/api/v1/runs` | ✅ `workspaceId` | API Key | ✅ | V1 runs scoped |
| `/api/v1/runs/[run_id]` | ✅ `workspaceId` | API Key | ✅ | — |
| `/api/v1/runs/[run_id]/eval` | ✅ `workspaceId` | API Key | ✅ | — |
| `/api/v1/runs/[run_id]/provenance` | ✅ `workspaceId` | API Key | ✅ | — |
| `/api/v1/evals/leaderboard` | ✅ `workspaceId` | API Key | ✅ | — |
| `/api/connect` | Auth | Auth | 🔒 | Connection handshake |
| `/api/hermes/events` | Auth | Auth | 🔒 | Event streaming |
| `/api/setup` | ⚠️ | None | ⚠️ | Initial setup — intentionally open |
| `/api/onboarding` | None | None | 🔒 | Setup data (pre-auth) |

### Routes Without Explicit workspace_id Filter

| Route | Should Filter? | Assessment | Fix Needed? |
|-------|---------------|------------|-------------|
| `/api/settings` | ❌ No | System-level settings store (key-value pairs like language, theme) | No — system config, not tenant data |
| `/api/skills` | ⚠️ Maybe | Skills are shared across workspace but disk-synced. Install/delete affects all tenants | Review — skills should be workspace-scoped for installation tracking |
| `/api/sessions` | ⚠️ Maybe | Reads gateway sessions. May include data from other workspaces if multiple gateways | Review — consider workspace filtering if multi-gateway |
| `/api/audit` | ⚠️ Maybe | Reads audit_log table. Should filter by workspace_id | ⚠️🔴 **FIX NEEDED** — audit log is tenant-specific |
| `/api/claude/sessions` | ⚠️ Maybe | Reads Claude Code session files from local filesystem | Review — filesystem paths may be shared |
| `/api/memory/graph` | ⚠️ Maybe | Reads memory files from disk. May include shared memory files | Review — memory should be workspace-scoped |
| `/api/auth/access-requests` | ❌ No | System-level access requests, not tenant-specific | No — access management is platform-level |
| `/api/gateways/connect` | Auth | Auth-gated gateway connection test | No — gateway is shared infrastructure |
| `/api/gateways/health` | Auth | Gateway health check | No — system health, not tenant data |
| `/api/super/*` | Admin only | Super admin routes, admin-only | 🔒 Gated by role check |
| `/api/diagnostics` | Auth | System diagnostics, no tenant data | No — system-level |
| `/api/tokens/rotate` | Auth | Auth key rotation | No — system key management |
| `/api/chat/session-prefs` | Auth | Chat preferences, may need workspace scope | ⚠️ Review |
| `/api/sessions/transcript` | Auth | Session transcripts, may leak across workspaces | ⚠️ Review — transcripts could be workspace-scoped |

---

## CRITICAL FIXES REQUIRED

### 1. `/api/audit` — Audit Log Not Workspace-Scoped 🔴
**Impact:** A customer on workspace B could see audit events from workspace A.
**Fix:** Add `WHERE workspace_id = ?` to the audit_log query.
**File:** `src/app/api/audit/route.ts`

### 2. `/api/skills` — Skill Installation Not Workspace-Scoped ⚠️
**Impact:** Skills installed by one workspace appear for all tenants.
**Fix:** Track skill installations per-workspace in DB, not just on disk.
**File:** `src/app/api/skills/route.ts`

### 3. `/api/sessions/transcript` — Session Transcript Scope ⚠️
**Impact:** Session transcripts could be readable across workspace boundaries.
**Fix:** Filter sessions by the user's workspace during transcript aggregation.
**File:** `src/app/api/sessions/transcript/aggregate/route.ts`

---

## AUTH MIDDLEWARE ANALYSIS

The application uses a consistent auth pattern across API routes:

```typescript
import { requireAuth } from '@/lib/auth'
const auth = await requireAuth(req)
const workspaceId = auth.user.workspace_id ?? 1
```

**Auth coverage:** ~95% of routes require authentication via `requireAuth()`.
**Public routes:** `/api/setup`, `/api/status`, `/api/onboarding`, `/api/agents/register` (registration intentionally public).
**API key routes:** `/api/v1/*` routes accept Bearer token API keys.

**Auth weaknesses identified:**
1. No rate limiting on auth endpoints (`/api/auth/*`)
2. Setup endpoint (`/api/setup`) has no check if setup already completed
3. No CSRF protection on cookie-based auth

---

## WORKSPACE_ISOLATION VERIFICATION

**Data separation model:** All tenant data is logically separated via `workspace_id` foreign key on every business table.
**Tables with workspace_id:** agents, tasks, activities, workflows, quality_reviews, alerts, notifications, token_usage, pipeline_runs, agent_runs
**Tables without workspace_id:** settings, skills (disk-based), memory files (disk-based), sessions (gateway-managed), audit_log (SHOULD have), user_accounts

**Migration recommendation:** Add `workspace_id INTEGER` column to `audit_log`, `memory_links`, `claude_sessions`, and any table that stores per-tenant data without workspace scoping.

---

## RECOMMENDATIONS

1. **Immediate:** Add workspace_id filter to `/api/audit` route
2. **Short-term:** Add workspace scoping to skills installation tracking
3. **Medium-term:** Implement CSRF tokens for cookie-based auth
4. **Long-term:** Consider physical data separation (separate DB per workspace) for enterprise customers with compliance requirements (SOC2, HIPAA)
