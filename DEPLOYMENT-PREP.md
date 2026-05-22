# Production Deployment Preparation — Phase 4

## 1. Required Environment Variables

### Authentication (required)
```
AUTH_USER=<username>          # Admin username
AUTH_PASS=<password>           # Admin password (quote if contains #)
AUTH_SECRET=<32-char-hex>      # JWT session secret (auto-generated on first run)
API_KEY=<64-char-hex>          # API key for CLI/MCP access (auto-generated on first run)
```

### Server Configuration
```
PORT=3000                      # Server port (default: 3000)
MISSION_CONTROL_DATA_DIR=.data # Database directory (default: .data/)
MC_ALLOW_ANY_HOST=1            # Allow any host header (dev mode)
```

### Gateway (optional)
```
NEXT_PUBLIC_GATEWAY_OPTIONAL=true  # Run without OpenClaw gateway
```

### Production Hardening (recommended)
```
NODE_ENV=production                # Enable Next.js production mode
MC_ENABLE_HSTS=1                   # Enforce HTTPS via HSTS
MC_CORS_ORIGIN=https://your.domain # Restrict CORS to production domain
```

---

## 2. Deploy Options (Built-in)

The project ships with `install.sh` supporting two modes:

### Docker (recommended for production)
```bash
bash install.sh --docker
# or
docker compose up
# production hardened:
docker compose -f docker-compose.yml -f docker-compose.hardened.yml up -d
```

### Standalone (Node.js)
```bash
bash install.sh --local
# or
pnpm build
node .next/standalone/server.js
```

### Quick Tunnel (for demos)
```bash
pnpm mc tunnel
```

---

## 3. Health Check Endpoint

**URL:** `GET /api/health` (already implemented via `/api/debug?action=health`)
**Alternative:** `GET /api/status` returns server status

```bash
curl http://localhost:3000/api/status
# Expected: { "status": "ok", "mode": "local"|"connected", ... }
```

**Docker health check** (built into docker-compose):
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/status"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

---

## 4. Smoke Test Checklist

### Server Startup
- [ ] Server starts without errors (`pnpm dev` or `pnpm start`)
- [ ] Database initialized (`.data/mission-control.db` exists, 51+ tables)
- [ ] Auth working (login page loads, credentials accepted)
- [ ] Health endpoint returns 200 (`/api/status`)

### Agent Operations
- [ ] Can list agents (`pnpm mc agents list`)
- [ ] Can create agent (`pnpm mc agents create --name TestAgent --role assistant`)
- [ ] Agent appears in UI with correct status

### Task Operations
- [ ] Can list tasks (`pnpm mc tasks list`)
- [ ] Can create task (`pnpm mc tasks create --title "Test" --agent TestAgent`)
- [ ] Task appears in Kanban board

### Core Panels Load
- [ ] Dashboard shows data (no empty state)
- [ ] Agents panel shows seeded agents
- [ ] Tasks panel shows seeded tasks
- [ ] Activity feed shows events
- [ ] Cost tracker shows token data
- [ ] Skills panel loads (installed + registry tabs)
- [ ] Memory browser loads
- [ ] Security audit loads
- [ ] Settings panel accessible
- [ ] Debug panel hidden in production mode

### Security
- [ ] Auth required for all API routes
- [ ] API keys masked in UI (first 4 + last 4 visible)
- [ ] Super Admin panel rejects non-admin users
- [ ] No stack traces in API error responses
- [ ] CORS restricted to configured origin (production)

### CLI/MCP
- [ ] `pnpm mc agents list --json` returns data
- [ ] `pnpm mc tasks list --json` returns data  
- [ ] `pnpm mc skills list` works
- [ ] `pnpm mc workflows list` works

---

## 5. Rollback Plan

### Code Rollback
```bash
cd /opt/data/profiles/saul-revenue/baseline-united-mission-control
git log --oneline -10        # Find last good commit
git reset --hard <commit>    # Reset to that commit
git push --force             # Push the reset
```

### Database Rollback
```bash
# Before any migration, backup:
cp .data/mission-control.db .data/mission-control.db.bak

# Restore if needed:
cp .data/mission-control.db.bak .data/mission-control.db
```

### Docker Rollback
```bash
docker compose down
docker compose up -d  # Uses latest image from build
# Or pin to specific image tag:
docker compose pull <tag>
docker compose up -d
```

---

## 6. Monitoring Plan

### What to Monitor
| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Server uptime | `/api/status` | Down > 2 min |
| DB file health | File size + WAL | Growing > 500MB without checkpoint |
| API response time | Request logs | P99 > 2s |
| Error rate | Log Viewer panel | > 10 errors/min |
| Token cost | `/api/tokens` stats | $50+/day baseline |
| Agent connectivity | Agent last_seen | Any agent offline > 30 min |
| Gateway health | `/api/gateways/control` | Disconnected |

### Automated Checks (can be added as cron jobs)
```bash
# Server health ping every 5 min
curl -sf http://localhost:3000/api/status || alert("MC_DOWN")

# DB size check every hour
SIZE=$(stat -c%s .data/mission-control.db)
[ $SIZE -gt 524288000 ] && alert("MC_DB_GROWING")

# Error log sweep every 15 min
curl -sf http://localhost:3000/api/logs?action=recent\&level=error\&limit=10 | jq '.logs | length'
[ $(result) -gt 10 ] && alert("MC_ERROR_SPIKE")
```

---

## 7. PostgreSQL Migration Plan (Future)

Currently uses SQLite (better-sqlite3). For multi-tenant production:

1. **Schema-compatible migration** — Most tables use standard SQL, no SQLite-specific features except `lastInsertRowid`
2. **Driver change** — Replace `better-sqlite3` with `pg` or `drizzle-orm`
3. **Connection pooling** — Add PgBouncer for connection management
4. **Migration steps:**
   - Add `DATABASE_URL=postgresql://...` env var
   - Create DB migration layer using `Drizzle Kit` or `node-pg-migrate`
   - Run `pgloader` to transfer SQLite data to PostgreSQL
   - Switch Next.js api routes to use pg-compatible queries
   - Add tenant-scoped queries (`WHERE workspace_id = ?`) for all routes

---

## Acceptance

Mission Control V2 is now production-grade:
- ✅ All 32 panels have real data, empty states, and customer narratives
- ✅ Debug panel hidden in production
- ✅ Super Admin protected by role check  
- ✅ API keys masked via `maskApiKey()` utility
- ✅ No stack traces exposed in API responses
- ✅ Gateway Config has guided form UI
- ✅ Log Viewer has customer + developer modes
- ✅ Token Dashboard has narrative summary + zero-fix
- ✅ Docker and standalone deployment options documented
- ✅ Smoke test checklist, rollback plan, monitoring plan ready
- ✅ TypeScript clean (`pnpm typecheck` passes)
