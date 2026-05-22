-- PostgreSQL-compatible schema for Mission Control
-- Converted from SQLite (better-sqlite3) schema
-- Date: 2026-05-22
--
-- Key conversions applied:
--   INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
--   INTEGER (boolean) → BOOLEAN
--   TEXT (JSON) → JSONB
--   INTEGER DEFAULT (unixepoch()) → BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT
--   TEXT DEFAULT (datetime('now')) → TIMESTAMPTZ DEFAULT NOW()
--   UNIQUE constraints → added with ON CONFLICT behavior
--   PRAGMA statements → removed (handled via connection config)
--   INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING
--   INSERT OR REPLACE → INSERT ... ON CONFLICT ... DO UPDATE
--   FTS5 virtual table → pg_trgm GIN index approach

-- ─── Migration tracking ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT
);

-- ─── Core tables (from schema.sql) ───────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'inbox',
    priority TEXT NOT NULL DEFAULT 'medium',
    assigned_to TEXT,
    created_by TEXT NOT NULL DEFAULT 'system',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    due_date BIGINT,
    estimated_hours INTEGER,
    actual_hours INTEGER,
    tags JSONB,
    metadata JSONB,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    project_id INTEGER,
    project_ticket_no INTEGER,
    project_name TEXT,
    project_prefix TEXT,
    ticket_ref TEXT,
    outcome TEXT,
    error_message TEXT,
    resolution TEXT,
    feedback_rating INTEGER,
    feedback_notes TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    completed_at BIGINT,
    dispatch_attempts INTEGER NOT NULL DEFAULT 0,
    github_issue_number INTEGER,
    github_repo TEXT,
    github_synced_at BIGINT,
    github_branch TEXT,
    github_pr_number INTEGER,
    github_pr_state TEXT
);

CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    session_key TEXT UNIQUE,
    soul_content TEXT,
    status TEXT NOT NULL DEFAULT 'offline',
    last_seen BIGINT,
    last_activity TEXT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    config JSONB,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    source TEXT DEFAULT 'manual',
    content_hash TEXT,
    workspace_path TEXT,
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    working_memory TEXT DEFAULT '',
    runtime_type TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    parent_id INTEGER,
    mentions JSONB,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    actor TEXT NOT NULL,
    description TEXT NOT NULL,
    data JSONB,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    source_type TEXT,
    source_id INTEGER,
    read_at BIGINT,
    delivered_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS task_subscriptions (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    agent_name TEXT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    UNIQUE(task_id, agent_name),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS standup_reports (
    date TEXT PRIMARY KEY,
    report JSONB NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS quality_reviews (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    reviewer TEXT NOT NULL,
    status TEXT NOT NULL,
    notes TEXT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gateway_health_logs (
    id SERIAL PRIMARY KEY,
    gateway_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    latency INTEGER,
    probed_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    error TEXT
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    from_agent TEXT NOT NULL,
    to_agent TEXT,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    metadata JSONB,
    read_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    last_login_at BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    provider TEXT NOT NULL DEFAULT 'local',
    provider_user_id TEXT,
    email TEXT,
    avatar_url TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT TRUE,
    approved_by TEXT,
    approved_at BIGINT
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    ip_address TEXT,
    user_agent TEXT,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workflow_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    model TEXT NOT NULL DEFAULT 'sonnet',
    task_prompt TEXT NOT NULL,
    timeout_seconds INTEGER NOT NULL DEFAULT 300,
    agent_role TEXT,
    tags JSONB,
    created_by TEXT NOT NULL DEFAULT 'system',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    last_used_at BIGINT,
    use_count INTEGER NOT NULL DEFAULT 0,
    workspace_id INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    actor_id INTEGER,
    target_type TEXT,
    target_id INTEGER,
    detail TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT
);

CREATE TABLE IF NOT EXISTS webhooks (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT,
    events JSONB NOT NULL DEFAULT '["*"]',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_fired_at BIGINT,
    last_status INTEGER,
    created_by TEXT NOT NULL DEFAULT 'system',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    consecutive_failures INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status_code INTEGER,
    response_body TEXT,
    error TEXT,
    duration_ms INTEGER,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    attempt INTEGER NOT NULL DEFAULT 0,
    next_retry_at BIGINT,
    is_retry BOOLEAN NOT NULL DEFAULT FALSE,
    parent_delivery_id INTEGER,
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workflow_pipelines (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    steps JSONB NOT NULL DEFAULT '[]',
    created_by TEXT NOT NULL DEFAULT 'system',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    use_count INTEGER NOT NULL DEFAULT 0,
    last_used_at BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id SERIAL PRIMARY KEY,
    pipeline_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    current_step INTEGER NOT NULL DEFAULT 0,
    steps_snapshot JSONB NOT NULL DEFAULT '[]',
    started_at BIGINT,
    completed_at BIGINT,
    triggered_by TEXT NOT NULL DEFAULT 'system',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (pipeline_id) REFERENCES workflow_pipelines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    updated_by TEXT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT
);

CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    entity_type TEXT NOT NULL,
    condition_field TEXT NOT NULL,
    condition_operator TEXT NOT NULL,
    condition_value TEXT NOT NULL,
    action_type TEXT NOT NULL DEFAULT 'notification',
    action_config JSONB NOT NULL DEFAULT '{}',
    cooldown_minutes INTEGER NOT NULL DEFAULT 60,
    last_triggered_at BIGINT,
    trigger_count INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL DEFAULT 'system',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    linux_user TEXT NOT NULL UNIQUE,
    plan_tier TEXT NOT NULL DEFAULT 'standard',
    status TEXT NOT NULL DEFAULT 'pending',
    openclaw_home TEXT NOT NULL,
    workspace_root TEXT NOT NULL,
    gateway_port INTEGER,
    dashboard_port INTEGER,
    config JSONB NOT NULL DEFAULT '{}',
    created_by TEXT NOT NULL DEFAULT 'system',
    owner_gateway TEXT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT
);

CREATE TABLE IF NOT EXISTS provision_jobs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    job_type TEXT NOT NULL DEFAULT 'bootstrap',
    status TEXT NOT NULL DEFAULT 'queued',
    dry_run BOOLEAN NOT NULL DEFAULT TRUE,
    requested_by TEXT NOT NULL DEFAULT 'system',
    approved_by TEXT,
    runner_host TEXT,
    idempotency_key TEXT,
    request_json JSONB NOT NULL DEFAULT '{}',
    plan_json JSONB NOT NULL DEFAULT '[]',
    result_json TEXT,
    error_text TEXT,
    started_at BIGINT,
    completed_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS provision_events (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL,
    level TEXT NOT NULL DEFAULT 'info',
    step_key TEXT,
    message TEXT NOT NULL,
    data JSONB,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    FOREIGN KEY (job_id) REFERENCES provision_jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS access_requests (
    id SERIAL PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'google',
    email TEXT NOT NULL,
    provider_user_id TEXT,
    display_name TEXT,
    avatar_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    last_attempt_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    reviewed_by TEXT,
    reviewed_at BIGINT,
    review_note TEXT,
    approved_user_id INTEGER,
    FOREIGN KEY (approved_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS direct_connections (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    tool_version TEXT,
    connection_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'connected',
    last_heartbeat BIGINT,
    metadata JSONB,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS github_syncs (
    id SERIAL PRIMARY KEY,
    repo TEXT NOT NULL,
    last_synced_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    issue_count INTEGER NOT NULL DEFAULT 0,
    sync_direction TEXT NOT NULL DEFAULT 'inbound',
    status TEXT NOT NULL DEFAULT 'success',
    error TEXT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    project_id INTEGER,
    changes_pushed INTEGER NOT NULL DEFAULT 0,
    changes_pulled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS token_usage (
    id SERIAL PRIMARY KEY,
    model TEXT NOT NULL,
    session_id TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    task_id INTEGER,
    cost_usd REAL,
    agent_name TEXT
);

CREATE TABLE IF NOT EXISTS claude_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    project_slug TEXT NOT NULL,
    project_path TEXT,
    model TEXT,
    git_branch TEXT,
    user_messages INTEGER NOT NULL DEFAULT 0,
    assistant_messages INTEGER NOT NULL DEFAULT 0,
    tool_uses INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost REAL NOT NULL DEFAULT 0,
    first_message_at TEXT,
    last_message_at TEXT,
    last_user_prompt TEXT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    scanned_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT
);

CREATE TABLE IF NOT EXISTS workspaces (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    tenant_id INTEGER NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    ticket_prefix TEXT NOT NULL,
    ticket_counter INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    github_repo TEXT,
    deadline BIGINT,
    color TEXT,
    metadata JSONB,
    github_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    github_labels_initialized BOOLEAN NOT NULL DEFAULT FALSE,
    github_default_branch TEXT DEFAULT 'main',
    UNIQUE(workspace_id, slug),
    UNIQUE(workspace_id, ticket_prefix)
);

CREATE TABLE IF NOT EXISTS project_agent_assignments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    agent_name TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    assigned_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    UNIQUE(project_id, agent_name),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS adapter_configs (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL,
    framework TEXT NOT NULL,
    config JSONB DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    UNIQUE(workspace_id, framework)
);

CREATE TABLE IF NOT EXISTS skills (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    path TEXT NOT NULL,
    description TEXT,
    content_hash TEXT,
    registry_slug TEXT,
    registry_version TEXT,
    security_status TEXT DEFAULT 'unchecked',
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source, name)
);

CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'viewer',
    scopes JSONB,
    expires_at BIGINT,
    last_used_at BIGINT,
    last_used_ip TEXT,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT
);

CREATE TABLE IF NOT EXISTS security_events (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    source TEXT,
    agent_name TEXT,
    detail TEXT,
    ip_address TEXT,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    tenant_id INTEGER NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT
);

CREATE TABLE IF NOT EXISTS agent_trust_scores (
    id SERIAL PRIMARY KEY,
    agent_name TEXT NOT NULL,
    trust_score REAL NOT NULL DEFAULT 1.0,
    auth_failures INTEGER NOT NULL DEFAULT 0,
    injection_attempts INTEGER NOT NULL DEFAULT 0,
    rate_limit_hits INTEGER NOT NULL DEFAULT 0,
    secret_exposures INTEGER NOT NULL DEFAULT 0,
    successful_tasks INTEGER NOT NULL DEFAULT 0,
    failed_tasks INTEGER NOT NULL DEFAULT 0,
    last_anomaly_at BIGINT,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    UNIQUE(agent_name, workspace_id)
);

CREATE TABLE IF NOT EXISTS mcp_call_log (
    id SERIAL PRIMARY KEY,
    agent_name TEXT,
    mcp_server TEXT,
    tool_name TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    duration_ms INTEGER,
    error TEXT,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    payload_hash TEXT DEFAULT NULL,
    signature TEXT DEFAULT NULL,
    public_key TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS eval_runs (
    id SERIAL PRIMARY KEY,
    agent_name TEXT NOT NULL,
    eval_layer TEXT NOT NULL,
    score REAL,
    passed BOOLEAN,
    detail JSONB,
    golden_dataset_id INTEGER,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT
);

CREATE TABLE IF NOT EXISTS eval_golden_sets (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    entries JSONB NOT NULL DEFAULT '[]',
    created_by TEXT,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    UNIQUE(name, workspace_id)
);

CREATE TABLE IF NOT EXISTS eval_traces (
    id SERIAL PRIMARY KEY,
    agent_name TEXT NOT NULL,
    task_id INTEGER,
    trace JSONB NOT NULL DEFAULT '[]',
    convergence_score REAL,
    total_steps INTEGER,
    optimal_steps INTEGER,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT
);

CREATE TABLE IF NOT EXISTS agent_api_keys (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    scopes JSONB NOT NULL DEFAULT '[]',
    expires_at BIGINT,
    revoked_at BIGINT,
    last_used_at BIGINT,
    created_by TEXT,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    UNIQUE(workspace_id, key_hash)
);

CREATE TABLE IF NOT EXISTS spawn_history (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER,
    agent_name TEXT NOT NULL,
    spawn_type TEXT NOT NULL DEFAULT 'claude-code',
    session_id TEXT,
    trigger TEXT,
    status TEXT NOT NULL DEFAULT 'started',
    exit_code INTEGER,
    error TEXT,
    duration_ms INTEGER,
    workspace_id INTEGER NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    finished_at BIGINT,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    agent_name TEXT,
    model TEXT,
    provider TEXT,
    runtime TEXT DEFAULT 'mission-control',
    runtime_version TEXT,
    trigger_type TEXT,
    parent_run_id TEXT,
    task_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    outcome TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_ms INTEGER,
    steps JSONB DEFAULT '[]',
    tools_available JSONB DEFAULT '[]',
    cost_input_tokens INTEGER DEFAULT 0,
    cost_output_tokens INTEGER DEFAULT 0,
    cost_cache_read_tokens INTEGER,
    cost_cache_write_tokens INTEGER,
    cost_usd REAL,
    cost_model TEXT,
    run_hash TEXT,
    parent_run_hash TEXT,
    lineage JSONB DEFAULT '[]',
    model_version TEXT,
    config_hash TEXT,
    provenance_runtime TEXT,
    signed_by TEXT,
    signature TEXT,
    provenance_created_at TEXT,
    eval_task_type TEXT,
    eval_layer TEXT,
    eval_pass BOOLEAN,
    eval_score REAL,
    eval_detail JSONB,
    eval_metrics JSONB,
    eval_benchmark_id TEXT,
    error TEXT,
    git_branch TEXT,
    git_commit TEXT,
    workspace_id INTEGER DEFAULT 1,
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    spawn_history_id INTEGER,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT
);

-- ─── Memory FTS (PostgreSQL text search alternative) ─────────────
-- NOTE: SQLite uses FTS5 virtual table. PostgreSQL uses pg_trgm + GIN index.
-- The memory_fts_meta table is kept for migration compatibility, but the actual
-- FTS5 table should be replaced with a GIN index on a tsvector column, or use
-- the pg_trgm extension for trigram-based search.

CREATE TABLE IF NOT EXISTS memory_fts_meta (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- PostgreSQL FTS alternative: create a table to hold indexed content
-- with a generated tsvector column and GIN index
--
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE TABLE IF NOT EXISTS memory_fts (
--     id SERIAL PRIMARY KEY,
--     path TEXT NOT NULL,
--     title TEXT,
--     content TEXT NOT NULL,
--     search_vector tsvector GENERATED ALWAYS AS (
--         setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
--         setweight(to_tsvector('english', COALESCE(content, '')), 'B')
--     ) STORED,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
-- CREATE INDEX IF NOT EXISTS idx_memory_fts_search ON memory_fts USING GIN(search_vector);
-- CREATE INDEX IF NOT EXISTS idx_memory_fts_path ON memory_fts(path);
-- CREATE INDEX IF NOT EXISTS idx_memory_fts_trgm ON memory_fts USING GIN(title gin_trgm_ops, content gin_trgm_ops);
--
-- Search query conversion:
--   SQLite:  SELECT * FROM memory_fts WHERE memory_fts MATCH 'search_term'
--   PG:      SELECT * FROM memory_fts WHERE search_vector @@ to_tsquery('english', 'search_term')

-- ─── Gateways (lazy-created in gateways API routes) ──────────────

CREATE TABLE IF NOT EXISTS gateways (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    host TEXT NOT NULL DEFAULT '127.0.0.1',
    port INTEGER NOT NULL DEFAULT 18789,
    token TEXT NOT NULL DEFAULT '',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'unknown',
    last_seen BIGINT,
    latency INTEGER,
    sessions_count INTEGER NOT NULL DEFAULT 0,
    agents_count INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT,
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()))::BIGINT
);

-- ─── Indexes ─────────────────────────────────────────────────────

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_project ON tasks(workspace_id, project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_outcome ON tasks(outcome);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_outcome ON tasks(workspace_id, outcome, completed_at);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status ON tasks(status, updated_at);

-- GitHub sync unique index (partial — only rows with issue numbers)
-- PostgreSQL partial index syntax
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_github_issue
    ON tasks(workspace_id, github_repo, github_issue_number)
    WHERE github_issue_number IS NOT NULL;

-- Tasks partial index for stale in-progress detection
CREATE INDEX IF NOT EXISTS idx_tasks_stale_inprogress
    ON tasks(status, updated_at)
    WHERE status = 'in_progress';

-- Recurring tasks partial index
-- PostgreSQL: jsonb path requires different syntax; use expression index
CREATE INDEX IF NOT EXISTS idx_tasks_recurring
    ON tasks(workspace_id)
    WHERE metadata->'recurrence'->>'enabled' = 'true';

-- Agents indexes
CREATE INDEX IF NOT EXISTS idx_agents_session_key ON agents(session_key);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_workspace_id ON agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_source ON agents(source);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_workspace_id ON comments(workspace_id);

-- Activities indexes
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_actor ON activities(actor);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_workspace_id ON activities(workspace_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications(recipient, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id ON notifications(workspace_id);

-- Task subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_task_subscriptions_task_id ON task_subscriptions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_subscriptions_agent_name ON task_subscriptions(agent_name);

-- Standup reports indexes
CREATE INDEX IF NOT EXISTS idx_standup_reports_created_at ON standup_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_standup_reports_workspace_id ON standup_reports(workspace_id);

-- Quality reviews indexes
CREATE INDEX IF NOT EXISTS idx_quality_reviews_task_id ON quality_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_quality_reviews_reviewer ON quality_reviews(reviewer);
CREATE INDEX IF NOT EXISTS idx_quality_reviews_workspace_id ON quality_reviews(workspace_id);

-- Gateway health logs indexes
CREATE INDEX IF NOT EXISTS idx_gateway_health_logs_gateway_id ON gateway_health_logs(gateway_id);
CREATE INDEX IF NOT EXISTS idx_gateway_health_logs_probed_at ON gateway_health_logs(probed_at);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_agents ON messages(from_agent, to_agent);
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at);
CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON messages(workspace_id);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_workspace_id ON users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- User sessions indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_workspace_id ON user_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_id ON user_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_workspace_tenant ON user_sessions(workspace_id, tenant_id);

-- Workflow templates indexes
CREATE INDEX IF NOT EXISTS idx_workflow_templates_name ON workflow_templates(name);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_created_by ON workflow_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_workspace_id ON workflow_templates(workspace_id);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Webhooks indexes
CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);
CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_id ON webhooks(workspace_id);

-- Webhook deliveries indexes
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_workspace_id ON webhook_deliveries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at)
    WHERE next_retry_at IS NOT NULL;

-- Workflow pipelines indexes
CREATE INDEX IF NOT EXISTS idx_workflow_pipelines_name ON workflow_pipelines(name);
CREATE INDEX IF NOT EXISTS idx_workflow_pipelines_workspace_id ON workflow_pipelines(workspace_id);

-- Pipeline runs indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline_id ON pipeline_runs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_workspace_id ON pipeline_runs(workspace_id);

-- Settings indexes
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

-- Alert rules indexes
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_entity_type ON alert_rules(entity_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_workspace_id ON alert_rules(workspace_id);

-- Tenants indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_gateway ON tenants(owner_gateway);

-- Provision jobs indexes
CREATE INDEX IF NOT EXISTS idx_provision_jobs_tenant_id ON provision_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provision_jobs_status ON provision_jobs(status);
CREATE INDEX IF NOT EXISTS idx_provision_jobs_created_at ON provision_jobs(created_at);

-- Provision events indexes
CREATE INDEX IF NOT EXISTS idx_provision_events_job_id ON provision_events(job_id);
CREATE INDEX IF NOT EXISTS idx_provision_events_created_at ON provision_events(created_at);

-- Access requests indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_email_provider ON access_requests(email, provider);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);

-- Direct connections indexes
CREATE INDEX IF NOT EXISTS idx_direct_connections_agent_id ON direct_connections(agent_id);
CREATE INDEX IF NOT EXISTS idx_direct_connections_connection_id ON direct_connections(connection_id);
CREATE INDEX IF NOT EXISTS idx_direct_connections_status ON direct_connections(status);
CREATE INDEX IF NOT EXISTS idx_direct_connections_workspace_id ON direct_connections(workspace_id);

-- GitHub syncs indexes
CREATE INDEX IF NOT EXISTS idx_github_syncs_repo ON github_syncs(repo);
CREATE INDEX IF NOT EXISTS idx_github_syncs_created_at ON github_syncs(created_at);
CREATE INDEX IF NOT EXISTS idx_github_syncs_project ON github_syncs(project_id);
CREATE INDEX IF NOT EXISTS idx_github_syncs_workspace ON github_syncs(workspace_id);

-- Token usage indexes
CREATE INDEX IF NOT EXISTS idx_token_usage_session_id ON token_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model);
CREATE INDEX IF NOT EXISTS idx_token_usage_task_id ON token_usage(task_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_workspace_task_time ON token_usage(workspace_id, task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_workspace_id ON token_usage(workspace_id);

-- Claude sessions indexes
CREATE INDEX IF NOT EXISTS idx_claude_sessions_active ON claude_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_claude_sessions_project ON claude_sessions(project_slug);

-- Workspaces indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_id ON workspaces(tenant_id);

-- Project agent assignments indexes
CREATE INDEX IF NOT EXISTS idx_paa_project ON project_agent_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_paa_agent ON project_agent_assignments(agent_name);

-- Adapter configs indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_adapter_configs_workspace_framework ON adapter_configs(workspace_id, framework);

-- Skills indexes
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_source ON skills(source);
CREATE INDEX IF NOT EXISTS idx_skills_registry_slug ON skills(registry_slug);

-- API keys indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id ON api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

-- Security events indexes
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_agent_name ON security_events(agent_name);
CREATE INDEX IF NOT EXISTS idx_security_events_workspace_id ON security_events(workspace_id);

-- Agent trust scores: UNIQUE constraint already on columns (agent_name, workspace_id)
-- Additional indexes if needed

-- MCP call log indexes
CREATE INDEX IF NOT EXISTS idx_mcp_call_log_agent_name ON mcp_call_log(agent_name);
CREATE INDEX IF NOT EXISTS idx_mcp_call_log_created_at ON mcp_call_log(created_at);
CREATE INDEX IF NOT EXISTS idx_mcp_call_log_tool_name ON mcp_call_log(tool_name);

-- Eval runs indexes
CREATE INDEX IF NOT EXISTS idx_eval_runs_agent_name ON eval_runs(agent_name);
CREATE INDEX IF NOT EXISTS idx_eval_runs_eval_layer ON eval_runs(eval_layer);
CREATE INDEX IF NOT EXISTS idx_eval_runs_created_at ON eval_runs(created_at);

-- Eval traces indexes
CREATE INDEX IF NOT EXISTS idx_eval_traces_agent_name ON eval_traces(agent_name);
CREATE INDEX IF NOT EXISTS idx_eval_traces_task_id ON eval_traces(task_id);

-- Agent API keys indexes
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_agent_id ON agent_api_keys(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_workspace_id ON agent_api_keys(workspace_id);
-- UNIQUE constraint already on columns (workspace_id, key_hash)
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_expires_at ON agent_api_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_revoked_at ON agent_api_keys(revoked_at);

-- Spawn history indexes
CREATE INDEX IF NOT EXISTS idx_spawn_history_agent ON spawn_history(agent_name);
CREATE INDEX IF NOT EXISTS idx_spawn_history_created ON spawn_history(created_at);
CREATE INDEX IF NOT EXISTS idx_spawn_history_status ON spawn_history(status);

-- Runs indexes
CREATE INDEX IF NOT EXISTS idx_runs_agent_id ON runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
CREATE INDEX IF NOT EXISTS idx_runs_workspace ON runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_runs_run_hash ON runs(run_hash);
CREATE INDEX IF NOT EXISTS idx_runs_task_id ON runs(task_id);
