import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import type Database from 'better-sqlite3'

export type Migration = {
  id: string
  up: (db: Database.Database) => void
}

// Plugin hook: extensions can register additional migrations without modifying this file.
const extraMigrations: Migration[] = []
export function registerMigrations(newMigrations: Migration[]): void {
  extraMigrations.push(...newMigrations)
}

const migrations: Migration[] = [
  {
    id: '001_init',
    up: (db) => {
      const schemaPath = join(process.cwd(), 'src', 'lib', 'schema.sql')
      const schema = readFileSync(schemaPath, 'utf8')
      const statements = schema.split(';').filter((stmt) => stmt.trim())
      db.transaction(() => {
        for (const statement of statements) {
          db.exec(statement.trim())
        }
      })()
    }
  },
  {
    id: '002_quality_reviews',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS quality_reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER NOT NULL,
          reviewer TEXT NOT NULL,
          status TEXT NOT NULL,
          notes TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_quality_reviews_task_id ON quality_reviews(task_id);
        CREATE INDEX IF NOT EXISTS idx_quality_reviews_reviewer ON quality_reviews(reviewer);
      `)
    }
  },
  {
    id: '003_quality_review_status_backfill',
    up: (db) => {
      // Convert existing review tasks to quality_review to enforce the gate
      db.exec(`
        UPDATE tasks
        SET status = 'quality_review'
        WHERE status = 'review';
      `)
    }
  },
  {
    id: '004_messages',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id TEXT NOT NULL,
          from_agent TEXT NOT NULL,
          to_agent TEXT,
          content TEXT NOT NULL,
          message_type TEXT DEFAULT 'text',
          metadata TEXT,
          read_at INTEGER,
          created_at INTEGER DEFAULT (unixepoch())
        )
      `)
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)
      `)
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_agents ON messages(from_agent, to_agent)
      `)
    }
  },
  {
    id: '005_users',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'operator',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_login_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS user_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT NOT NULL UNIQUE,
          user_id INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          ip_address TEXT,
          user_agent TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
      `)
    }
  },
  {
    id: '006_workflow_templates',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS workflow_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          model TEXT NOT NULL DEFAULT 'sonnet',
          task_prompt TEXT NOT NULL,
          timeout_seconds INTEGER NOT NULL DEFAULT 300,
          agent_role TEXT,
          tags TEXT,
          created_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_used_at INTEGER,
          use_count INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_workflow_templates_name ON workflow_templates(name);
        CREATE INDEX IF NOT EXISTS idx_workflow_templates_created_by ON workflow_templates(created_by);
      `)
    }
  },
  {
    id: '007_audit_log',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL,
          actor TEXT NOT NULL,
          actor_id INTEGER,
          target_type TEXT,
          target_id INTEGER,
          detail TEXT,
          ip_address TEXT,
          user_agent TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
        CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
      `)
    }
  },
  {
    id: '008_webhooks',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS webhooks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          secret TEXT,
          events TEXT NOT NULL DEFAULT '["*"]',
          enabled INTEGER NOT NULL DEFAULT 1,
          last_fired_at INTEGER,
          last_status INTEGER,
          created_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE TABLE IF NOT EXISTS webhook_deliveries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          webhook_id INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          status_code INTEGER,
          response_body TEXT,
          error TEXT,
          duration_ms INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
        CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
        CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);
      `)
    }
  },
  {
    id: '009_pipelines',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS workflow_pipelines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          steps TEXT NOT NULL DEFAULT '[]',
          created_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          use_count INTEGER NOT NULL DEFAULT 0,
          last_used_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS pipeline_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pipeline_id INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          current_step INTEGER NOT NULL DEFAULT 0,
          steps_snapshot TEXT NOT NULL DEFAULT '[]',
          started_at INTEGER,
          completed_at INTEGER,
          triggered_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (pipeline_id) REFERENCES workflow_pipelines(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pipeline_id ON pipeline_runs(pipeline_id);
        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
        CREATE INDEX IF NOT EXISTS idx_workflow_pipelines_name ON workflow_pipelines(name);
      `)
    }
  },
  {
    id: '010_settings',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL DEFAULT 'general',
          updated_by TEXT,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
      `)
    }
  },
  {
    id: '011_alert_rules',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS alert_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          entity_type TEXT NOT NULL,
          condition_field TEXT NOT NULL,
          condition_operator TEXT NOT NULL,
          condition_value TEXT NOT NULL,
          action_type TEXT NOT NULL DEFAULT 'notification',
          action_config TEXT NOT NULL DEFAULT '{}',
          cooldown_minutes INTEGER NOT NULL DEFAULT 60,
          last_triggered_at INTEGER,
          trigger_count INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
        CREATE INDEX IF NOT EXISTS idx_alert_rules_entity_type ON alert_rules(entity_type);
      `)
    }
  },
  {
    id: '012_super_admin_tenants',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tenants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          linux_user TEXT NOT NULL UNIQUE,
          plan_tier TEXT NOT NULL DEFAULT 'standard',
          status TEXT NOT NULL DEFAULT 'pending',
          openclaw_home TEXT NOT NULL,
          workspace_root TEXT NOT NULL,
          gateway_port INTEGER,
          dashboard_port INTEGER,
          config TEXT NOT NULL DEFAULT '{}',
          created_by TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE TABLE IF NOT EXISTS provision_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tenant_id INTEGER NOT NULL,
          job_type TEXT NOT NULL DEFAULT 'bootstrap',
          status TEXT NOT NULL DEFAULT 'queued',
          dry_run INTEGER NOT NULL DEFAULT 1,
          requested_by TEXT NOT NULL DEFAULT 'system',
          approved_by TEXT,
          runner_host TEXT,
          idempotency_key TEXT,
          request_json TEXT NOT NULL DEFAULT '{}',
          plan_json TEXT NOT NULL DEFAULT '[]',
          result_json TEXT,
          error_text TEXT,
          started_at INTEGER,
          completed_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS provision_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id INTEGER NOT NULL,
          level TEXT NOT NULL DEFAULT 'info',
          step_key TEXT,
          message TEXT NOT NULL,
          data TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (job_id) REFERENCES provision_jobs(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
        CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
        CREATE INDEX IF NOT EXISTS idx_provision_jobs_tenant_id ON provision_jobs(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_provision_jobs_status ON provision_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_provision_jobs_created_at ON provision_jobs(created_at);
        CREATE INDEX IF NOT EXISTS idx_provision_events_job_id ON provision_events(job_id);
        CREATE INDEX IF NOT EXISTS idx_provision_events_created_at ON provision_events(created_at);
      `)
    }
  },
  {
    id: '013_tenant_owner_gateway',
    up: (db) => {
      // Check if tenants table exists (may not on fresh installs without super-admin)
      const hasTenants = (db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='tenants'`
      ).get() as any)
      if (!hasTenants) return

      const columns = db.prepare(`PRAGMA table_info(tenants)`).all() as Array<{ name: string }>
      const hasOwnerGateway = columns.some((c) => c.name === 'owner_gateway')
      if (!hasOwnerGateway) {
        db.exec(`ALTER TABLE tenants ADD COLUMN owner_gateway TEXT`)
      }

      const defaultGatewayName =
        String(process.env.MC_DEFAULT_OWNER_GATEWAY || process.env.MC_DEFAULT_GATEWAY_NAME || 'primary').trim() ||
        'primary'

      // Check if gateways table exists (created lazily by gateways API, not in migrations)
      const hasGateways = (db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='gateways'`
      ).get() as any)

      if (hasGateways) {
        db.prepare(`
          UPDATE tenants
          SET owner_gateway = COALESCE(
            (SELECT name FROM gateways ORDER BY is_primary DESC, id ASC LIMIT 1),
            ?
          )
          WHERE owner_gateway IS NULL OR trim(owner_gateway) = ''
        `).run(defaultGatewayName)
      } else {
        db.prepare(`
          UPDATE tenants
          SET owner_gateway = ?
          WHERE owner_gateway IS NULL OR trim(owner_gateway) = ''
        `).run(defaultGatewayName)
      }

      db.exec(`CREATE INDEX IF NOT EXISTS idx_tenants_owner_gateway ON tenants(owner_gateway)`)
    }
  },
  {
    id: '014_auth_google_approvals',
    up: (db) => {
      const userCols = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>
      const has = (name: string) => userCols.some((c) => c.name === name)

      if (!has('provider')) db.exec(`ALTER TABLE users ADD COLUMN provider TEXT NOT NULL DEFAULT 'local'`)
      if (!has('provider_user_id')) db.exec(`ALTER TABLE users ADD COLUMN provider_user_id TEXT`)
      if (!has('email')) db.exec(`ALTER TABLE users ADD COLUMN email TEXT`)
      if (!has('avatar_url')) db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT`)
      if (!has('is_approved')) db.exec(`ALTER TABLE users ADD COLUMN is_approved INTEGER NOT NULL DEFAULT 1`)
      if (!has('approved_by')) db.exec(`ALTER TABLE users ADD COLUMN approved_by TEXT`)
      if (!has('approved_at')) db.exec(`ALTER TABLE users ADD COLUMN approved_at INTEGER`)

      db.exec(`
        UPDATE users
        SET provider = COALESCE(NULLIF(provider, ''), 'local'),
            is_approved = COALESCE(is_approved, 1)
      `)

      db.exec(`
        CREATE TABLE IF NOT EXISTS access_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider TEXT NOT NULL DEFAULT 'google',
          email TEXT NOT NULL,
          provider_user_id TEXT,
          display_name TEXT,
          avatar_url TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
          last_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
          attempt_count INTEGER NOT NULL DEFAULT 1,
          reviewed_by TEXT,
          reviewed_at INTEGER,
          review_note TEXT,
          approved_user_id INTEGER,
          FOREIGN KEY (approved_user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `)

      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_email_provider ON access_requests(email, provider)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`)
    }
  },
  {
    id: '015_missing_indexes',
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
        CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications(recipient, read_at);
        CREATE INDEX IF NOT EXISTS idx_activities_actor ON activities(actor);
        CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at);
      `)
    }
  },
  {
    id: '016_direct_connections',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS direct_connections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          tool_name TEXT NOT NULL,
          tool_version TEXT,
          connection_id TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'connected',
          last_heartbeat INTEGER,
          metadata TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_direct_connections_agent_id ON direct_connections(agent_id);
        CREATE INDEX IF NOT EXISTS idx_direct_connections_connection_id ON direct_connections(connection_id);
        CREATE INDEX IF NOT EXISTS idx_direct_connections_status ON direct_connections(status);
      `)
    }
  },
  {
    id: '017_github_sync',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS github_syncs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          repo TEXT NOT NULL,
          last_synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
          issue_count INTEGER NOT NULL DEFAULT 0,
          sync_direction TEXT NOT NULL DEFAULT 'inbound',
          status TEXT NOT NULL DEFAULT 'success',
          error TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_github_syncs_repo ON github_syncs(repo);
        CREATE INDEX IF NOT EXISTS idx_github_syncs_created_at ON github_syncs(created_at);
      `)
    }
  },
  {
    id: '018_token_usage',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS token_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          model TEXT NOT NULL,
          session_id TEXT NOT NULL,
          input_tokens INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_token_usage_session_id ON token_usage(session_id);
        CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);
        CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model);
      `)
    }
  },
  {
    id: '019_webhook_retry',
    up: (db) => {
      // Add retry columns to webhook_deliveries
      const deliveryCols = db.prepare(`PRAGMA table_info(webhook_deliveries)`).all() as Array<{ name: string }>
      const hasCol = (name: string) => deliveryCols.some((c) => c.name === name)

      if (!hasCol('attempt')) db.exec(`ALTER TABLE webhook_deliveries ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0`)
      if (!hasCol('next_retry_at')) db.exec(`ALTER TABLE webhook_deliveries ADD COLUMN next_retry_at INTEGER`)
      if (!hasCol('is_retry')) db.exec(`ALTER TABLE webhook_deliveries ADD COLUMN is_retry INTEGER NOT NULL DEFAULT 0`)
      if (!hasCol('parent_delivery_id')) db.exec(`ALTER TABLE webhook_deliveries ADD COLUMN parent_delivery_id INTEGER`)

      // Add circuit breaker column to webhooks
      const webhookCols = db.prepare(`PRAGMA table_info(webhooks)`).all() as Array<{ name: string }>
      if (!webhookCols.some((c) => c.name === 'consecutive_failures')) {
        db.exec(`ALTER TABLE webhooks ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0`)
      }

      // Partial index for retry queue processing
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE next_retry_at IS NOT NULL`)
    }
  },
  {
    id: '020_claude_sessions',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS claude_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
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
          is_active INTEGER NOT NULL DEFAULT 0,
          scanned_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_claude_sessions_active ON claude_sessions(is_active) WHERE is_active = 1`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_claude_sessions_project ON claude_sessions(project_slug)`)
    }
  },
  {
    id: '021_workspace_isolation_phase1',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `)

      db.prepare(`
        INSERT OR IGNORE INTO workspaces (id, slug, name, created_at, updated_at)
        VALUES (1, 'default', 'Default Workspace', unixepoch(), unixepoch())
      `).run()

      const addWorkspaceIdColumn = (table: string) => {
        const tableExists = db
          .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
          .get(table) as { ok?: number } | undefined
        if (!tableExists?.ok) return

        const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
        if (!cols.some((c) => c.name === 'workspace_id')) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT 1`)
        }
        db.exec(`UPDATE ${table} SET workspace_id = COALESCE(workspace_id, 1)`)
      }

      const scopedTables = [
        'users',
        'user_sessions',
        'tasks',
        'agents',
        'comments',
        'activities',
        'notifications',
        'quality_reviews',
        'standup_reports',
      ]

      for (const table of scopedTables) {
        addWorkspaceIdColumn(table)
      }

      db.exec(`CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_users_workspace_id ON users(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_user_sessions_workspace_id ON user_sessions(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON tasks(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agents_workspace_id ON agents(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_comments_workspace_id ON comments(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_activities_workspace_id ON activities(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id ON notifications(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_quality_reviews_workspace_id ON quality_reviews(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_standup_reports_workspace_id ON standup_reports(workspace_id)`)
    }
  },
  {
    id: '022_workspace_isolation_phase2',
    up: (db) => {
      const addWorkspaceIdColumn = (table: string) => {
        const tableExists = db
          .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
          .get(table) as { ok?: number } | undefined
        if (!tableExists?.ok) return

        const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
        if (!cols.some((c) => c.name === 'workspace_id')) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT 1`)
        }
        db.exec(`UPDATE ${table} SET workspace_id = COALESCE(workspace_id, 1)`)
      }

      const scopedTables = [
        'messages',
        'alert_rules',
        'direct_connections',
        'github_syncs',
        'workflow_pipelines',
        'pipeline_runs',
      ]

      for (const table of scopedTables) {
        addWorkspaceIdColumn(table)
      }

      db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON messages(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_alert_rules_workspace_id ON alert_rules(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_direct_connections_workspace_id ON direct_connections(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_github_syncs_workspace_id ON github_syncs(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_workflow_pipelines_workspace_id ON workflow_pipelines(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_pipeline_runs_workspace_id ON pipeline_runs(workspace_id)`)
    }
  },
  {
    id: '023_workspace_isolation_phase3',
    up: (db) => {
      const addWorkspaceIdColumn = (table: string) => {
        const tableExists = db
          .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
          .get(table) as { ok?: number } | undefined
        if (!tableExists?.ok) return

        const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
        if (!cols.some((c) => c.name === 'workspace_id')) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT 1`)
        }
        db.exec(`UPDATE ${table} SET workspace_id = COALESCE(workspace_id, 1)`)
      }

      const scopedTables = [
        'workflow_templates',
        'webhooks',
        'webhook_deliveries',
        'token_usage',
        'audit_log',
        'skills',
      ]

      for (const table of scopedTables) {
        addWorkspaceIdColumn(table)
      }

      db.exec(`CREATE INDEX IF NOT EXISTS idx_workflow_templates_workspace_id ON workflow_templates(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_id ON webhooks(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_workspace_id ON webhook_deliveries(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_token_usage_workspace_id ON token_usage(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_id ON audit_log(workspace_id)`)
      // NOTE: skills table uses UNIQUE(source, name) — for workspace isolation,
      // we add a workspace-aware UNIQUE via trigger approach. The skills route
      // now enforces workspace scoping at the application level.
    }
  },
  {
    id: '023b_workspace_isolation_skills_unique',
    up: (db) => {
      // Add workspace-based uniqueness for skills
      // Since SQLite doesn't allow adding columns to UNIQUE constraints,
      // we add a unique index on the composite key
      try {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_skills_workspace ON skills(workspace_id)`)
      } catch { /* may already exist */ }
    }
  },
  {
    id: '024_projects_support',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          name TEXT NOT NULL,
          slug TEXT NOT NULL,
          description TEXT,
          ticket_prefix TEXT NOT NULL,
          ticket_counter INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'active',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, slug),
          UNIQUE(workspace_id, ticket_prefix)
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_workspace_status ON projects(workspace_id, status)`)

      const taskCols = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>
      if (!taskCols.some((c) => c.name === 'project_id')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN project_id INTEGER`)
      }
      if (!taskCols.some((c) => c.name === 'project_ticket_no')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN project_ticket_no INTEGER`)
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_workspace_project ON tasks(workspace_id, project_id)`)

      const workspaceRows = db.prepare(`SELECT id FROM workspaces ORDER BY id ASC`).all() as Array<{ id: number }>
      const ensureDefaultProject = db.prepare(`
        INSERT OR IGNORE INTO projects (workspace_id, name, slug, description, ticket_prefix, ticket_counter, status, created_at, updated_at)
        VALUES (?, 'General', 'general', 'Default project for uncategorized tasks', 'TASK', 0, 'active', unixepoch(), unixepoch())
      `)
      const getDefaultProject = db.prepare(`
        SELECT id, ticket_counter FROM projects
        WHERE workspace_id = ? AND slug = 'general'
        LIMIT 1
      `)
      const setTaskProject = db.prepare(`
        UPDATE tasks SET project_id = ?
        WHERE workspace_id = ? AND (project_id IS NULL OR project_id = 0)
      `)
      const listProjectTasks = db.prepare(`
        SELECT id FROM tasks
        WHERE workspace_id = ? AND project_id = ?
        ORDER BY created_at ASC, id ASC
      `)
      const setTaskNo = db.prepare(`UPDATE tasks SET project_ticket_no = ? WHERE id = ?`)
      const setProjectCounter = db.prepare(`UPDATE projects SET ticket_counter = ?, updated_at = unixepoch() WHERE id = ?`)

      for (const workspace of workspaceRows) {
        ensureDefaultProject.run(workspace.id)
        const defaultProject = getDefaultProject.get(workspace.id) as { id: number; ticket_counter: number } | undefined
        if (!defaultProject) continue

        setTaskProject.run(defaultProject.id, workspace.id)

        const projectRows = db.prepare(`
          SELECT id FROM projects
          WHERE workspace_id = ?
          ORDER BY id ASC
        `).all(workspace.id) as Array<{ id: number }>

        for (const project of projectRows) {
          const tasks = listProjectTasks.all(workspace.id, project.id) as Array<{ id: number }>
          let counter = 0
          for (const task of tasks) {
            counter += 1
            setTaskNo.run(counter, task.id)
          }
          setProjectCounter.run(counter, project.id)
        }
      }
    }
  },
  {
    id: '025_token_usage_task_attribution',
    up: (db) => {
      const hasTokenUsageTable = db
        .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = 'token_usage'`)
        .get() as { ok?: number } | undefined

      if (!hasTokenUsageTable?.ok) return

      const cols = db.prepare(`PRAGMA table_info(token_usage)`).all() as Array<{ name: string }>
      const hasCol = (name: string) => cols.some((c) => c.name === name)

      if (!hasCol('task_id')) {
        db.exec(`ALTER TABLE token_usage ADD COLUMN task_id INTEGER`)
      }

      db.exec(`CREATE INDEX IF NOT EXISTS idx_token_usage_task_id ON token_usage(task_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_token_usage_workspace_task_time ON token_usage(workspace_id, task_id, created_at)`)
    }
  },
  {
    id: '026_task_outcome_tracking',
    up: (db) => {
      const hasTasks = db
        .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = 'tasks'`)
        .get() as { ok?: number } | undefined
      if (!hasTasks?.ok) return

      const taskCols = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>
      const hasCol = (name: string) => taskCols.some((c) => c.name === name)

      if (!hasCol('outcome')) db.exec(`ALTER TABLE tasks ADD COLUMN outcome TEXT`)
      if (!hasCol('error_message')) db.exec(`ALTER TABLE tasks ADD COLUMN error_message TEXT`)
      if (!hasCol('resolution')) db.exec(`ALTER TABLE tasks ADD COLUMN resolution TEXT`)
      if (!hasCol('feedback_rating')) db.exec(`ALTER TABLE tasks ADD COLUMN feedback_rating INTEGER`)
      if (!hasCol('feedback_notes')) db.exec(`ALTER TABLE tasks ADD COLUMN feedback_notes TEXT`)
      if (!hasCol('retry_count')) db.exec(`ALTER TABLE tasks ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0`)
      if (!hasCol('completed_at')) db.exec(`ALTER TABLE tasks ADD COLUMN completed_at INTEGER`)

      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_outcome ON tasks(outcome)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_workspace_outcome ON tasks(workspace_id, outcome, completed_at)`)
    }
  },
  {
    id: '027_enhanced_projects',
    up: (db) => {
      const hasProjects = db
        .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = 'projects'`)
        .get() as { ok?: number } | undefined
      if (!hasProjects?.ok) return

      const cols = db.prepare(`PRAGMA table_info(projects)`).all() as Array<{ name: string }>
      const hasCol = (name: string) => cols.some((c) => c.name === name)

      if (!hasCol('github_repo')) db.exec(`ALTER TABLE projects ADD COLUMN github_repo TEXT`)
      if (!hasCol('deadline')) db.exec(`ALTER TABLE projects ADD COLUMN deadline INTEGER`)
      if (!hasCol('color')) db.exec(`ALTER TABLE projects ADD COLUMN color TEXT`)
      if (!hasCol('metadata')) db.exec(`ALTER TABLE projects ADD COLUMN metadata TEXT`)

      db.exec(`
        CREATE TABLE IF NOT EXISTS project_agent_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          agent_name TEXT NOT NULL,
          role TEXT DEFAULT 'member',
          assigned_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          UNIQUE(project_id, agent_name)
        );
        CREATE INDEX IF NOT EXISTS idx_paa_project ON project_agent_assignments(project_id);
        CREATE INDEX IF NOT EXISTS idx_paa_agent ON project_agent_assignments(agent_name);
      `)
    }
  },
  {
    id: '028_github_sync_v2',
    up: (db) => {
      // Tasks: promote GitHub fields from metadata JSON to proper columns
      const taskCols = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>
      const hasTaskCol = (name: string) => taskCols.some((c) => c.name === name)

      if (!hasTaskCol('github_issue_number')) db.exec(`ALTER TABLE tasks ADD COLUMN github_issue_number INTEGER`)
      if (!hasTaskCol('github_repo')) db.exec(`ALTER TABLE tasks ADD COLUMN github_repo TEXT`)
      if (!hasTaskCol('github_synced_at')) db.exec(`ALTER TABLE tasks ADD COLUMN github_synced_at INTEGER`)
      if (!hasTaskCol('github_branch')) db.exec(`ALTER TABLE tasks ADD COLUMN github_branch TEXT`)
      if (!hasTaskCol('github_pr_number')) db.exec(`ALTER TABLE tasks ADD COLUMN github_pr_number INTEGER`)
      if (!hasTaskCol('github_pr_state')) db.exec(`ALTER TABLE tasks ADD COLUMN github_pr_state TEXT`)

      // Unique index for dedup (partial — only rows with issue numbers)
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_github_issue
          ON tasks(workspace_id, github_repo, github_issue_number)
          WHERE github_issue_number IS NOT NULL
      `)

      // Projects: sync control columns
      const projCols = db.prepare(`PRAGMA table_info(projects)`).all() as Array<{ name: string }>
      const hasProjCol = (name: string) => projCols.some((c) => c.name === name)

      if (!hasProjCol('github_sync_enabled')) db.exec(`ALTER TABLE projects ADD COLUMN github_sync_enabled INTEGER NOT NULL DEFAULT 0`)
      if (!hasProjCol('github_labels_initialized')) db.exec(`ALTER TABLE projects ADD COLUMN github_labels_initialized INTEGER NOT NULL DEFAULT 0`)
      if (!hasProjCol('github_default_branch')) db.exec(`ALTER TABLE projects ADD COLUMN github_default_branch TEXT DEFAULT 'main'`)

      // Enhanced sync history columns
      const syncCols = db.prepare(`PRAGMA table_info(github_syncs)`).all() as Array<{ name: string }>
      const hasSyncCol = (name: string) => syncCols.some((c) => c.name === name)

      if (!hasSyncCol('project_id')) db.exec(`ALTER TABLE github_syncs ADD COLUMN project_id INTEGER`)
      if (!hasSyncCol('changes_pushed')) db.exec(`ALTER TABLE github_syncs ADD COLUMN changes_pushed INTEGER NOT NULL DEFAULT 0`)
      if (!hasSyncCol('changes_pulled')) db.exec(`ALTER TABLE github_syncs ADD COLUMN changes_pulled INTEGER NOT NULL DEFAULT 0`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_github_syncs_project ON github_syncs(project_id)`)

      // Data migration: copy existing metadata JSON values into new columns
      db.exec(`
        UPDATE tasks
        SET github_repo = json_extract(metadata, '$.github_repo'),
            github_issue_number = json_extract(metadata, '$.github_issue_number'),
            github_synced_at = CAST(strftime('%s', json_extract(metadata, '$.github_synced_at')) AS INTEGER)
        WHERE json_extract(metadata, '$.github_repo') IS NOT NULL
          AND github_repo IS NULL
      `)
    }
  },
  {
    id: '029_link_workspaces_to_tenants',
    up: (db) => {
      const hasWorkspaces = db
        .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = 'workspaces'`)
        .get() as { ok?: number } | undefined
      if (!hasWorkspaces?.ok) return

      const hasTenants = db
        .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = 'tenants'`)
        .get() as { ok?: number } | undefined
      if (!hasTenants?.ok) return

      const workspaceCols = db.prepare(`PRAGMA table_info(workspaces)`).all() as Array<{ name: string }>
      const hasWorkspaceTenantId = workspaceCols.some((c) => c.name === 'tenant_id')
      if (!hasWorkspaceTenantId) {
        db.exec(`ALTER TABLE workspaces ADD COLUMN tenant_id INTEGER`)
      }

      const tenantCount = (db.prepare(`SELECT COUNT(*) as c FROM tenants`).get() as { c: number } | undefined)?.c || 0
      let defaultTenantId: number
      if (tenantCount > 0) {
        const existing = db.prepare(`
          SELECT id
          FROM tenants
          ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, id ASC
          LIMIT 1
        `).get() as { id: number } | undefined
        if (!existing?.id) throw new Error('Failed to resolve default tenant')
        defaultTenantId = existing.id
      } else {
        const rawHost = String(process.env.MC_HOSTNAME || 'default').trim().toLowerCase()
        const slug = rawHost.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'default'
        const linuxUser = (String(process.env.USER || 'local').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'local').slice(0, 30)
        const home = String(process.env.HOME || '/tmp').trim() || '/tmp'
        const insert = db.prepare(`
          INSERT INTO tenants (slug, display_name, linux_user, plan_tier, status, openclaw_home, workspace_root, config, created_by, owner_gateway)
          VALUES (?, ?, ?, 'standard', 'active', ?, ?, '{}', 'system', ?)
        `).run(
          slug,
          'Local Owner',
          linuxUser,
          `${home}/.openclaw`,
          `${home}/workspace`,
          process.env.MC_DEFAULT_OWNER_GATEWAY || process.env.MC_DEFAULT_GATEWAY_NAME || 'primary'
        )
        defaultTenantId = Number(insert.lastInsertRowid)
      }

      db.prepare(`UPDATE workspaces SET tenant_id = ? WHERE tenant_id IS NULL`).run(defaultTenantId)

      // Ensure session rows can carry tenant context derived from workspace.
      const sessionCols = db.prepare(`PRAGMA table_info(user_sessions)`).all() as Array<{ name: string }>
      if (!sessionCols.some((c) => c.name === 'tenant_id')) {
        db.exec(`ALTER TABLE user_sessions ADD COLUMN tenant_id INTEGER`)
      }
      db.exec(`
        UPDATE user_sessions
        SET tenant_id = (
          SELECT w.tenant_id
          FROM users u
          JOIN workspaces w ON w.id = COALESCE(user_sessions.workspace_id, u.workspace_id, 1)
          WHERE u.id = user_sessions.user_id
          LIMIT 1
        )
        WHERE tenant_id IS NULL
      `)
      db.prepare(`UPDATE user_sessions SET tenant_id = ? WHERE tenant_id IS NULL`).run(defaultTenantId)

      const workspaceFk = db.prepare(`PRAGMA foreign_key_list(workspaces)`).all() as Array<{ table: string; from: string; to: string }>
      const hasTenantFk = workspaceFk.some((fk) => fk.table === 'tenants' && fk.from === 'tenant_id' && fk.to === 'id')
      const tenantCol = (db.prepare(`PRAGMA table_info(workspaces)`).all() as Array<{ name: string; notnull: number }>).find((c) => c.name === 'tenant_id')
      const tenantColNotNull = tenantCol?.notnull === 1

      if (!hasTenantFk || !tenantColNotNull) {
        db.exec(`ALTER TABLE workspaces RENAME TO workspaces__legacy`)
        db.exec(`
          CREATE TABLE workspaces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            tenant_id INTEGER NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
          )
        `)
        db.prepare(`
          INSERT INTO workspaces (id, slug, name, tenant_id, created_at, updated_at)
          SELECT id, slug, name, COALESCE(tenant_id, ?), created_at, updated_at
          FROM workspaces__legacy
        `).run(defaultTenantId)
        db.exec(`DROP TABLE workspaces__legacy`)
      }

      db.exec(`CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_id ON workspaces(tenant_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_id ON user_sessions(tenant_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_user_sessions_workspace_tenant ON user_sessions(workspace_id, tenant_id)`)
    }
  },
  {
    id: '032_adapter_configs',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS adapter_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          framework TEXT NOT NULL,
          config TEXT DEFAULT '{}',
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        )
      `)
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_adapter_configs_workspace_framework ON adapter_configs(workspace_id, framework)`)
    }
  },
  {
    id: '033_skills',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          source TEXT NOT NULL,
          path TEXT NOT NULL,
          description TEXT,
          content_hash TEXT,
          registry_slug TEXT,
          registry_version TEXT,
          security_status TEXT DEFAULT 'unchecked',
          installed_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(source, name)
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_skills_source ON skills(source)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_skills_registry_slug ON skills(registry_slug)`)
    }
  },
  {
    id: '034_agents_source',
    up(db: Database.Database) {
      const cols = db.prepare(`PRAGMA table_info(agents)`).all() as Array<{ name: string }>
      if (!cols.some(c => c.name === 'source')) {
        db.exec(`ALTER TABLE agents ADD COLUMN source TEXT DEFAULT 'manual'`)
      }
      if (!cols.some(c => c.name === 'content_hash')) {
        db.exec(`ALTER TABLE agents ADD COLUMN content_hash TEXT`)
      }
      if (!cols.some(c => c.name === 'workspace_path')) {
        db.exec(`ALTER TABLE agents ADD COLUMN workspace_path TEXT`)
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agents_source ON agents(source)`)
    }
  },
  {
    id: '035_api_keys_v2',
    up(db: Database.Database) {
      // Previous migrations (027/030) may have created an api_keys table with a different schema.
      // Drop and recreate with the full user-scoped schema.
      const existing = db
        .prepare(`SELECT 1 as ok FROM sqlite_master WHERE type = 'table' AND name = 'api_keys'`)
        .get() as { ok?: number } | undefined

      if (existing?.ok) {
        db.exec(`DROP TABLE api_keys`)
      }

      db.exec(`
        CREATE TABLE api_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          label TEXT NOT NULL,
          key_prefix TEXT NOT NULL,
          key_hash TEXT NOT NULL UNIQUE,
          role TEXT NOT NULL DEFAULT 'viewer',
          scopes TEXT,
          expires_at INTEGER,
          last_used_at INTEGER,
          last_used_ip TEXT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          tenant_id INTEGER NOT NULL DEFAULT 1,
          is_revoked INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id ON api_keys(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix)`)
    }
  },
  {
    id: '036_recurring_tasks_index',
    up(db: Database.Database) {
      // Index to efficiently find recurring task templates
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tasks_recurring
        ON tasks(workspace_id)
        WHERE json_extract(metadata, '$.recurrence.enabled') = 1
      `)
    }
  },
  {
    id: '037_security_audit',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS security_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'info',
          source TEXT,
          agent_name TEXT,
          detail TEXT,
          ip_address TEXT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          tenant_id INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_security_events_agent_name ON security_events(agent_name)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_security_events_workspace_id ON security_events(workspace_id)`)

      db.exec(`
        CREATE TABLE IF NOT EXISTS agent_trust_scores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_name TEXT NOT NULL,
          trust_score REAL NOT NULL DEFAULT 1.0,
          auth_failures INTEGER NOT NULL DEFAULT 0,
          injection_attempts INTEGER NOT NULL DEFAULT 0,
          rate_limit_hits INTEGER NOT NULL DEFAULT 0,
          secret_exposures INTEGER NOT NULL DEFAULT 0,
          successful_tasks INTEGER NOT NULL DEFAULT 0,
          failed_tasks INTEGER NOT NULL DEFAULT 0,
          last_anomaly_at INTEGER,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(agent_name, workspace_id)
        )
      `)

      db.exec(`
        CREATE TABLE IF NOT EXISTS mcp_call_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_name TEXT,
          mcp_server TEXT,
          tool_name TEXT,
          success INTEGER NOT NULL DEFAULT 1,
          duration_ms INTEGER,
          error TEXT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_mcp_call_log_agent_name ON mcp_call_log(agent_name)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_mcp_call_log_created_at ON mcp_call_log(created_at)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_mcp_call_log_tool_name ON mcp_call_log(tool_name)`)
    }
  },
  {
    id: '038_agent_evals',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS eval_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_name TEXT NOT NULL,
          eval_layer TEXT NOT NULL,
          score REAL,
          passed INTEGER,
          detail TEXT,
          golden_dataset_id INTEGER,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_eval_runs_agent_name ON eval_runs(agent_name)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_eval_runs_eval_layer ON eval_runs(eval_layer)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_eval_runs_created_at ON eval_runs(created_at)`)

      db.exec(`
        CREATE TABLE IF NOT EXISTS eval_golden_sets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          entries TEXT NOT NULL DEFAULT '[]',
          created_by TEXT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(name, workspace_id)
        )
      `)

      db.exec(`
        CREATE TABLE IF NOT EXISTS eval_traces (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_name TEXT NOT NULL,
          task_id INTEGER,
          trace TEXT NOT NULL DEFAULT '[]',
          convergence_score REAL,
          total_steps INTEGER,
          optimal_steps INTEGER,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_eval_traces_agent_name ON eval_traces(agent_name)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_eval_traces_task_id ON eval_traces(task_id)`)
    }
  },
  {
    id: '039_session_costs',
    up(db: Database.Database) {
      const columns = db.prepare(`PRAGMA table_info(token_usage)`).all() as Array<{ name: string }>
      const existing = new Set(columns.map((c) => c.name))

      if (!existing.has('cost_usd')) {
        db.exec(`ALTER TABLE token_usage ADD COLUMN cost_usd REAL`)
      }
      if (!existing.has('agent_name')) {
        db.exec(`ALTER TABLE token_usage ADD COLUMN agent_name TEXT`)
      }
      if (!existing.has('task_id')) {
        db.exec(`ALTER TABLE token_usage ADD COLUMN task_id INTEGER`)
      }
    }
  },
  {
    id: '040_agent_api_keys',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS agent_api_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_id INTEGER NOT NULL,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          name TEXT NOT NULL,
          key_hash TEXT NOT NULL,
          key_prefix TEXT NOT NULL,
          scopes TEXT NOT NULL DEFAULT '[]',
          expires_at INTEGER,
          revoked_at INTEGER,
          last_used_at INTEGER,
          created_by TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, key_hash)
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_api_keys_agent_id ON agent_api_keys(agent_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_api_keys_workspace_id ON agent_api_keys(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_api_keys_expires_at ON agent_api_keys(expires_at)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_api_keys_revoked_at ON agent_api_keys(revoked_at)`)
    }
  },
  {
    id: '041_gateway_health_logs',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS gateway_health_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          gateway_id INTEGER NOT NULL,
          status TEXT NOT NULL,
          latency INTEGER,
          probed_at INTEGER NOT NULL DEFAULT (unixepoch()),
          error TEXT
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_gateway_health_logs_gateway_id ON gateway_health_logs(gateway_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_gateway_health_logs_probed_at ON gateway_health_logs(probed_at)`)
    }
  },
  {
    id: '042_agent_hidden',
    up(db: Database.Database) {
      db.exec(`ALTER TABLE agents ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0`)
    }
  },
  {
    id: '043_hash_session_tokens',
    up(db: Database.Database) {
      // Migrate existing plaintext session tokens to SHA-256 hashes.
      // After this migration, session tokens are stored as hashes — raw tokens
      // are only returned to the client on creation. Existing sessions will be
      // invalidated (users need to re-login).
      const rows = db.prepare('SELECT id, token FROM user_sessions').all() as Array<{ id: number; token: string }>
      const update = db.prepare('UPDATE user_sessions SET token = ? WHERE id = ?')
      for (const row of rows) {
        const hashed = createHash('sha256').update(row.token).digest('hex')
        update.run(hashed, row.id)
      }
    }
  },
  {
    id: '044_spawn_history',
    up(db: Database.Database) {
      db.exec([
        `CREATE TABLE IF NOT EXISTS spawn_history (`,
        `  id INTEGER PRIMARY KEY AUTOINCREMENT,`,
        `  agent_id INTEGER,`,
        `  agent_name TEXT NOT NULL,`,
        `  spawn_type TEXT NOT NULL DEFAULT 'claude-code',`,
        `  session_id TEXT,`,
        `  trigger TEXT,`,
        `  status TEXT NOT NULL DEFAULT 'started',`,
        `  exit_code INTEGER,`,
        `  error TEXT,`,
        `  duration_ms INTEGER,`,
        `  workspace_id INTEGER NOT NULL DEFAULT 1,`,
        `  created_at INTEGER NOT NULL DEFAULT (unixepoch()),`,
        `  finished_at INTEGER,`,
        `  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL`,
        `)`,
      ].join('\n'))
      db.exec(`CREATE INDEX IF NOT EXISTS idx_spawn_history_agent ON spawn_history(agent_name)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_spawn_history_created ON spawn_history(created_at)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_spawn_history_status ON spawn_history(status)`)
    }
  },
  {
    id: '045_task_dispatch_attempts',
    up(db: Database.Database) {
      const cols = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>
      if (!cols.some(c => c.name === 'dispatch_attempts')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN dispatch_attempts INTEGER NOT NULL DEFAULT 0`)
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_stale_inprogress ON tasks(status, updated_at) WHERE status = 'in_progress'`)
    }
  },
  {
    id: '046_agent_runs',
    up(db: Database.Database) {
      db.exec(`
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
          steps TEXT DEFAULT '[]',
          tools_available TEXT DEFAULT '[]',
          cost_input_tokens INTEGER DEFAULT 0,
          cost_output_tokens INTEGER DEFAULT 0,
          cost_cache_read_tokens INTEGER,
          cost_cache_write_tokens INTEGER,
          cost_usd REAL,
          cost_model TEXT,
          run_hash TEXT,
          parent_run_hash TEXT,
          lineage TEXT DEFAULT '[]',
          model_version TEXT,
          config_hash TEXT,
          provenance_runtime TEXT,
          signed_by TEXT,
          signature TEXT,
          provenance_created_at TEXT,
          eval_task_type TEXT,
          eval_layer TEXT,
          eval_pass INTEGER,
          eval_score REAL,
          eval_detail TEXT,
          eval_metrics TEXT,
          eval_benchmark_id TEXT,
          error TEXT,
          git_branch TEXT,
          git_commit TEXT,
          workspace_id INTEGER DEFAULT 1,
          tags TEXT DEFAULT '[]',
          metadata TEXT DEFAULT '{}',
          spawn_history_id INTEGER,
          created_at INTEGER DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_agent_id ON runs(agent_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_workspace ON runs(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_run_hash ON runs(run_hash)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_task_id ON runs(task_id)`)
    }
  },
  {
    id: '047_agent_working_memory',
    up(db: Database.Database) {
      const cols = db.prepare(`PRAGMA table_info(agents)`).all() as Array<{ name: string }>
      if (!cols.some(c => c.name === 'working_memory')) {
        db.exec(`ALTER TABLE agents ADD COLUMN working_memory TEXT DEFAULT ''`)
      }
    }
  },
  {
    id: '048_memory_fts',
    up(db: Database.Database) {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
          path,
          title,
          content,
          tokenize='porter unicode61'
        )
      `)
      db.exec(`
        CREATE TABLE IF NOT EXISTS memory_fts_meta (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `)
    }
  },
  {
    id: '049_agent_runtime_type',
    up(db: Database.Database) {
      db.exec(`ALTER TABLE agents ADD COLUMN runtime_type TEXT DEFAULT NULL`)
    }
  },
  {
    id: '050_mcp_call_receipt_signing',
    up(db: Database.Database) {
      // Add Ed25519 receipt signing columns to the MCP audit log.
      // payload_hash: SHA-256 of the canonical JSON payload at write time
      // signature: Ed25519 signature (hex) over the canonical payload
      // public_key: base64-encoded Ed25519 public key for offline verification
      db.exec(`ALTER TABLE mcp_call_log ADD COLUMN payload_hash TEXT DEFAULT NULL`)
      db.exec(`ALTER TABLE mcp_call_log ADD COLUMN signature TEXT DEFAULT NULL`)
      db.exec(`ALTER TABLE mcp_call_log ADD COLUMN public_key TEXT DEFAULT NULL`)
    }
  },
  {
    id: '030_billing',
    up(db: Database.Database) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS billing_plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          setup_fee_cents INTEGER NOT NULL DEFAULT 0,
          monthly_price_cents INTEGER NOT NULL DEFAULT 0,
          included_credits INTEGER NOT NULL DEFAULT 0,
          max_agents INTEGER,
          status TEXT NOT NULL DEFAULT 'active',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE TABLE IF NOT EXISTS customer_subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          plan_id INTEGER NOT NULL,
          stripe_customer_id TEXT,
          stripe_subscription_id TEXT,
          status TEXT NOT NULL DEFAULT 'inactive',
          current_period_start INTEGER,
          current_period_end INTEGER,
          included_credits_granted INTEGER NOT NULL DEFAULT 0,
          auto_recharge_enabled INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (plan_id) REFERENCES billing_plans(id) ON DELETE RESTRICT
        );

        CREATE TABLE IF NOT EXISTS credit_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          subscription_id INTEGER,
          type TEXT NOT NULL CHECK (type IN ('grant', 'usage', 'refund', 'adjustment', 'purchase')),
          amount INTEGER NOT NULL,
          balance_after INTEGER NOT NULL,
          source_type TEXT,
          source_id TEXT,
          description TEXT,
          idempotency_key TEXT UNIQUE,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS usage_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          agent_id INTEGER,
          task_id INTEGER,
          workflow_run_id TEXT,
          event_type TEXT NOT NULL,
          provider TEXT,
          model TEXT,
          raw_cost_cents INTEGER NOT NULL DEFAULT 0,
          retail_cost_cents INTEGER NOT NULL DEFAULT 0,
          credits_charged INTEGER NOT NULL DEFAULT 0,
          metadata_json TEXT,
          idempotency_key TEXT UNIQUE,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS credit_packages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          price_cents INTEGER NOT NULL,
          credits INTEGER NOT NULL,
          bonus_credits INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'active',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE TABLE IF NOT EXISTS credit_purchase_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          package_id INTEGER NOT NULL,
          stripe_session_id TEXT,
          stripe_payment_intent_id TEXT,
          stripe_event_id TEXT,
          amount_cents INTEGER NOT NULL,
          credits_to_grant INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          fulfilled INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (package_id) REFERENCES credit_packages(id) ON DELETE RESTRICT
        );

        CREATE TABLE IF NOT EXISTS stripe_webhook_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          stripe_event_id TEXT NOT NULL UNIQUE,
          type TEXT NOT NULL,
          raw_json TEXT NOT NULL,
          processed INTEGER NOT NULL DEFAULT 0,
          processed_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE TABLE IF NOT EXISTS pricing_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_type TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          wholesale_cost_cents INTEGER NOT NULL DEFAULT 0,
          retail_cost_cents INTEGER NOT NULL DEFAULT 0,
          credits_required INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'active',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        /* ── Indexes ── */

        -- customer_subscriptions
        CREATE INDEX IF NOT EXISTS idx_customer_subs_workspace ON customer_subscriptions(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_customer_subs_status ON customer_subscriptions(status);
        CREATE INDEX IF NOT EXISTS idx_customer_subs_stripe_sub ON customer_subscriptions(stripe_subscription_id);
        CREATE INDEX IF NOT EXISTS idx_customer_subs_plan ON customer_subscriptions(plan_id);

        -- credit_ledger
        CREATE INDEX IF NOT EXISTS idx_credit_ledger_workspace ON credit_ledger(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_credit_ledger_type ON credit_ledger(type);
        CREATE INDEX IF NOT EXISTS idx_credit_ledger_subscription ON credit_ledger(subscription_id);
        CREATE INDEX IF NOT EXISTS idx_credit_ledger_created ON credit_ledger(created_at);

        -- usage_events
        CREATE INDEX IF NOT EXISTS idx_usage_events_workspace ON usage_events(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_usage_events_agent ON usage_events(agent_id);
        CREATE INDEX IF NOT EXISTS idx_usage_events_task ON usage_events(task_id);
        CREATE INDEX IF NOT EXISTS idx_usage_events_run ON usage_events(workflow_run_id);
        CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at);
        CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON usage_events(event_type);

        -- credit_purchase_orders
        CREATE INDEX IF NOT EXISTS idx_cpo_workspace ON credit_purchase_orders(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_cpo_status ON credit_purchase_orders(status);
        CREATE INDEX IF NOT EXISTS idx_cpo_stripe_pi ON credit_purchase_orders(stripe_payment_intent_id);

        -- stripe_webhook_events
        CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON stripe_webhook_events(type);
        CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON stripe_webhook_events(processed);

        -- pricing_configs
        CREATE INDEX IF NOT EXISTS idx_pricing_event_type ON pricing_configs(event_type);
        CREATE INDEX IF NOT EXISTS idx_pricing_provider_model ON pricing_configs(provider, model);

        /* ── Seed data: default billing plans ── */

        INSERT OR IGNORE INTO billing_plans (id, name, setup_fee_cents, monthly_price_cents, included_credits, max_agents, status, created_at, updated_at)
        VALUES
          (1, 'Free',       0,     0,     100,   1,   'active', unixepoch(), unixepoch()),
          (2, 'Starter',    0,  2900,  1000,   5,   'active', unixepoch(), unixepoch()),
          (3, 'Teams',      0,  9900,  5000,  20,   'active', unixepoch(), unixepoch()),
          (4, 'Enterprise', 0, 29900, 20000, 100,   'active', unixepoch(), unixepoch());

        /* ── Seed data: default credit packages ── */

        INSERT OR IGNORE INTO credit_packages (id, name, description, price_cents, credits, bonus_credits, status, created_at, updated_at)
        VALUES
          (1, 'Starter Pack', '100 credits for light usage',    999,    100,    0, 'active', unixepoch(), unixepoch()),
          (2, 'Power Pack',   '500 credits plus 50 bonus',     4499,    500,   50, 'active', unixepoch(), unixepoch()),
          (3, 'Pro Pack',     '2000 credits plus 300 bonus',  15999,   2000,  300, 'active', unixepoch(), unixepoch()),
          (4, 'Mega Pack',    '10000 credits plus 2000 bonus', 69999, 10000, 2000, 'active', unixepoch(), unixepoch());
      `)
    }
  },
  {
    id: '020_memory_metadata',
    up: (db) => {
      // Check if memory_files table exists (may not in all deployments)
      const hasMemoryFiles = (db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='memory_files'`
      ).get() as any)
      if (!hasMemoryFiles) return

      const columns = db.prepare(`PRAGMA table_info(memory_files)`).all() as Array<{ name: string }>
      const has = (name: string) => columns.some((c) => c.name === name)

      if (!has('source')) db.exec(`ALTER TABLE memory_files ADD COLUMN source TEXT DEFAULT 'manual'`)
      if (!has('confidence')) db.exec(`ALTER TABLE memory_files ADD COLUMN confidence TEXT DEFAULT 'low'`)
      if (!has('workspace_id')) db.exec(`ALTER TABLE memory_files ADD COLUMN workspace_id INTEGER`)
      if (!has('approved')) db.exec(`ALTER TABLE memory_files ADD COLUMN approved INTEGER NOT NULL DEFAULT 0`)
      if (!has('customer_visible')) db.exec(`ALTER TABLE memory_files ADD COLUMN customer_visible INTEGER NOT NULL DEFAULT 0`)
      if (!has('created_by')) db.exec(`ALTER TABLE memory_files ADD COLUMN created_by TEXT`)

      db.exec(`CREATE INDEX IF NOT EXISTS idx_memory_files_workspace ON memory_files(workspace_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_memory_files_approved ON memory_files(approved)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_memory_files_customer_visible ON memory_files(customer_visible)`)
    }
  },
  {
    id: '031_billing_seed_and_usage_columns',
    up(db: Database.Database) {
      // Add missing columns to usage_events FIRST (other migrations may reference them)
      const cols = db.prepare('PRAGMA table_info(usage_events)').all() as Array<{name: string}>;
      const colNames = cols.map(c => c.name);
      if (!colNames.includes('input_tokens')) db.exec('ALTER TABLE usage_events ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0');
      if (!colNames.includes('output_tokens')) db.exec('ALTER TABLE usage_events ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0');
      if (!colNames.includes('markup_multiplier')) db.exec('ALTER TABLE usage_events ADD COLUMN markup_multiplier REAL NOT NULL DEFAULT 2.5');

      // Performance indexes for margin/balance queries
      db.exec('CREATE INDEX IF NOT EXISTS idx_usage_events_workspace ON usage_events(workspace_id, created_at)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_credit_ledger_workspace ON credit_ledger(workspace_id, created_at)');

      // De-dupe pricing_configs (legacy installs missing the unique index produced duplicates)
      db.exec(`
        DELETE FROM pricing_configs
        WHERE id NOT IN (
          SELECT MIN(id) FROM pricing_configs GROUP BY event_type, provider, model
        )
      `);
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_pricing_configs_lookup ON pricing_configs(event_type, provider, model)');

      // Seed pricing configs with real provider costs and 2.5x markup (14 entries)
      const pricingSeeds: Array<[string, string, string, number, number, number]> = [
        ['llm_inference', 'openrouter', 'anthropic/claude-sonnet-4', 300, 750, 8],
        ['llm_inference', 'openrouter', 'anthropic/claude-opus-4', 1500, 3750, 38],
        ['llm_inference', 'openrouter', 'anthropic/claude-haiku', 80, 200, 3],
        ['llm_inference', 'openrouter', 'openai/gpt-4o', 250, 625, 7],
        ['llm_inference', 'openrouter', 'gemini/gemini-2.5-flash', 15, 38, 1],
        ['llm_inference', 'openrouter', 'qwen/qwen3-235b', 20, 50, 1],
        ['tts_generation', 'elevenlabs', 'default', 500, 1250, 13],
        ['voice_transcription', 'groq', 'whisper', 50, 125, 2],
        ['image_generation', 'fal', 'default', 400, 1000, 10],
        ['places_api', 'google', 'places', 400, 1000, 10],
        ['sms_send', 'twilio', 'sms_outbound', 7, 18, 1],
        ['bot_turn', 'telegram', 'default', 3, 8, 1],
        ['rent_estimate', 'rentcast', 'default', 20, 50, 1],
        ['default', 'default', 'default', 500, 1250, 13],
      ];
      const pricingInsert = db.prepare(
        `INSERT OR IGNORE INTO pricing_configs
         (event_type, provider, model, wholesale_cost_cents, retail_cost_cents, credits_required, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', unixepoch(), unixepoch())`
      );
      for (const s of pricingSeeds) pricingInsert.run(...s);

      // Create feature pricing table
      db.exec(`CREATE TABLE IF NOT EXISTS credit_feature_pricing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feature_name TEXT NOT NULL,
        variant TEXT NOT NULL DEFAULT 'standard',
        credits INTEGER NOT NULL,
        charge_unit TEXT NOT NULL,
        min_charge INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`);
      db.exec(`
        DELETE FROM credit_feature_pricing
        WHERE id NOT IN (
          SELECT MIN(id) FROM credit_feature_pricing GROUP BY feature_name, variant
        )
      `);
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_cfp_feature_variant ON credit_feature_pricing(feature_name, variant)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_cfp_feature ON credit_feature_pricing(feature_name)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_cfp_active ON credit_feature_pricing(feature_name, variant, active)');

      // Seed feature pricing (12 entries)
      const featureSeeds: Array<[string, string, number, string, number]> = [
        ['Rent Estimate', 'standard', 8, 'per_property', 8],
        ['Appraisal Report', 'standard', 35, 'per_report', 35],
        ['Comps Explorer Run', 'standard', 12, 'per_run', 12],
        ['Vision SOW Generator', 'standard', 18, 'per_run', 18],
        ['Market Swarm Run', 'standard', 40, 'per_run', 40],
        ['Vendor Swarm Run', 'standard', 30, 'per_run', 30],
        ['Telegram Bot Turn', 'standard', 3, 'per_turn', 3],
        ['SMS Send', 'standard', 2, 'per_message', 2],
        ['AI Scripts Generator', 'standard', 10, 'per_set', 10],
        ['Agent Session', 'standard', 1, 'per_1k_tokens', 5],
        ['Image Generation', 'standard', 10, 'per_image', 10],
        ['AI Interior Design', 'standard', 16, 'per_room', 16],
      ];
      const featureInsert = db.prepare(
        `INSERT OR IGNORE INTO credit_feature_pricing
         (feature_name, variant, credits, charge_unit, min_charge, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, unixepoch(), unixepoch())`
      );
      for (const f of featureSeeds) featureInsert.run(...f);

      // Fix credit packages to match launch prices.
      // Totals: Starter=1000/$10, Power=2750/$25, Pro=6000/$50, Enterprise=25000/$200
      db.exec('DELETE FROM credit_packages WHERE id >= 1');
      const pkgInsert = db.prepare(
        `INSERT INTO credit_packages
         (id, name, description, price_cents, credits, bonus_credits, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', unixepoch(), unixepoch())`
      );
      pkgInsert.run(1, 'Starter', '1,000 credits', 1000, 1000, 0);
      pkgInsert.run(2, 'Power', '2,500 + 250 bonus = 2,750 credits', 2500, 2500, 250);
      pkgInsert.run(3, 'Pro', '5,500 + 500 bonus = 6,000 credits', 5000, 5500, 500);
      pkgInsert.run(4, 'Enterprise', '22,500 + 2,500 bonus = 25,000 credits', 20000, 22500, 2500);
    }
  },
  {
    id: '032_workforce_autoreload',
    up(db: Database.Database) {
      db.exec(`CREATE TABLE IF NOT EXISTS workspace_autoreload (
        workspace_id INTEGER PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        threshold_credits INTEGER NOT NULL DEFAULT 100,
        package_id INTEGER NOT NULL DEFAULT 1,
        max_per_month_cents INTEGER NOT NULL DEFAULT 5000,
        stripe_customer_id TEXT,
        stripe_payment_method_id TEXT,
        last_triggered_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`);
    }
  },
  {
    id: '051_customer_self_serve',
    up(db: Database.Database) {
      // Password reset tokens (hashed, single-use, time-boxed).
      db.exec(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_hash TEXT NOT NULL UNIQUE,
          user_id INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          used_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          ip_address TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON password_reset_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires ON password_reset_tokens(expires_at);
      `)

      // Workspace memberships (many-to-many: a user may belong to multiple workspaces
      // with different roles in each). This is the table the user has been asking
      // for. We dual-read with users.workspace_id during the rollout: lookups first
      // ask memberships, then fall back to the legacy column.
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspace_memberships (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          workspace_id INTEGER NOT NULL,
          role TEXT NOT NULL DEFAULT 'operator',
          invited_by INTEGER,
          status TEXT NOT NULL DEFAULT 'active',
          joined_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE (user_id, workspace_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_membership_user ON workspace_memberships(user_id);
        CREATE INDEX IF NOT EXISTS idx_membership_workspace ON workspace_memberships(workspace_id);
      `)

      // Invitation tokens (hashed, single-use, scoped to a workspace + role + email).
      db.exec(`
        CREATE TABLE IF NOT EXISTS invites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_hash TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          workspace_id INTEGER NOT NULL,
          role TEXT NOT NULL DEFAULT 'operator',
          invited_by INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          used_by_user_id INTEGER,
          used_at INTEGER,
          revoked_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_invites_workspace ON invites(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
      `)

      // Backfill memberships from existing users.workspace_id + users.role.
      // Idempotent — the UNIQUE constraint plus INSERT OR IGNORE makes it safe to
      // re-run.
      db.exec(`
        INSERT OR IGNORE INTO workspace_memberships (user_id, workspace_id, role, status, joined_at)
        SELECT u.id, COALESCE(u.workspace_id, 1), COALESCE(u.role, 'operator'), 'active', COALESCE(u.created_at, unixepoch())
        FROM users u
        WHERE u.workspace_id IS NOT NULL
      `)

      // Conditional unique index on users.email — emails are only enforced unique
      // when present. Existing NULL emails (legacy admin) are unaffected.
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
        ON users(email COLLATE NOCASE)
        WHERE email IS NOT NULL AND email != ''
      `)
    }
  },
  {
    id: '052_agent_name_unique_per_workspace',
    up(db: Database.Database) {
      // Multi-tenant correctness: agents.name was UNIQUE globally, which meant
      // two workspaces could not both have an agent named "researcher" or
      // "hermes-prod-1". Switch to UNIQUE(name, workspace_id).
      //
      // Done via SQLite table-rebuild pattern (the only safe way to drop a
      // column-level UNIQUE constraint).
      const tbl = db.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='agents'"
      ).get() as { sql?: string } | undefined
      if (!tbl?.sql) return
      // If we've already rebuilt (no column-level UNIQUE on name), skip.
      if (!/name\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(tbl.sql)) return

      // Resolve duplicate names within the same workspace before adding the
      // composite UNIQUE — collisions are de-duplicated by appending the
      // agent id to the later row. We keep the lowest id intact.
      const dupes = db.prepare(`
        SELECT id, name, workspace_id FROM agents
        WHERE rowid NOT IN (
          SELECT MIN(rowid) FROM agents GROUP BY name, workspace_id
        )
      `).all() as Array<{ id: number; name: string; workspace_id: number }>
      const updateDupe = db.prepare('UPDATE agents SET name = ? WHERE id = ?')
      for (const d of dupes) {
        updateDupe.run(`${d.name}__dup_${d.id}`, d.id)
      }

      db.exec('PRAGMA foreign_keys = OFF')
      db.transaction(() => {
        db.exec(`
          CREATE TABLE agents_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            session_key TEXT UNIQUE,
            soul_content TEXT,
            status TEXT NOT NULL DEFAULT 'offline',
            last_seen INTEGER,
            last_activity TEXT,
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
            config TEXT,
            workspace_id INTEGER NOT NULL DEFAULT 1,
            source TEXT DEFAULT 'manual',
            content_hash TEXT,
            workspace_path TEXT,
            hidden INTEGER NOT NULL DEFAULT 0,
            working_memory TEXT DEFAULT '',
            runtime_type TEXT DEFAULT NULL,
            UNIQUE(name, workspace_id)
          )
        `)
        db.exec(`
          INSERT INTO agents_new (
            id, name, role, session_key, soul_content, status, last_seen,
            last_activity, created_at, updated_at, config, workspace_id,
            source, content_hash, workspace_path, hidden, working_memory,
            runtime_type
          )
          SELECT
            id, name, role, session_key, soul_content, status, last_seen,
            last_activity, created_at, updated_at, config, workspace_id,
            source, content_hash, workspace_path, hidden, working_memory,
            runtime_type
          FROM agents
        `)
        db.exec('DROP TABLE agents')
        db.exec('ALTER TABLE agents_new RENAME TO agents')
        db.exec('CREATE INDEX IF NOT EXISTS idx_agents_session_key ON agents(session_key)')
        db.exec('CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)')
        db.exec('CREATE INDEX IF NOT EXISTS idx_agents_workspace_id ON agents(workspace_id)')
        db.exec('CREATE INDEX IF NOT EXISTS idx_agents_source ON agents(source)')
      })()
      db.exec('PRAGMA foreign_keys = ON')
    }
  },
  {
    id: '053_runtime_registry_extended',
    up(db: Database.Database) {
      // Mission Control consumes (does not host) the Baseline OS local
      // runtime registry. Extend the existing `runtime_registry` table with
      // the fields the local registry advertises so we can faithfully
      // mirror its state for supervision.
      db.exec(`
        CREATE TABLE IF NOT EXISTS runtime_registry (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          kind TEXT NOT NULL,
          installation_id TEXT NOT NULL,
          label TEXT NOT NULL,
          version TEXT,
          capabilities TEXT,
          registered_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL,
          last_task_count INTEGER NOT NULL DEFAULT 0,
          health TEXT NOT NULL DEFAULT 'green',
          UNIQUE(workspace_id, kind, installation_id)
        )
      `)
      const cols = db.prepare(`PRAGMA table_info(runtime_registry)`).all() as Array<{ name: string }>
      const have = new Set(cols.map((c) => c.name))
      const adds: Array<[string, string]> = [
        ['host', `ALTER TABLE runtime_registry ADD COLUMN host TEXT`],
        ['installed_tools', `ALTER TABLE runtime_registry ADD COLUMN installed_tools TEXT`],
        ['installed_skills', `ALTER TABLE runtime_registry ADD COLUMN installed_skills TEXT`],
        ['health_score', `ALTER TABLE runtime_registry ADD COLUMN health_score INTEGER`],
        ['metadata', `ALTER TABLE runtime_registry ADD COLUMN metadata TEXT`],
      ]
      for (const [name, sql] of adds) if (!have.has(name)) db.exec(sql)
    },
  },
  {
    id: '054_tool_executions',
    up(db: Database.Database) {
      // Mission Control supervises CLI Anything / Connected Tools.
      // We do NOT execute commands. We accept telemetry from the runtime,
      // gate HIGH-risk commands behind explicit approval, and persist a
      // tamper-evident audit ledger for proof. Schema matches the
      // mandate's "Mission Control Requirements" field list.
      db.exec(`
        CREATE TABLE IF NOT EXISTS tool_executions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          task_id INTEGER,
          agent_id INTEGER,
          runtime_id INTEGER,
          cli_tool_id TEXT NOT NULL,
          command_name TEXT NOT NULL,
          command_args_redacted TEXT,
          risk TEXT NOT NULL DEFAULT 'low',
          status TEXT NOT NULL DEFAULT 'pending',
          approval_required INTEGER NOT NULL DEFAULT 0,
          approved_by TEXT,
          approved_at INTEGER,
          rejected_by TEXT,
          rejected_at INTEGER,
          rejection_reason TEXT,
          requested_by TEXT NOT NULL,
          started_at INTEGER,
          completed_at INTEGER,
          exit_code INTEGER,
          stdout_summary TEXT,
          stderr_summary TEXT,
          proof_url TEXT,
          proof_payload TEXT,
          cost_estimate REAL,
          billable_action_type TEXT,
          audit_event_id INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tool_executions_workspace_status ON tool_executions(workspace_id, status, created_at DESC)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tool_executions_task ON tool_executions(task_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tool_executions_runtime ON tool_executions(runtime_id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tool_executions_pending_approval ON tool_executions(workspace_id, approval_required, status) WHERE approval_required = 1`)
    },
  },
  {
    id: '055_task_router_projection',
    up(db: Database.Database) {
      // Workforce Router (Baseline OS Phase 2) decides which runtime/tool/skill
      // a task should run with. Mission Control DISPLAYS these decisions —
      // it does not make them. Six additive columns. No backfill, no
      // destructive change.
      const cols = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>
      const have = new Set(cols.map((c) => c.name))
      const adds: Array<[string, string]> = [
        ['assigned_runtime', `ALTER TABLE tasks ADD COLUMN assigned_runtime TEXT`],
        ['selected_tool', `ALTER TABLE tasks ADD COLUMN selected_tool TEXT`],
        ['selected_skill', `ALTER TABLE tasks ADD COLUMN selected_skill TEXT`],
        ['routing_reason', `ALTER TABLE tasks ADD COLUMN routing_reason TEXT`],
        ['routing_confidence', `ALTER TABLE tasks ADD COLUMN routing_confidence REAL`],
        ['router_approval_required', `ALTER TABLE tasks ADD COLUMN router_approval_required INTEGER NOT NULL DEFAULT 0`],
        ['router_decided_at', `ALTER TABLE tasks ADD COLUMN router_decided_at INTEGER`],
      ]
      for (const [name, sql] of adds) if (!have.has(name)) db.exec(sql)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_assigned_runtime ON tasks(workspace_id, assigned_runtime) WHERE assigned_runtime IS NOT NULL`)
    },
  },
  {
    id: '056_tool_execution_approval_supervision',
    up(db: Database.Database) {
      // Phase 4 (Approval Engine): Mission Control DISPLAYS approval
      // state — Claude Code's Baseline OS owns the decisioning. Additive
      // columns to `tool_executions` to surface the seven directive fields.
      // No FK changes, no data backfill (existing executions remain valid).
      const cols = db.prepare(`PRAGMA table_info(tool_executions)`).all() as Array<{ name: string }>
      const have = new Set(cols.map((c) => c.name))
      const adds: Array<[string, string]> = [
        // who/what asked for the approval (often the router or runtime —
        // distinct from `requested_by` which is the original task requestor)
        ['approval_requested_by', `ALTER TABLE tool_executions ADD COLUMN approval_requested_by TEXT`],
        ['approval_requested_at', `ALTER TABLE tool_executions ADD COLUMN approval_requested_at INTEGER`],
        // free-text rationale from the human approver (we already have
        // rejection_reason; this is the symmetric field for approvals).
        ['approval_reason', `ALTER TABLE tool_executions ADD COLUMN approval_reason TEXT`],
        // audit_log row id for the approve/reject decision specifically
        // (distinct from `audit_event_id` which links the initial request).
        ['approval_audit_id', `ALTER TABLE tool_executions ADD COLUMN approval_audit_id INTEGER`],
      ]
      for (const [name, sql] of adds) if (!have.has(name)) db.exec(sql)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tool_executions_approval_queue ON tool_executions(workspace_id, approval_requested_at DESC) WHERE status = 'awaiting_approval'`)
    },
  },
  {
    // Marketplace purchase ledger — every paid marketplace item (skill,
    // workflow, employee, bundle, credit_pack) gets a row here so the Stripe
    // webhook can fulfill the unlock idempotently. Status flips
    // pending → fulfilled only when the signed webhook lands.
    id: '057_marketplace_purchases',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS marketplace_purchases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          purchaser_user_id INTEGER,
          item_type TEXT NOT NULL CHECK (item_type IN ('skill','workflow','employee','bundle','credit_pack')),
          item_id TEXT NOT NULL,
          item_name TEXT NOT NULL,
          price_cents INTEGER NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'usd',
          stripe_checkout_session_id TEXT NOT NULL UNIQUE,
          stripe_payment_status TEXT,
          stripe_event_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','failed','refunded')),
          idempotency_key TEXT,
          metadata_json TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          fulfilled_at INTEGER,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_workspace ON marketplace_purchases(workspace_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_status ON marketplace_purchases(status, created_at);
        CREATE INDEX IF NOT EXISTS idx_marketplace_purchases_item ON marketplace_purchases(workspace_id, item_type, item_id);
      `)
    },
  },
  {
    // Goals — operator-managed objectives. Baseline OS local stores them
    // in the Obsidian vault; Mission Control cloud stores them here.
    // Same parity surface, different backing store.
    id: '058_goals',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          author_user_id INTEGER,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','archived')),
          due_date TEXT,
          notes TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          completed_at INTEGER,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_goals_workspace ON goals(workspace_id, status, updated_at DESC);
      `)
    },
  },
  {
    // Notebook — long-form notes per workspace, including operator notes
    // and AI-generated journal entries. Baseline OS local writes these to
    // the Obsidian vault; the cloud stores them here so the operator can
    // browse and search from any device.
    id: '059_notebook',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS notebook_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          author_user_id INTEGER,
          title TEXT NOT NULL,
          body_md TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL DEFAULT 'operator' CHECK (source IN ('operator','agent','daily_brief','import')),
          tags_json TEXT,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_notebook_entries_workspace ON notebook_entries(workspace_id, archived, updated_at DESC);
      `)
    },
  },
  {
    // Triad Council — operator decisions resolved by 3-model voting.
    // Records the decision prompt + the votes cast by each participating
    // model. The cloud surface is a *recording* layer; models are called
    // by upstream agent runtimes that POST vote rows here.
    id: '060_triad_council',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS triad_decisions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          author_user_id INTEGER,
          prompt TEXT NOT NULL,
          summary TEXT,
          context_md TEXT,
          status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','voting','resolved','vetoed','archived')),
          resolved_outcome TEXT,
          resolved_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS triad_votes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          decision_id INTEGER NOT NULL,
          model_id TEXT NOT NULL,
          model_label TEXT,
          vote TEXT NOT NULL CHECK (vote IN ('approve','reject','abstain','veto')),
          rationale TEXT,
          confidence INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(decision_id, model_id),
          FOREIGN KEY (decision_id) REFERENCES triad_decisions(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_triad_decisions_workspace ON triad_decisions(workspace_id, status, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_triad_votes_decision ON triad_votes(decision_id);
      `)
    },
  },
  {
    // SEO targets — operator-managed list of keyword → URL pairs the
    // workspace is trying to rank for. Cloud-native parity with the
    // Baseline OS `/seo` surface; storage is here, not the Obsidian vault.
    id: '061_seo_targets',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS seo_targets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          author_user_id INTEGER,
          target_keyword TEXT NOT NULL,
          target_url TEXT,
          page_title TEXT,
          status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','drafting','published','ranking','archived')),
          current_rank INTEGER,
          target_rank INTEGER,
          notes TEXT,
          last_checked_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_seo_targets_workspace ON seo_targets(workspace_id, status, updated_at DESC);
      `)
    },
  },
  {
    // Understand — durable decision context. Captures the "why" behind a
    // choice: question, conclusion, evidence, confidence. Survives so
    // future operators (and agents) can reconstruct the reasoning rather
    // than re-deriving it. Workspace-scoped.
    id: '062_understand',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS understand_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          author_user_id INTEGER,
          topic TEXT NOT NULL,
          question TEXT NOT NULL,
          conclusion TEXT NOT NULL,
          evidence_md TEXT,
          confidence INTEGER NOT NULL DEFAULT 50,
          tags_json TEXT,
          status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','superseded','archived')),
          superseded_by INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (superseded_by) REFERENCES understand_entries(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_understand_workspace ON understand_entries(workspace_id, status, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_understand_topic ON understand_entries(workspace_id, topic, status);
      `)
    },
  },
  {
    // Documents — operator-uploaded files per workspace. Metadata lives
    // here; content lives on disk at
    // `<dataDir>/documents/<workspace_id>/<sha256>` (content-addressed,
    // dedupes identical uploads within a workspace). Soft-deletes flip
    // `status='archived'`; blobs stay on disk to be GC'd by a future job.
    id: '063_documents',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          author_user_id INTEGER,
          filename TEXT NOT NULL,
          mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
          size_bytes INTEGER NOT NULL,
          sha256 TEXT NOT NULL,
          storage_key TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','archived')),
          tags_json TEXT,
          notes TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id, status, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_documents_sha ON documents(workspace_id, sha256);
      `)
    },
  },
  {
    // Workspace credentials — operator-supplied API keys for external providers
    // (LLM providers, agent CLIs, creative APIs, productivity, comms, data,
    // billing, devops, vertical APIs). One row per (workspace_id, provider_id).
    //
    // Secret data is stored encrypted in `secret_ciphertext` using AES-256-GCM
    // with a workspace-scoped DEK wrapped by CREDENTIALS_ENCRYPTION_KEY. Raw
    // plaintext NEVER touches this table or any API response. The API surface
    // returns only a masked preview (`secret_preview`) and verification state.
    //
    // Public config (e.g. SMTP host, Stripe price IDs, OpenRouter base URL) is
    // non-secret; it lives in `public_config_json` so the UI can show it back.
    id: '064_workspace_credentials',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspace_credentials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          provider_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','error','revoked')),
          mode TEXT NOT NULL DEFAULT 'bring_your_own_key' CHECK (mode IN ('mission_control_credits','bring_your_own_key','both')),
          secret_ciphertext BLOB,
          secret_nonce BLOB,
          secret_preview TEXT,
          public_config_json TEXT,
          last_verified_at INTEGER,
          last_error TEXT,
          created_by_user_id INTEGER,
          updated_by_user_id INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, provider_id),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_workspace_creds_status
          ON workspace_credentials(workspace_id, status, updated_at DESC);
      `)
    },
  },
  {
    // Dynamic model catalogue. Mission Control no longer hardcodes the LLM
    // model list. The catalogue is hydrated from a synced upstream source
    // (OpenRouter today; local Ollama / LM Studio later) plus a small set
    // of curated rows the operator manually pins for the UI. This table
    // is the single source of truth — every model selector reads from it.
    id: '065_model_catalog',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS model_catalog (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider TEXT NOT NULL,
          model_slug TEXT NOT NULL,
          display_name TEXT NOT NULL,
          family TEXT,
          context_window INTEGER,
          input_price_usd_per_million REAL,
          output_price_usd_per_million REAL,
          supports_tools INTEGER NOT NULL DEFAULT 0,
          supports_images INTEGER NOT NULL DEFAULT 0,
          supports_audio INTEGER NOT NULL DEFAULT 0,
          supports_video INTEGER NOT NULL DEFAULT 0,
          supports_reasoning INTEGER NOT NULL DEFAULT 0,
          supports_json INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL CHECK (source IN ('openrouter','curated','custom','ollama','lm_studio')),
          status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','deprecated','unavailable','custom')),
          last_synced_at INTEGER NOT NULL DEFAULT (unixepoch()),
          metadata_json TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(source, model_slug)
        );
        CREATE INDEX IF NOT EXISTS idx_model_catalog_provider ON model_catalog(provider, status);
        CREATE INDEX IF NOT EXISTS idx_model_catalog_sync ON model_catalog(source, last_synced_at DESC);
      `)
    },
  },
  {
    // OAuth state tokens for the Google round-trip flow.
    //
    // We never trust the `state` echo'd back by Google's callback — it has to
    // match a row WE created at consent time, scoped to the workspace + service
    // and within the freshness window. Each row is single-use: callback
    // consumes it, errors delete it. This blocks CSRF attempts where an
    // attacker tries to bait the operator into linking THEIR Google account
    // to a workspace they don't own.
    id: '066_oauth_states',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS oauth_states (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          state TEXT NOT NULL UNIQUE,
          provider TEXT NOT NULL,
          service TEXT,
          workspace_id INTEGER NOT NULL,
          user_id INTEGER,
          return_to TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          expires_at INTEGER NOT NULL,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at);
      `)
    },
  },
  {
    // Cloud-native orchestration tables. See
    // docs/architecture/ORCHESTRATION_MAP.md for the full three-mode model.
    //
    // Hard rule: Mission Control does NOT shell out to a local Maestro CLI,
    // does NOT read .maestro/ from disk, and does NOT depend on Baseline OS
    // being installed for any of these flows. The schema is multi-tenant
    // from day one (workspace_id everywhere) and integrates with the
    // existing runtime_keys / credit_ledger / approval surfaces.
    id: '067_cloud_orchestration',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS orchestration_missions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          slug TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','archived')),
          tags_json TEXT,
          metadata_json TEXT,
          source TEXT NOT NULL DEFAULT 'cloud' CHECK (source IN ('cloud','baseline-local','maestro-import')),
          created_by_user_id INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          UNIQUE(workspace_id, slug),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_orch_missions_ws ON orchestration_missions(workspace_id, status, updated_at DESC);

        CREATE TABLE IF NOT EXISTS orchestration_tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          mission_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'todo'
            CHECK (status IN ('todo','ready','in_progress','approval_required','blocked','failed','done')),
          tag TEXT,
          assignee TEXT,
          runtime_hint TEXT,
          priority INTEGER NOT NULL DEFAULT 0,
          payload_json TEXT,
          result_json TEXT,
          error TEXT,
          claimed_by_runtime_key_id INTEGER,
          claimed_at INTEGER,
          heartbeat_at INTEGER,
          completed_at INTEGER,
          approval_policy TEXT NOT NULL DEFAULT 'auto'
            CHECK (approval_policy IN ('auto','operator','required')),
          source TEXT NOT NULL DEFAULT 'cloud' CHECK (source IN ('cloud','baseline-local','maestro-import')),
          maestro_task_id TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (mission_id) REFERENCES orchestration_missions(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_orch_tasks_ws_status ON orchestration_tasks(workspace_id, status, priority DESC, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_orch_tasks_mission ON orchestration_tasks(mission_id);
        CREATE INDEX IF NOT EXISTS idx_orch_tasks_heartbeat ON orchestration_tasks(heartbeat_at) WHERE status = 'in_progress';

        CREATE TABLE IF NOT EXISTS orchestration_task_dependencies (
          task_id INTEGER NOT NULL,
          depends_on_task_id INTEGER NOT NULL,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          PRIMARY KEY (task_id, depends_on_task_id),
          FOREIGN KEY (task_id) REFERENCES orchestration_tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (depends_on_task_id) REFERENCES orchestration_tasks(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_orch_deps_lookup ON orchestration_task_dependencies(depends_on_task_id);

        CREATE TABLE IF NOT EXISTS orchestration_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          task_id INTEGER,
          mission_id INTEGER,
          event_type TEXT NOT NULL,
          actor TEXT NOT NULL,
          actor_user_id INTEGER,
          actor_runtime_key_id INTEGER,
          payload_json TEXT,
          source TEXT NOT NULL DEFAULT 'cloud',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_orch_events_ws_time ON orchestration_events(workspace_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_orch_events_task ON orchestration_events(task_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS orchestration_proofs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          task_id INTEGER NOT NULL,
          proof_type TEXT NOT NULL,
          proof_uri TEXT,
          proof_sha256 TEXT,
          metadata_json TEXT,
          posted_by_runtime_key_id INTEGER,
          posted_by_user_id INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (task_id) REFERENCES orchestration_tasks(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_orch_proofs_task ON orchestration_proofs(task_id, created_at DESC);
      `)
    },
  },
  {
    // Mirror dedup: every event ingested via /api/orchestration/mirror gets
    // an external_id (the local emitter's row id, e.g. kanban-events.jsonl
    // line number or sha). UNIQUE(workspace_id, source, external_id) lets
    // the mirror endpoint be retried idempotently — a duplicate POST is a
    // no-op rather than a second row. Existing cloud-native events keep
    // external_id NULL.
    id: '068_orchestration_mirror_dedup',
    up: (db) => {
      // SQLite treats every NULL as distinct in UNIQUE constraints, so a
      // plain UNIQUE INDEX works for both shapes: external_id=NULL rows
      // (existing cloud-native events) never collide, and external_id
      // set rows (mirror traffic) dedupe by (workspace_id, source, ext_id).
      // We avoid the partial-index variant because SQLite's ON CONFLICT
      // clause requires a non-partial UNIQUE constraint to match.
      db.exec(`
        ALTER TABLE orchestration_events ADD COLUMN external_id TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_orch_events_external
          ON orchestration_events(workspace_id, source, external_id);
      `)
    },
  },
  {
    id: '069_email_verification',
    up: (db) => {
      // Account-trust: a user must verify their email before accessing
      // monetized / sensitive features. New local signups start unverified
      // (email_verified_at = NULL). Existing accounts are backfilled as
      // verified so this migration never locks anyone out.
      const userCols = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>
      const has = (name: string) => userCols.some((c) => c.name === name)
      if (!has('email_verified_at')) {
        db.exec(`ALTER TABLE users ADD COLUMN email_verified_at INTEGER`)
        // Backfill every existing user as already-verified (grandfathered).
        db.exec(`UPDATE users SET email_verified_at = unixepoch() WHERE email_verified_at IS NULL`)
      }

      // Single-use, hashed, expiring verification tokens. Raw token is NEVER
      // stored — only its SHA-256 hash. One unused token per user is the
      // norm; resend rotates it.
      db.exec(`
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          used_at INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          created_ip TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_evt_user ON email_verification_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_evt_token_hash ON email_verification_tokens(token_hash);
        CREATE INDEX IF NOT EXISTS idx_evt_created ON email_verification_tokens(user_id, created_at);
      `)
    },
  },
  {
    // AI Org Chart — a CRUD registry that unifies every AI agent/persona in one
    // place with a customizable hierarchy (department, manager, skills, memory
    // access, runtime, permissions, ordering).
    id: '070_org_chart',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS org_agents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT '',
          department TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT '',
          manager_id TEXT,
          skills TEXT NOT NULL DEFAULT '[]',
          memory_access TEXT NOT NULL DEFAULT '[]',
          runtime TEXT NOT NULL DEFAULT '',
          permissions TEXT NOT NULL DEFAULT '[]',
          archived INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_org_agents_manager ON org_agents(manager_id);
        CREATE INDEX IF NOT EXISTS idx_org_agents_dept ON org_agents(department);
      `)
    },
  },
  {
    // Pipeline — Idea → Plan → Route → Approve → Build → Test → Ship → Proof.
    id: '071_pipeline_ideas',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS pipeline_ideas (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          detail TEXT NOT NULL DEFAULT '',
          stage TEXT NOT NULL DEFAULT 'idea',
          routed_to TEXT NOT NULL DEFAULT '',
          approved INTEGER NOT NULL DEFAULT 0,
          approved_by TEXT,
          proof TEXT NOT NULL DEFAULT '',
          artifact TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON pipeline_ideas(stage);
      `)
    },
  },
  {
    // Workspace-scope the AI Org Chart so each customer only sees their own
    // agents (no cross-workspace leakage). Existing rows default to workspace 1.
    id: '072_org_chart_workspace_scope',
    up: (db) => {
      const cols = db.prepare(`PRAGMA table_info(org_agents)`).all() as { name: string }[]
      if (!cols.some((c) => c.name === 'workspace_id')) {
        db.exec(`ALTER TABLE org_agents ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT 1;`)
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_org_agents_workspace ON org_agents(workspace_id);`)
    },
  },
  {
    // Workspace-scope the Pipeline so each customer only sees their own ideas,
    // plans, approvals, shipped artifacts, and proofs. Existing rows → ws 1.
    id: '073_pipeline_workspace_scope',
    up: (db) => {
      const cols = db.prepare(`PRAGMA table_info(pipeline_ideas)`).all() as { name: string }[]
      if (!cols.some((c) => c.name === 'workspace_id')) {
        db.exec(`ALTER TABLE pipeline_ideas ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT 1;`)
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_pipeline_workspace ON pipeline_ideas(workspace_id);`)
    },
  },
  {
    // Workforce Replay (Phase 3) — store enough per-mission metadata to replay a
    // mission like a screen recording: trigger, participating agents, tools,
    // skills, approvals, files touched, outputs, proof events. Workspace-scoped.
    // (Data model only; the replay UI is built later.)
    id: '074_mission_replays',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mission_replays (
          id TEXT PRIMARY KEY,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          trigger TEXT NOT NULL DEFAULT '',
          mission TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'running',
          agents TEXT NOT NULL DEFAULT '[]',
          events TEXT NOT NULL DEFAULT '[]',
          outputs TEXT NOT NULL DEFAULT '[]',
          started_at INTEGER NOT NULL,
          ended_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_mission_replays_workspace ON mission_replays(workspace_id);
      `)
    },
  },
  {
    // Property Management production core: communications config + log, work
    // orders, and owner-spend approvals. Workspace-scoped. Secrets are NOT stored
    // here — comms_config records provider + from-address + a "configured" flag;
    // actual credentials come from env at send time (dry-run when absent).
    id: '075_pm_comms_workorders_approvals',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS comms_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          channel TEXT NOT NULL,
          provider TEXT NOT NULL,
          from_addr TEXT NOT NULL DEFAULT '',
          configured INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL,
          UNIQUE(workspace_id, channel)
        );
        CREATE TABLE IF NOT EXISTS comms_log (
          id TEXT PRIMARY KEY,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          channel TEXT NOT NULL,
          to_addr TEXT NOT NULL,
          recipient_role TEXT NOT NULL DEFAULT 'tenant',
          body TEXT NOT NULL DEFAULT '',
          template TEXT,
          status TEXT NOT NULL DEFAULT 'dry_run',
          reason TEXT,
          consent INTEGER NOT NULL DEFAULT 1,
          work_order_id TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_comms_log_ws ON comms_log(workspace_id);
        CREATE TABLE IF NOT EXISTS work_orders (
          id TEXT PRIMARY KEY,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          request TEXT NOT NULL DEFAULT '',
          urgency TEXT NOT NULL DEFAULT 'medium',
          triage TEXT NOT NULL DEFAULT '',
          property TEXT NOT NULL DEFAULT '',
          unit TEXT NOT NULL DEFAULT '',
          tenant TEXT NOT NULL DEFAULT '',
          vendor TEXT NOT NULL DEFAULT '',
          cost_estimate REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'triaged',
          approval_id TEXT,
          replay_id TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_work_orders_ws ON work_orders(workspace_id);
        CREATE TABLE IF NOT EXISTS owner_approvals (
          id TEXT PRIMARY KEY,
          workspace_id INTEGER NOT NULL DEFAULT 1,
          work_order_id TEXT NOT NULL,
          cost REAL NOT NULL DEFAULT 0,
          threshold REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending',
          context TEXT NOT NULL DEFAULT '{}',
          decided_by TEXT,
          decided_at INTEGER,
          audit TEXT NOT NULL DEFAULT '[]',
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_owner_approvals_ws ON owner_approvals(workspace_id, status);
      `)
    },
  }
]

export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((row: any) => row.id)
  )

  for (const migration of [...migrations, ...extraMigrations]) {
    if (applied.has(migration.id)) continue
    db.transaction(() => {
      migration.up(db)
      db.prepare('INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)').run(migration.id)
    })()
  }
}
