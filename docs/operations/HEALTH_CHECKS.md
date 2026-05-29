# Health Checks — Mission Control v3

> Mission Control exposes a single canonical health endpoint. Everything
> else is monitoring around it.

---

## The endpoint

```
GET /api/status?action=health
```

Public, unauthenticated, no rate limit. Returns JSON with:

| Field | Type | Meaning |
|-------|------|---------|
| `status` | `healthy` \| `unhealthy` | Aggregate verdict |
| `version` | string | Image version (matches `MC_VERSION`) |
| `uptime` | number | Seconds since process start |
| `checks[]` | array | Per-subsystem status |
| `timestamp` | number | Unix ms |

Each `checks[]` entry:

| Field | Meaning |
|-------|---------|
| `name` | "Database" / "Process Memory" / "Gateway" / "Disk Space" / "Memory Usage" |
| `status` | `healthy` \| `warning` \| `critical` \| `unhealthy` |
| `message` | Short, human-readable detail |
| `detail` | Optional structured detail |

**HTTP code is always 200** — read `status` from the body. This lets
proxies cache the shape of the response without breaking on warning
states.

---

## What the deploy gate uses

`.github/workflows/deploy-digitalocean.yml` polls this endpoint for up to
~150 seconds after a deploy and requires HTTP 200 with `status: healthy`
before declaring the deploy good.

A non-`healthy` body triggers the rollback step.

---

## Monitoring integration

Wire whatever monitor you use against the same endpoint:

| Tool | Sensible probe |
|------|----------------|
| UptimeRobot | HTTP keyword: `"status":"healthy"` every 5 minutes |
| Pingdom | Same, with paging |
| DO Monitoring | Alerts already wired via `.do/app.yaml` `alerts:` |
| Self-hosted | `curl -fsS https://<host>/api/status?action=health \| jq -e '.status=="healthy"'` |

Don't probe more often than every 30 seconds; the endpoint walks SQLite
on every call.

---

## Subsystem details

### Database
Runs `SELECT 1` against SQLite. Latency printed in `message`. Should be
sub-millisecond. Anything over 50 ms is worth investigating.

### Process Memory
Reports RSS and heap. **Critical above 1 GB RSS**. The hardened
Dockerfile caps the container at 512 MB. Investigate process leaks
before re-deploying if you see sustained criticals.

### Gateway
Reports `healthy` when `OPENCLAW_GATEWAY_HOST:OPENCLAW_GATEWAY_PORT`
answers within 2 s. `unhealthy` is **expected** in deployments where
no gateway is configured — Mission Control runs fine without it.

### Disk Space
Threshold: 80 % critical, 60 % warn.

### Memory Usage
System-wide memory headroom (not container-specific).

---

## Common failure patterns

| Symptom | Likely cause | First check |
|---------|-------------|-------------|
| `Database` critical | SQLite WAL file lock | `doctl apps exec ... ls -la /app/.data` |
| `status: unhealthy` but every check healthy | A check flipped right after the snapshot | Re-probe; if stable, ignore |
| Health 200 but UI hangs | Frontend bundle stale | Hard refresh; check `MC_VERSION` matches deploy |

---

## Operator etiquette

Health drift is normal under load. Don't roll back on a single
warning — wait one polling cycle. The deploy workflow does this
automatically.
