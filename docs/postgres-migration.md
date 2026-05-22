# PostgreSQL Migration Audit

> **Phase 5.1: PostgreSQL Readiness Assessment**
> Date: 2026-05-22
> Repo: baseline-united-mission-control
> Current DB: SQLite (better-sqlite3)
> Target DB: PostgreSQL 16+

---

## 1. Executive Summary

The Mission Control application currently uses **better-sqlite3** (synchronous, single-file) with **47 tables** across 50 migrations. The schema migration path to PostgreSQL is **straightforward with moderate effort** — most conversions are type-level changes. The biggest challenges are:

1. **`lastInsertRowid` API** — used extensively across route handlers (replaced by `RETURNING id`)
2. **FTS5 virtual table** — SQLite-specific full-text search (replaced by `pg_trgm` + GIN index)
3. **`unixepoch()` / `datetime('now')` functions** — PostgreSQL uses `EXTRACT(EPOCH FROM NOW())` / `NOW()`
4. **`PRAGMA table_info()` schema introspection** — used heavily in migrations for column existence checks
5. **`sqlite_master` queries** — for table existence checks (replaced by `pg_catalog`)
6. **`INSERT OR IGNORE` / `INSERT OR REPLACE`** — replaced by `INSERT ... ON CONFLICT`
7. **Better-sqlite3 PRAGMA settings** — replaced by PostgreSQL GUC / connection config

---

## 2. SQLite-Specific Patterns Found

### 2.1 High-Priority (Blockers Without Translation)

| Pattern | Occurrences | PostgreSQL Replacement |
|---------|-------------|----------------------|
| `lastInsertRowid` result property | 20+ usages across route handlers | `RETURNING id` clause, read inserted ID directly |
| `INSERT OR IGNORE INTO ...` | 3 locations | `INSERT INTO ... ON CONFLICT DO NOTHING` |
| `INSERT OR REPLACE INTO ...` | 3 locations | `INSERT INTO ... ON CONFLICT ... DO UPDATE` |
| `PRAGMA table_info(table)` | 30+ checks in migrations.ts | `information_schema.columns` query |
| `PRAGMA` settings (journal_mode, synchronous, etc.) | 5 lines in db.ts | Connection string params `?options=-c%20...` |
| `PRAGMA foreign_keys = ON` | 1 line | PostgreSQL always enforces FKs |
| `PRAGMA integrity_check` | 1 in security-scan.ts | `pg_catalog` + application-level checks |
| `sqlite_master` table queries | 4 locations | `information_schema.tables` or `pg_class` |
| `datetime('now')` | 3 (skills table) | `NOW()` or `CURRENT_TIMESTAMP` |
| `unixepoch()` function | 200+ as defaults in SQL | `(EXTRACT(EPOCH FROM NOW()))::BIGINT` |
| `fts5` virtual table | 1 (memory_fts) | `pg_trgm` extension + GIN index on `tsvector` |

### 2.2 Medium-Priority (Type/Behavior Changes)

| Pattern | Occurrences | PostgreSQL Replacement |
|---------|-------------|----------------------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | 43 tables | `SERIAL` or `GENERATED ALWAYS AS IDENTITY` |
| `INTEGER NOT NULL DEFAULT 1` (boolean) | 8 columns | `BOOLEAN NOT NULL DEFAULT TRUE` |
| `INTEGER NOT NULL DEFAULT 0` (boolean) | 6 columns | `BOOLEAN NOT NULL DEFAULT FALSE` |
| `TEXT` columns storing JSON | 30+ columns | `JSONB` (enables `->`, `->>` operators) |
| `INTEGER` columns for Unix timestamps | 150+ columns | `BIGINT` (epoch-compatible, same semantics) |
| `REAL` columns | 10+ columns | `REAL` / `DOUBLE PRECISION` (same) |
| Partial indexes with `WHERE` clause | 4 indexes (already PG-compatible) | Same syntax (both support) |
| `ALTER TABLE ADD COLUMN` | 40+ columns across migrations | Same syntax (both support) |
| `ALTER TABLE RENAME TO` + recreate | 1 (workspaces in migration 029) | Same approach or single `ALTER CONSTRAINT` |

### 2.3 Low-Priority (Minor Adjustments)

| Pattern | Occurrences | PostgreSQL Replacement |
|---------|-------------|----------------------|
| `CREATE TABLE IF NOT EXISTS` | 47 tables | Same (PostgreSQL supports) |
| `CREATE INDEX IF NOT EXISTS` | 95 indexes | Same (PostgreSQL 9.5+ supports) |
| `UNIQUE()` inline constraints | 20 constraints | Same |
| `FOREIGN KEY ... ON DELETE` | 20 FKs | Same |
| `COALESCE()` function | 15+ locations | Same |
| `json_extract()` in migration 028 | 3 calls | `metadata->>'field'` (JSONB operator) |
| `CAST(... AS INTEGER)` | 3 calls | `::INTEGER` |

---

## 3. Complete Table Inventory (47 Tables)

### A. Core Entities (schema.sql — 9 tables)

| # | Table | PK | Key Columns | Notes |
|---|-------|----|-------------|-------|
| 1 | `tasks` | `SERIAL` | status, priority, workspace_id, project_id | 25 columns; JSONB for tags/metadata; GitHub sync columns; partial indexes |
| 2 | `agents` | `SERIAL` | name (unique), status, workspace_id | 19 columns; config as JSONB; dynamic columns (source, hidden, working_memory, runtime_type) |
| 3 | `comments` | `SERIAL` | task_id (FK), parent_id (self-FK), workspace_id | Self-referencing; mentions as JSONB |
| 4 | `activities` | `SERIAL` | type, entity_type, entity_id, workspace_id | Event log; data as JSONB |
| 5 | `notifications` | `SERIAL` | recipient, type, workspace_id | 10 columns; read_at tracking |
| 6 | `task_subscriptions` | `SERIAL` | task_id (FK), agent_name, UNIQUE(task_id, agent_name), workspace_id | Join table |
| 7 | `standup_reports` | `TEXT` (date) | date, report (JSONB), workspace_id | Date-based primary key |
| 8 | `quality_reviews` | `SERIAL` | task_id (FK), reviewer, workspace_id | Status: approved/rejected |
| 9 | `gateway_health_logs` | `SERIAL` | gateway_id, status, probed_at | No workspace_id (cross-workspace) |

### B. Communication & Messaging (migrations 004, 008, 016) — 4 tables

| # | Table | PK | Key Columns | Notes |
|---|-------|----|-------------|-------|
| 10 | `messages` | `SERIAL` | conversation_id, from_agent, to_agent, workspace_id | 10 columns; metadata as JSONB |
| 11 | `webhooks` | `SERIAL` | url, events (JSONB), enabled (BOOLEAN), workspace_id | Circuit breaker (consecutive_failures) |
| 12 | `webhook_deliveries` | `SERIAL` | webhook_id (FK), event_type, payload, workspace_id | Retry tracking (attempt, next_retry_at, is_retry, parent_delivery_id) |
| 13 | `direct_connections` | `SERIAL` | agent_id (FK), connection_id (unique), workspace_id | Tool connections; metadata as JSONB |

### C. User & Auth (migrations 005, 014, 043) — 2 tables

| # | Table | PK | Key Columns | Notes |
|---|-------|----|-------------|-------|
| 14 | `users` | `SERIAL` | username (unique), role, workspace_id | OAuth columns (provider, provider_user_id, email, avatar_url); approval flow |
| 15 | `user_sessions` | `SERIAL` | token (unique), user_id (FK), workspace_id, tenant_id | SHA-256 hashed tokens (migration 043) |

### D. Projects & Workflows (migrations 006, 009, 024, 027) — 5 tables

| # | Table | PK | Key Columns | Notes |
|---|-------|----|-------------|-------|
| 16 | `workflow_templates` | `SERIAL` | name, model, workspace_id, tags (JSONB) | Timeout, use_count tracking |
| 17 | `workflow_pipelines` | `SERIAL` | name, steps (JSONB array), workspace_id | Pipeline orchestration |
| 18 | `pipeline_runs` | `SERIAL` | pipeline_id (FK), status, workspace_id | Execution history |
| 19 | `projects` | `SERIAL` | name, slug, ticket_prefix, workspace_id | 16 columns; GitHub sync columns; UNIQUE(workspace_id, slug) |
| 20 | `project_agent_assignments` | `SERIAL` | project_id (FK), agent_name, UNIQUE(project_id, agent_name) | Role assignments |

### E. Multi-Tenant / Provisioning (migrations 012, 029) — 4 tables

| # | Table | PK | Key Columns | Notes |
|---|-------|----|-------------|-------|
| 21 | `tenants` | `SERIAL` | slug (unique), linux_user (unique), status | config as JSONB; owner_gateway; gateway/dashboard ports |
| 22 | `provision_jobs` | `SERIAL` | tenant_id (FK), job_type, status | dry_run BOOLEAN; request_json/plan_json/result_json as JSONB |
| 23 | `provision_events` | `SERIAL` | job_id (FK), level, message, data (JSONB) | Event log per provision job |
| 24 | `workspaces` | `SERIAL` | slug (unique), tenant_id (FK) | Rebuilt via RENAME+recreate in migration 029 to add FK constraint |

### F. Infrastructure & Integrations (migrations 010, 017, 018, 020, 041, 032) — 7 tables

| # | Table | PK | Key Columns | Notes |
|---|-------|----|-------------|-------|
| 25 | `settings` | `TEXT` (key) | key, value, category | K/V store; Receipt signing keys stored here |
| 26 | `github_syncs` | `SERIAL` | repo, status, workspace_id, project_id | Sync history; changes_pushed/changes_pulled counters |
| 27 | `token_usage` | `SERIAL` | model, session_id, workspace_id | Cost tracking; task_id/agent_name/cost_usd (added later) |
| 28 | `claude_sessions` | `SERIAL` | session_id (unique), project_slug | Active session tracking; is_active BOOLEAN; partial index |
| 29 | `gateway_health_logs` | `SERIAL` | gateway_id, status, probed_at | Also created in schema.sql (duplicate definition via migration 041) |
| 30 | `gateways` | `SERIAL` | name (unique), host, port, status | Lazily created via ensureTable() in API routes; is_primary BOOLEAN |
| 31 | `adapter_configs` | `SERIAL` | workspace_id (FK), framework, UNIQUE(workspace_id, framework) | config as JSONB; enabled BOOLEAN |

### G. Security & Audit (migrations 007, 011, 035, 037, 050) — 6 tables

| # | Table | PK | Key Columns | Notes |
|---|-------|----|-------------|-------|
| 32 | `audit_log` | `SERIAL` | action, actor, actor_id, created_at | General audit trail |
| 33 | `alert_rules` | `SERIAL` | name, enabled (BOOLEAN), entity_type, workspace_id | Condition-based alerts; action_config JSONB |
| 34 | `api_keys` | `SERIAL` | user_id, key_hash (unique), workspace_id | 16 columns; dropped & recreated in 035; scopes JSONB |
| 35 | `security_events` | `SERIAL` | event_type, severity, workspace_id, tenant_id | 10 columns |
| 36 | `agent_trust_scores` | `SERIAL` | agent_name, workspace_id, UNIQUE(agent_name, workspace_id) | Trust scoring with multiple counter columns |
| 37 | `mcp_call_log` | `SERIAL` | agent_name, mcp_server, tool_name, workspace_id | Receipt signing (payload_hash, signature, public_key) |

### H. Evaluation & Testing (migrations 038) — 3 tables

| # | Table | PK | Key Columns | Notes |
|---|-------|----|-------------|-------|
| 38 | `eval_runs` | `SERIAL` | agent_name, eval_layer, workspace_id | 8 columns; detail as JSONB; passed BOOLEAN |
| 39 | `eval_golden_sets` | `SERIAL` | name, workspace_id, UNIQUE(name, workspace_id) | entries as JSONB array |
| 40 | `eval_traces` | `SERIAL` | agent_name, task_id, workspace_id | trace as JSONB; convergence metrics |

### I. Agent Identity & Runtime (migrations 033, 040, 044, 046) — 5 tables

| # | Table | PK | Key Columns | Notes |
|---|-------|----|-------------|-------|
| 41 | `skills` | `SERIAL` | name, source, UNIQUE(source, name), registry_slug | installed_at/updated_at as TIMESTAMPTZ (not BIGINT!) |
| 42 | `agent_api_keys` | `SERIAL` | agent_id, key_hash, workspace_id, UNIQUE(workspace_id, key_hash) | scopes JSONB; revoke tracking |
| 43 | `spawn_history` | `SERIAL` | agent_id (FK), agent_name, status, workspace_id | Process spawn tracking |
| 44 | `runs` | `TEXT` (id) | agent_id (text), status, workspace_id | UUID-like string primary key! Not SERIAL; extensive provenance fields |
| 45 | `access_requests` | `SERIAL` | email, provider (unique combo), status | OAuth approval flow; approved_user_id FK to users |

### J. Search & Special (migrations 048) — 2 tables

| # | Table | PK | Key Columns | Notes |
|---|-------|----|-------------|-------|
| 46 | `memory_fts` | FTS5 virtual | path, title, content | **SQLite FTS5** — requires pg_trgm GIN replacement |
| 47 | `memory_fts_meta` | TEXT (key) | key, value | K/V for FTS index metadata |

### K. Migration Tracking — 1 table

| # | Table | PK | Key Columns | Notes |
|---|-------|----|-------------|-------|
| 48 | `schema_migrations` | TEXT (id) | id, applied_at | Tracks applied migration IDs |

---

## 4. Column-Level SQLite → PostgreSQL Conversion Map

| SQLite | PostgreSQL | Notes |
|--------|-----------|-------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` | Auto-increment; 95% match |
| `TEXT` | `TEXT` | Direct match |
| `TEXT` (storing JSON) | `JSONB` | Enables operators, indexing |
| `INTEGER` (timestamps/epoch) | `BIGINT` | Same range, clearer intent |
| `INTEGER NOT NULL DEFAULT 1` (boolean) | `BOOLEAN NOT NULL DEFAULT TRUE` | Better type safety |
| `INTEGER NOT NULL DEFAULT 0` (boolean) | `BOOLEAN NOT NULL DEFAULT FALSE` | Better type safety |
| `REAL` | `REAL` or `DOUBLE PRECISION` | Direct match |
| `datetime('now')` | `NOW()` or `CURRENT_TIMESTAMP` | TIMESTAMPTZ columns |
| `unixepoch()` | `(EXTRACT(EPOCH FROM NOW()))::BIGINT` | Preserves epoch int semantics |
| `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` | Different syntax |
| `INSERT OR REPLACE` | `INSERT ... ON CONFLICT ... DO UPDATE` | Different syntax |
| `FTS5 virtual table` | GIN index on tsvector/pg_trgm | Different subsystem |
| `PRAGMA journal_mode = WAL` | Connection: `?options=-c%20synchronous...` | GUC params |
| `PRAGMA foreign_keys = ON` | Not needed (always enforced) | PG default |

---

## 5. Code-Level Changes Required

### 5.1 `lastInsertRowid` → `RETURNING id`

**Current (SQLite / better-sqlite3):**
```ts
const result = stmt.run(...args);
const id = Number(result.lastInsertRowid);
```

**PostgreSQL (node-postgres / pg):**
```ts
const result = await client.query(`INSERT INTO tasks (...) VALUES (...) RETURNING id`, [...args]);
const id = result.rows[0].id;
```

**Affected files** (20+ locations):
- `src/lib/db.ts` (db_helpers.logActivity, createNotification)
- `src/lib/mcp-audit.ts`
- `src/lib/auth.ts`
- `src/lib/super-admin.ts` (4 locations)
- `src/app/api/webhooks/route.ts`
- `src/app/api/chat/messages/route.ts` (2 locations)
- `src/app/api/gateways/route.ts`
- `src/app/api/super/os-users/route.ts`
- `src/app/api/super/provision-jobs/route.ts`
- `src/lib/recurring-tasks.ts`

### 5.2 `PRAGMA table_info()` → `information_schema.columns`

**Current:**
```ts
const cols = db.prepare(`PRAGMA table_info(tenants)`).all() as Array<{ name: string }>;
const hasCol = (name: string) => cols.some((c) => c.name === name);
```

**PostgreSQL:**
```ts
const result = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
  ['tenants']
);
const hasCol = (name: string) => result.rows.some((r: any) => r.column_name === name);
```

### 5.3 `sqlite_master` → `pg_class` / `information_schema.tables`

**Current:**
```ts
db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get('tenants')
```

**PostgreSQL:**
```ts
await client.query(
  `SELECT table_name FROM information_schema.tables WHERE table_name = $1 AND table_schema = 'public'`,
  ['tenants']
);
```

### 5.4 `INSERT OR REPLACE` → `UPSERT`

**Current:**
```ts
INSERT OR REPLACE INTO memory_fts_meta (key, value) VALUES (?, ?)
```

**PostgreSQL:**
```ts
INSERT INTO memory_fts_meta (key, value) VALUES ($1, $2)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
```

### 5.5 `db.pragma(...)` → PostgreSQL connection config

Replace in `db.ts` init:
```
PRAGMA journal_mode = WAL       → Connection: synchronous=off (or set via GUC)
PRAGMA synchronous = NORMAL     → Connection parameter
PRAGMA cache_size = 1000        → connection pool settings (pgBouncer)
PRAGMA foreign_keys = ON        → Always enforced in PG (remove)
PRAGMA busy_timeout = 5000      → statement_timeout on connection
```

### 5.6 FTS5 → pg_trgm

**Current:**
```sql
CREATE VIRTUAL TABLE memory_fts USING fts5(path, title, content, tokenize='porter unicode61')
SELECT * FROM memory_fts WHERE memory_fts MATCH 'search term'
```

**PostgreSQL:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_memory_fts_trgm ON memory_fts USING GIN(title gin_trgm_ops, content gin_trgm_ops);
-- Or use tsvector with GIN index for BM25-like ranking
SELECT * FROM memory_fts WHERE search_vector @@ to_tsquery('english', 'search')
```

---

## 6. Recommended ORM: Drizzle ORM

### Why Drizzle over Prisma

| Criteria | Drizzle | Prisma | Winner |
|----------|---------|--------|--------|
| **SQLite → PG migration** | Single codebase supports both DBs natively | Requires provider switch in schema.prisma | Both support |
| **Typed SQL** | Write raw SQL with type safety | ORM DSL, limited raw SQL ergonomics | Drizzle |
| **Existing pattern** | Already uses raw SQL; Drizzle keeps that | Would need full schema rewrite | **Drizzle** |
| **Performance** | Near-raw SQL performance (query builder) | More abstraction overhead | Drizzle |
| **Schema management** | `drizzle-kit` generates migrations from TS schema | `prisma migrate` from .prisma files | Both viable |
| **PostgreSQL features** | JSONB, partial indexes, RETURNING all supported | Supported but less ergonomic for advanced queries | **Drizzle** |
| **Bundle size** | ~40KB | ~200KB+ (with Prisma Client) | Drizzle |
| **Learning curve** | Minimal (familiar SQL syntax) | New DSL to learn | Drizzle |
| **Connection pooling** | Built-in pool support | Limited native pooling support | **Drizzle** |
| **Serverless support** | Drizzle-kit + neon/better-sqlite pattern | Prisma Data Proxy (paid) | Drizzle |

### Drizzle Setup Path

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/schema.ts',     // TS schema definitions
  out: './drizzle',                   // Generated migrations
  dbCredentials: { url: process.env.DATABASE_URL }
});
```

```ts
// src/lib/schema.ts (example)
import { pgTable, serial, text, bigint, boolean, jsonb, index } from 'drizzle-orm/pg-core';

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('inbox'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().default(sql`(EXTRACT(EPOCH FROM NOW()))::BIGINT`),
  // ...
}, (t) => [
  index('idx_tasks_status').on(t.status),
  // ...
]);
```

---

## 7. Connection Pooling Plan (pgBouncer)

### Recommended Configuration

```ini
; /etc/pgbouncer/pgbouncer.ini
[databases]
mission_control = host=127.0.0.1 port=5432 dbname=mission_control pool_mode=transaction

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction        ; transaction-level pooling (best for web apps)
max_client_conn = 500          ; max concurrent client connections
default_pool_size = 25         ; max connections per database
min_pool_size = 5              ; keep warm connections
reserve_pool_size = 5          ; extra connections under load
reserve_pool_timeout = 3       ; seconds before reserve pool activates
server_lifetime = 3600         ; recycle server connections after 1h
server_idle_timeout = 600      ; close idle server connections after 10m
idle_transaction_timeout = 300 ; 5min idle transaction timeout
```

### Why Transaction Mode

- Next.js route handlers are request-scoped (no long-lived connections)
- better-sqlite3 uses synchronous single connection → PG needs pooling for concurrency
- Transaction mode is sufficient for stateless API routes
- Avoid session mode (wastes connections) or statement mode (breaks prepared statements)

### Drizzle + pgBouncer Integration

```ts
// src/lib/db-postgres.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import Pool from 'pg-pool';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:6432/mission_control',
  max: 25,          // matches pgBouncer default_pool_size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool);
```

---

## 8. Backup Strategy

### Production pg_dump Schedule

| Backup Type | Frequency | Tool | Retention |
|------------|-----------|------|-----------|
| Full logical backup | Daily at 02:00 UTC | `pg_dump -Fc` | 30 days |
| Incremental WAL backup | Continuous (streaming) | `pg_basebackup` + WAL archiving | 7 days |
| PITR (Point-in-Time Recovery) | On-demand | WAL archive replay | 7 days |

### Backup Commands

```bash
# Daily full backup (cron: 0 2 * * *)
pg_dump -h localhost -p 5432 -U mc_user -Fc \
  --schema=public \
  --exclude-table=memory_fts \
  mission_control > /backup/mc_daily_$(date +%Y%m%d).dump

# Restore
pg_restore -h localhost -p 5432 -U mc_user -d mission_control --clean /backup/mc_daily_20260522.dump
```

### Additional Recommendations

- Use `pg_dump --jobs=4` for parallel dumps in production
- Store backups in S3-compatible storage with lifecycle policies
- Test restore monthly (automated CI job)
- Monitor backup size growth (expect ~2-3x SQLite size)

---

## 9. Rollback Plan (PostgreSQL → SQLite)

### Preconditions

- PostgreSQL schema must be the source of truth
- Migrations must be reversible or re-runnable
- Data must be exportable via pg_dump

### Rollback Steps

1. **Stop the application** (drain traffic)
2. **Export PostgreSQL data to SQLite-compatible format:**
   ```bash
   # Export as CSV (most reliable for type conversion)
   pg_dump -h localhost -p 5432 -U mc_user --format=plain \
     --data-only --column-inserts mission_control > migration_export.sql
   ```
3. **Convert INSERT statements:**
   - `SERIAL` values → explicit integers (use provided values, no AUTOINCREMENT)
   - `BOOLEAN` → `INTEGER` (1/0)
   - `JSONB` → `TEXT`
   - `BIGINT` timestamps → same (epoch compatible)
   - `TIMESTAMPTZ` → Unix epoch integers: `EXTRACT(EPOCH FROM col)::BIGINT`
   - Remove `RETURNING` clauses
   - Replace `ON CONFLICT` → `INSERT OR IGNORE` / `INSERT OR REPLACE`
4. **Load into SQLite:**
   ```bash
   sqlite3 mission-control.db < converted_migration.sql
   ```
5. **Switch DATABASE_URL back to file path**
6. **Start application with SQLite driver**

### Automated Conversion Script (Conceptual)

```python
#!/usr/bin/env python3
"""pg_dump_to_sqlite: Convert PostgreSQL dump to SQLite-compatible SQL."""
import re
import sys

def convert_dump(sql_file):
    with open(sql_file) as f:
        content = f.read()

    # Convert boolean literals
    content = re.sub(r"\bTRUE\b", "1", content)
    content = re.sub(r"\bFALSE\b", "0", content)

    # Convert SERIAL column values to explicit integers
    # Remove ON CONFLICT clauses
    content = re.sub(r"ON CONFLICT.*?DO (UPDATE SET|NOTHING)",
                     "", content)
    # ... more transformations

    return content
```

### Caveats

- FTS5 full-text index cannot be rolled back (pg_trgm → SQLite FTS5 requires rebuilding)
- Partial indexes are supported in both (no conversion needed)
- JSONB → TEXT loses PostgreSQL's JSON operators (application must adapt)
- `text` primary key in `runs` table → TEXT PRIMARY KEY (same)
- `memory_fts` in PG with GIN index → must rebuild FTS5 index in SQLite

---

## 10. PostgreSQL Compatibility Layer Status

### Current State

**No PostgreSQL compatibility layer exists yet.** The codebase has:

- ✅ Mention in `DEPLOYMENT-PREP.md` (lines 193-196) of planned driver change
- ✅ Reference to `DATABASE_URL=postgresql://...` env var (in deployment docs only)
- ✅ Secret scanner detects PostgreSQL connection strings
- ❌ No `DATABASE_URL` env variable in `.env.local` or `.env`
- ❌ No `pg` or `drizzle-orm` or `prisma` package installed
- ❌ No database abstraction layer (all code uses `better-sqlite3` directly)
- ❌ All 20+ route handlers import and use `getDatabase()` from `src/lib/db.ts`

### Files Needing Database Abstraction Layer

| File Category | Count | Change Required |
|--------------|-------|-----------------|
| API route handlers | ~30 | Replace `getDatabase()` calls with DB-agnostic interface |
| `src/lib/db.ts` | 1 | Add PG driver alongside better-sqlite3, with env-based switching |
| `src/lib/db_helpers` | 1 (inline in db.ts) | Translate `lastInsertRowid` usage |
| `src/lib/migrations.ts` | 1 | Separate PG migration runner |
| `src/lib/security-scan.ts` | 1 | Replace `PRAGMA integrity_check` |
| `src/lib/memory-search.ts` | 1 | FTS5 → pg_trgm adaptation |

---

## 11. Migration Phasing Recommendation

### Phase 1: Schema Compatibility (this deliverable) ✅
- [x] PostgreSQL schema file created: `scripts/init-db-postgres.sql`
- [x] SQLite-specific patterns audited
- [x] All 47 tables mapped with type conversions
- [x] Index compatibility verified

### Phase 2: Database Abstraction Layer
- Install `drizzle-orm` + `drizzle-kit` + `pg`
- Create Drizzle schema from TypeScript interfaces in `db.ts`
- Build database provider interface (SQLite | PostgreSQL)
- Add `DATABASE_URL` env var support
- Keep better-sqlite3 as default; PG as opt-in

### Phase 3: Dual-Write / Shadow Mode
- Deploy with both databases active
- Writes go to SQLite (primary) and PostgreSQL (shadow)
- Read from SQLite, validate reads against PG
- Monitor for divergence

### Phase 4: PG Primary
- Switch reads to PostgreSQL
- SQLite becomes backup/rollback target
- Run for 2 weeks validation period

### Phase 5: Remove SQLite
- Deprecate better-sqlite3 dependency
- Remove SQLite-specific code
- Update CI/CD for PostgreSQL

---

## 12. Estimated Effort

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 2: DB abstraction | 3-5 days | Low — well-defined interface |
| Phase 3: Dual-write | 2-3 days | Medium — data consistency |
| Phase 4: PG primary | 1-2 days | Low — validated reads |
| Phase 5: Cleanup | 1 day | Low |
| **Total** | **7-11 days** | **Overall: Low-Medium** |

---

## 13. Generated Artifacts

| File | Description | Location |
|------|-------------|----------|
| `scripts/init-db-postgres.sql` | PostgreSQL-compatible DDL | [see file](../scripts/init-db-postgres.sql) |
| `docs/postgres-migration.md` | This audit document | [see file](./postgres-migration.md) |
