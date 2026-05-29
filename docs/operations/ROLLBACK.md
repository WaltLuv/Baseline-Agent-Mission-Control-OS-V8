# Rollback Runbook — Mission Control v3

> Rollback is a first-class capability, not an emergency procedure.

---

## Automatic rollback (already wired)

The `.github/workflows/deploy-digitalocean.yml` job runs a post-deploy
health check loop against `/api/status?action=health`. If it doesn't see
`200` within ~150 seconds it triggers an automatic rollback step.

DO App Platform itself does **rolling** deploys: a new revision is only
promoted after its health check passes. If the new revision never
becomes healthy, the previous revision keeps serving traffic.

In practice: a broken build never reaches users.

---

## Manual rollback — image tag

```bash
APP_ID="<DO app id>"

# List recent deployments
doctl apps list-deployments "$APP_ID"

# Re-deploy the previous-good image tag (replace sha-XXXX)
doctl apps update "$APP_ID" --spec .do/app.yaml --wait \
  --image-tag sha-XXXXXXX
```

Each image is tagged `sha-<commit>`, `latest`, and (for tagged releases)
`v<major>.<minor>.<patch>`. Roll forward or backward by tag.

---

## Manual rollback — git revert

```bash
git revert <bad-commit-sha>
git push origin main
# Quality Gate → Docker Publish → Deploy auto-runs on the revert commit
```

Use this for code-level regressions caught after a deploy is live.

---

## Database rollback

Code rollback does **not** undo database migrations. If a migration
introduced data corruption:

1. Stop traffic (DO: scale to 0).
2. Restore the most recent good snapshot (see `BACKUP_RESTORE.md`).
3. Revert the code on `main`.
4. Re-deploy.

Migrations under `src/lib/migrations/` are forward-only. Plan additive
schema changes so a stale code version can still read newer rows.

---

## Demo share secret rotation

If `SHARE_SIGNING_SECRET` leaks, all outstanding demo links must die.

1. Generate a new secret: `openssl rand -hex 32`.
2. Update the DO env, save.
3. The platform redeploys; every existing token instantly fails
   verification and falls to the `/demo/expired` page.
4. Salespeople re-mint links from `/app/share`.

Token format is self-contained (HMAC), so no DB cleanup is required.

---

## Communication

When you roll back, post inside the team channel within 5 minutes:

```
[ROLLBACK] mission-control prod rolled to sha-XXXXXXX
Reason: <one sentence>
Detail: <link to logs / health screenshot>
```

That's it. No ceremony — just the truth.
