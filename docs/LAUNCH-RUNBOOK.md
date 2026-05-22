# Production Launch Runbook — Mission Control V2

**Version:** 5.0 (Production Hardened)
**Date:** 2026-05-22
**Commit:** `e769a7a`

---

## 1. Pre-Launch Checklist (1 hour before)

### Environment Validation
- [ ] `.env.production` exists with real values (no CHANGE_ME)
- [ ] `AUTH_SECRET` is set (32-char hex) — never auto-generated in production
- [ ] `API_KEY` is set (64-char hex) — never auto-generated in production
- [ ] SSL certificate configured (Caddy auto-provisions via Let's Encrypt)
- [ ] Domain DNS points to server IP
- [ ] Firewall rules: only ports 80, 443, and SSH allowed
- [ ] Server has at least 2GB RAM, 10GB disk

### Database
- [ ] SQLite DB WAL checkpointed: `PRAGMA wal_checkpoint(TRUNCATE);`
- [ ] Backup taken: `cp .data/mission-control.db .data/mission-control.pre-launch.db`
- [ ] DB file size < 100MB (larger = needs compaction)

### Code
- [ ] Latest commit pushed: `git pull`
- [ ] Dependencies installed: `pnpm install`
- [ ] Build succeeds: `pnpm build`
- [ ] Typecheck passes: `pnpm typecheck`

### Security
- [ ] Debug panel hidden (production mode confirmed)
- [ ] CORS origin set (`MC_CORS_ORIGIN`)
- [ ] HSTS enabled (`MC_ENABLE_HSTS=1`)
- [ ] `debugger` statements removed from code: `grep -r 'debugger' src/` returns 0

---

## 2. Launch Procedure

### Step 1: Stop any running dev server
```bash
bash scripts/production-start.sh stop
```

### Step 2: Backup
```bash
bash scripts/production-start.sh backup
```

### Step 3: Deploy
```bash
NODE_ENV=production bash scripts/production-start.sh start
# or Docker:
# docker compose -f docker-compose.production.yml --env-file .env.production up -d
```

### Step 4: Verify health
```bash
bash scripts/production-start.sh health
# Expected: ✓ Healthy

# Manual verification:
curl -s https://your-domain.com/api/status | jq .
```

### Step 5: Login test
- [ ] Navigate to `https://your-domain.com`
- [ ] Login with admin credentials
- [ ] Dashboard loads with widgets
- [ ] Agents panel shows seeded agents
- [ ] Tasks panel shows active tasks

### Step 6: Integration verification
- [ ] CLI works: `pnpm mc agents list` returns agents
- [ ] Webhooks panel loads without errors
- [ ] GitHub sync shows connection status (Not Connected / Connected)
- [ ] Activity feed populates with live events

---

## 3. Smoke Test Suite (Post-Launch)

### 30-Second Smoke Test
```bash
#!/bin/bash
# Run from server
BASE_URL="https://your-domain.com"
CREDS="admin:yourpassword"

echo "Testing health..."
curl -sf "${BASE_URL}/api/status" && echo "✓ Pass" || echo "✗ Fail"

echo "Testing auth..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -u "$CREDS" "${BASE_URL}/api/agents")
[ "$HTTP_CODE" = "200" ] && echo "✓ Pass" || echo "✗ Fail (HTTP $HTTP_CODE)"

echo "Testing unauth rejection..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/agents")
[ "$HTTP_CODE" = "401" ] && echo "✓ Pass" || echo "✗ Fail (HTTP $HTTP_CODE)"

echo "Testing HTTPS..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://your-domain.com/api/status")
[ "$HTTP_CODE" = "401" ] && echo "✓ Pass (HTTPS enforced)" || echo "✗ Fail (HTTP $HTTP_CODE)"

echo "Testing HTTP→HTTPS redirect..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L "http://your-domain.com/api/status")
[ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ] && echo "✓ Pass" || echo "✗ Fail"
```

### 5-Minute Deep Smoke
- [ ] Create a test agent → verify it appears in Agents panel
- [ ] Create a test task → verify it appears in Kanban board
- [ ] Assign task → verify activity feed shows assignment event
- [ ] Complete task → verify status changes to "done"
- [ ] Check cost tracker → verify token usage recorded
- [ ] Check token dashboard → verify narrative summary shows spend

---

## 4. Monitoring Dashboard (Setup)

### What to monitor in Mission Control itself:
| Metric | How to check | Alert if |
|--------|-------------|----------|
| Server uptime | `scripts/production-start.sh status` | Not RUNNING |
| API health | `scripts/production-start.sh health` | Response > 2s or non-200 |
| DB size | `stat -c%s .data/mission-control.db` | > 500MB |
| Error rate | Log Viewer panel, Customer View | > 10 errors in 15 min |
| Active agents | Agents panel status column | > 50% offline |
| Token cost spike | Cost Tracker per-agent view | > 2× baseline |

### External monitoring hooks:
```bash
# Every 5 min — ping Mission Control
*/5 * * * * curl -sf https://your-domain.com/api/status || webhook_alert("MC_DOWN")

# Every hour — DB size check
0 * * * * SIZE=$(stat -c%s /path/to/.data/mission-control.db); [ $SIZE -gt 524288000 ] && webhook_alert("MC_DB_GROWING")
```

---

## 5. Incident Response Checklist

### Scenario: Server Down
```
1. Check: ssh server → curl localhost:3000/api/status
2. If local works: check reverse proxy (Caddy)
3. If local fails: check logs → tail -100 logs/production.log
4. If out of memory: kill process → restart → check memory leak
5. If DB corrupt: restore from backup → restart
6. Notify stakeholders with ETA
```

### Scenario: High Error Rate
```
1. Open Log Viewer panel → Customer View
2. Identify error type (most common first)
3. Check if error correlates with a specific API route
4. If route-specific: disable that endpoint temporarily via middleware
5. If systemic: rollback to last known good commit
6. File incident report
```

### Scenario: Data Leakage (Multi-Tenant)
```
1. Audit affected workspace using multitenant-audit.md
2. Check access logs for cross-workspace queries
3. Apply workspace_id filter immediately to affected routes
4. Notify affected customer
5. Run full workspace isolation scan
```

### Scenario: Cost Spike
```
1. Open Cost Tracker → identify spike source (model? agent? task?)
2. Check if caused by runaway task (agent looping)
3. Kill runaway task: find via `pnpm mc tasks list` → update status
4. Set model budget caps in settings
5. Add cost alert threshold
```

---

## 6. Rollback Procedure

### If deployment causes issues:
```bash
# Stop current version
bash scripts/production-start.sh stop

# Restore database backup
cp .data/mission-control.db.bak .data/mission-control.db

# Rollback code to last good commit
git reset --hard e769a7a  # or earlier known-good commit

# Restart
NODE_ENV=production bash scripts/production-start.sh start

# Verify
bash scripts/production-start.sh health
```

### If rollback fails:
```bash
# Full stop
bash scripts/production-start.sh stop

# Docker fallback (if Node environment is broken)
docker compose -f docker-compose.production.yml --env-file .env.production up -d
```

---

## 7. Post-Launch (Week 1)

### Day 1
- [ ] Verify all integrations are working
- [ ] Check error logs for patterns
- [ ] Confirm backup schedule is running
- [ ] Review token usage for anomalies

### Day 3
- [ ] Performance audit: compare pre/post launch load times
- [ ] Review agent connection stability
- [ ] Check multi-tenant isolation (if multiple workspaces active)

### Day 7
- [ ] Weekly summary of errors, uptime, and token costs
- [ ] Apply any critical security patches
- [ ] Review and adjust refresh intervals based on performance-audit.md

---

## Launch Sign-Off

| Role | Name | Verified | Date |
|------|------|----------|------|
| Founder/CEO | Walter Thornton | ☐ | |
| Lead Engineer | Hermes/Slim | ☐ | |

**Mission Control V2 is ready for production when all checkboxes above are complete.**
