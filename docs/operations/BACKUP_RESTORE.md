# Backup & Restore — Mission Control v3 SQLite

> Mission Control stores everything in a single SQLite database at
> `/app/.data/mission-control.db` (WAL mode). Backups are dead-simple but
> must be done correctly to avoid copying a half-written WAL.

---

## Backup (online, no downtime)

Use the SQLite `.backup` command — it serializes a consistent snapshot
while the app keeps running.

```bash
APP_ID="<your-DO-app-id>"
TS=$(date -u +%Y%m%dT%H%M%SZ)

doctl apps exec "$APP_ID" --component web -- \
  sh -c "sqlite3 /app/.data/mission-control.db '.backup /tmp/mc-${TS}.db'"

# Pull the snapshot out of the container
doctl apps download-logs "$APP_ID" --type=DEPLOY \
  --tail 0 > /dev/null  # warm up
doctl apps exec "$APP_ID" --component web -- \
  cat "/tmp/mc-${TS}.db" > "backups/mc-${TS}.db"

# Optionally upload to DO Spaces / S3
aws s3 cp "backups/mc-${TS}.db" "s3://<bucket>/mc-backups/"
```

Verify the snapshot before relying on it:

```bash
sqlite3 "backups/mc-${TS}.db" "PRAGMA integrity_check;"
# Expected: ok
```

Recommended cadence:

| Cadence | Why |
|---------|-----|
| Hourly  | Production workforce with active billing |
| Daily   | Standard launch posture |
| Weekly  | Light demo deployments |

Retention: 7 daily + 4 weekly + 6 monthly.

---

## Restore

1. Stop the app (or scale to 0):

   ```bash
   doctl apps update "$APP_ID" --spec .do/app.yaml --wait
   # or: edit instance_count to 0 in app.yaml temporarily
   ```

2. Push the snapshot back into the volume. DigitalOcean App Platform
   doesn't expose direct volume mounts, so we run a one-shot job:

   ```bash
   doctl apps exec "$APP_ID" --component web -- \
     sh -c "mv /app/.data/mission-control.db /app/.data/mission-control.db.bak"

   cat backups/mc-<timestamp>.db | doctl apps exec "$APP_ID" --component web -- \
     sh -c "cat > /app/.data/mission-control.db"

   doctl apps exec "$APP_ID" --component web -- \
     sh -c "sqlite3 /app/.data/mission-control.db 'PRAGMA integrity_check;'"
   ```

3. Scale back to 1 and watch `/api/status?action=health`.

---

## Test restores quarterly

A backup you've never restored is a wish, not a backup. Spin up a
staging app, restore a recent snapshot, log in, and verify:

- [ ] Operator can log in with the original credentials
- [ ] Active workflows still appear in Mission Control
- [ ] Token / credit balances match what you expect
- [ ] No SQLite integrity warnings

Document the test result in your launch runbook.
