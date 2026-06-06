# Token exposure forensic report

> **Authored:** 2026-06-06 (Walt's P0-1 directive)
> **Scope:** Telegram bot token + OpenRouter API key exposed during
> 2026-06-06 session.
> **Production-deploy block:** This report must be completed and both
> tokens rotated before any deploy. (Walt's standing rule.)
> **Reading rule:** No literal token bytes appear in this report. Each
> finding cites the prefix only — enough to confirm "same key" without
> publishing the secret.

---

## 0. Tokens under investigation

| Token | Identifier prefix (NOT the full value) | Type |
|---|---|---|
| **Token A — Telegram bot** | `8484225062:AAENvi53Phcc...` | Bot HTTP API token (BotFather-issued) |
| **Token B — OpenRouter** | `sk-or-v1-2366b45ee6b7...` | OpenRouter API key (v1 format) |

Both signatures (`8484225062:AAEN...` for A; `sk-or-v1-2366...` for B) are
used as match patterns below. **Neither full value is written anywhere in
this report.**

---

## 1. Token A — Telegram bot

### 1.1 Exact file locations (current working tree)

| Surface | File | Hits | Real token bytes? | Notes |
|---|---|---|---|---|
| Repo (mc-v8) | `src/lib/__tests__/claude-md-template.test.ts` | 1 | **No** — prefix only | Regression-guard test: `expect(src).not.toContain('8484225062')`. Asserts the template never carries the token. |
| Repo (claude-os) | — | 0 | — | Clean. |
| ~/.hermes | — | 0 | — | Scrubbed 2026-06-06 022400 (32MB pre-scrub backup at `~/.hermes-scrub-backup-20260606_022400/hermes-leaked-files.tar`). |
| ~/.claude memory | — | 0 | — | Walt's MEMORY.md sanitized in same scrub; references `$TELEGRAM_BOT_TOKEN` env var instead of literal. |
| ~/.claude sessions | `projects/-Users-walt/e2ba3684-e5dc-4689-b448-9fa800934a7a.jsonl` | 1 | **Yes** (with AAEN suffix) | This is the active Claude Code session transcript Walt is currently writing to. Walt typed the literal token in turn 0 of the session for the scrub directive. |
| ~/.claude tasks | `tasks/e2ba3684-…/99.json` | 1 | No — prefix only | Internal task-description field referencing the prefix as part of this investigation. |
| ~/.claude-os | — | 0 | — | Clean. |
| ~/.claude-os/dreams | — | 0 | — | Clean. |
| ~/.openclaw | — | 0 | — | Clean. |
| ~/.mempalace | — | 0 | — | Clean. |
| ~/Downloads | — | 0 | — | Clean. |

### 1.2 First appearance

- **Surface zero:** Walt's chat message on 2026-06-06 (this conversation),
  asking for the disk scrub. The literal token was written into the
  conversation by Walt and consequently:
  1. landed in the active Claude Code session JSONL transcript
     (`~/.claude/projects/-Users-walt/e2ba3684-…jsonl`), which Claude
     Code appends to as the conversation proceeds; and
  2. was previously present in ~/.hermes config / sessions / logs prior
     to the scrub.

- **Pre-existing disk presence (pre-scrub baseline):** 48 files across
  `~/.hermes`, `~/.claude`, and `~/.claude-os`. Now consolidated to the
  single active session JSONL.

### 1.3 Current presence

- **Active session JSONL** is the only place the literal token bytes
  remain on disk. The JSONL is append-only and re-written continuously by
  Claude Code while this session is open; editing it mid-session would
  corrupt Claude Code's state.
- **No git commit, anywhere, contains the literal token.** The single
  history hit in mc-v8 (`git log --all -S "8484225062"` → commit
  `ac6af0e`) is the regression-guard assertion only. The AAEN suffix has
  **0** matches in git history across both repos.

### 1.4 Repository presence

- mc-v8: **prefix-only** in 1 test file (regression guard). No real
  bytes. Git history clean.
- claude-os: clean. Git history clean.

### 1.5 Backup presence

- `~/.hermes-scrub-backup-20260606_022400/hermes-leaked-files.tar`
  (32 MB) — sealed tarball of every file scrubbed on 2026-06-06.
  **Contains the literal bytes** of the pre-scrub copies.

### 1.6 Memory presence

- `~/.claude/projects/-Users-walt/memory/MEMORY.md` and child memory
  files: **clean.** All references to the token are now `$TELEGRAM_BOT_TOKEN`
  env-var notation per Walt's "Never in MEMORY.md, Credentials Manager only"
  rule (post-2026-06-06).

### 1.7 Session presence

- `e2ba3684-…jsonl`: **1 hit**, real bytes (the only live disk copy).
- All other ~1091 session JSONLs in `~/.claude/projects/`: clean.

### 1.8 Dream presence

- `~/.claude-os/dreams/*.json`: **clean** (7 dream files, no hits).

### 1.9 Log presence

- `~/.hermes/interrupt_debug.log`, `~/.hermes/.hermes_history`,
  `~/.hermes/.env*`: **clean** post-scrub.

### 1.10 Export presence

- `~/Downloads`: **clean** (0 hits across all subdirectories).

### 1.11 Remediation status

| Action | Status |
|---|---|
| Scrub live config / sessions / logs in `~/.hermes` | ✅ Done (2026-06-06 022400) |
| Sanitize MEMORY.md to reference env var | ✅ Done |
| Pre-scrub backup tarball created | ✅ Done (32 MB) |
| Rotate Telegram bot token via BotFather | ⏳ Walt action — pending |
| Delete pre-scrub backup tarball after rotation | ⏳ Pending Walt's rotate (keep tarball as forensic evidence until then) |
| Live session JSONL (`e2ba3684-…`) | Cannot scrub while session is open. Will be addressed when session closes; the bytes are also functionally invalidated the moment Walt rotates. |

### 1.12 Rotation required

**Yes.** The literal bytes live in:
- the active session JSONL (cannot be scrubbed mid-session),
- the pre-scrub backup tarball.

Both become inert the instant Walt rotates via BotFather. Until rotation,
the token remains valid and any party with read access to the above
locations could exfiltrate it.

---

## 2. Token B — OpenRouter API key

### 2.1 Exact file locations (current working tree)

All hits below match `sk-or-v1-2366b45ee6b7…` — confirmed single key,
multiple locations. "Real" means the full 40+-hex-char-suffix shape, not
a test-fixture stub like `sk-or-test-xxx`.

| Surface | File | Hits | Real key? | Notes |
|---|---|---|---|---|
| **Repo (mc-v8)** | — | 0 | — | Clean. |
| **Repo (claude-os)** | `src/data/live-data.json` | 1 | **Yes** | Gitignored runtime aggregate. Aggregator (`scripts/aggregate.ts`) reads `~/.hermes/.env` and writes the key into this file. |
| ~/.hermes config | `~/.hermes/.env` | 1 | **Yes** | Hermes's primary env file. |
| ~/.hermes config (backup) | `~/.hermes/.env.bak.20260530_035718` | 1 | **Yes** | Older Hermes env backup. |
| ~/.hermes config (profile) | `~/.hermes/profiles/don/.env` | 1 | **Yes** | "Don" persona's env. |
| ~/.hermes log | `~/.hermes/interrupt_debug.log` | 2 | **Yes** | Debug log echoed the key. |
| ~/.hermes shell hist | `~/.hermes/.hermes_history` | 2 | **Yes** | History of CLI commands that ran with the key inline. |
| ~/.hermes sessions | `sessions/session_20260524_011916_0178f8.json` | 7 | **Yes** | May 24 session — multiple references. |
| ~/.hermes sessions | `sessions/session_20260524_013311_3509a1.json` | 2 | **Yes** | May 24. |
| ~/.hermes sessions | `sessions/session_20260524_013720_6c7955.json` | 2 | **Yes** | May 24. |
| ~/.hermes sessions | `sessions/session_20260529_…`, `…20260530_…` (8 files) | 1 each | **Masked** (`sk-or-***…`) | Hermes started redacting in late-May. These hold only the prefix, not the full bytes. |
| ~/.hermes test files | `hermes-agent/tests/**/*.py` (10 files) | 2-15 | **No — fixtures** (`sk-or-test-…`, `sk-or-fake`, `sk-or-primary`, etc.) | Not leaks. Listed for completeness. |
| ~/.claude settings | `~/.claude/settings.local.json` | 1 | **Yes** | Walt may have pasted it into a settings field. |
| ~/.claude paste-cache | `~/.claude/paste-cache/1f8843687156e29c.txt` | 5 | **Yes** | Clipboard-paste cache. |
| ~/.claude paste-cache | `~/.claude/paste-cache/eac8442433f1c978.txt` | 5 | **Yes** | Clipboard-paste cache. |
| ~/.claude file-history | `~/.claude/file-history/236efe3e-…/*` | many | **Mixed** | Revision snapshots of files Claude Code edited that once held the key (now scrubbed in current). |
| **~/.claude sessions** | 4 JSONLs in `~/.claude/projects/-Users-walt/`: `236efe3e-…`, `8b263811-…`, `8c06366e-…`, `e2ba3684-…` | 20, 5, 4, 2 (31 total) | **Yes** | Session transcripts where Walt's pastes or my reads echoed the key. |
| **~/.claude-os/dreams** | `dream-2026-05-31.json`, `…06-01.json`, `…06-02.json`, `…06-03.json`, `…06-06.json` | 1 each (5 total) | **Yes** | Dream skill snapshots embedded the env / config state. |
| ~/Downloads | — | 0 | — | Clean. |
| ~/.openclaw | — | 0 | — | Clean. |
| ~/.mempalace | — | 0 | — | Clean. |

### 2.2 First appearance

- Original location: `~/.hermes/.env` (Hermes config). Hermes-CLI runs
  injected the key into log and history files; persona configs were
  duplicated from the primary env; aggregator copied it into
  `claude-os/src/data/live-data.json`; Dream skill snapshotted it from
  the env at run-time; Claude Code paste-cache and session transcripts
  captured it when Walt pasted env contents into chat.

### 2.3 Current presence

**Still on disk** (real bytes):
- `claude-os/src/data/live-data.json` — gitignored, regeneratable from `aggregate.ts`
- `~/.hermes/.env` + `.env.bak.20260530_035718` + `profiles/don/.env`
- `~/.hermes/interrupt_debug.log`
- `~/.hermes/.hermes_history`
- 3 May-24 session JSONs in `~/.hermes/sessions/`
- `~/.claude/settings.local.json`
- 2 paste-cache `.txt` files
- ~/.claude file-history revision snapshots
- 4 Claude Code session JSONLs
- 5 dream JSONs

Total: **20+ files** with real bytes still on disk.

### 2.4 Repository presence

- mc-v8: **clean** in working tree and git history.
- claude-os: **clean in git history.** Present in `src/data/live-data.json`
  which is `.gitignored` (confirmed: `git check-ignore -v
  src/data/live-data.json` returns the ignore rule). Not committed.

### 2.5 Backup presence

- `~/.hermes/.env.bak.20260530_035718` is a Hermes-side env backup.
- `~/.hermes-scrub-backup-20260606_022400/hermes-leaked-files.tar` — the
  2026-06-06 022400 scrub backup. May or may not include this key; needs
  inspection before deletion.

### 2.6 Memory presence

- `~/.claude/projects/-Users-walt/memory/MEMORY.md` and children: **clean.**
- `~/.mempalace`: clean.

### 2.7 Session presence

- **~/.hermes sessions:** 3 May-24 session JSONs with real bytes (7+2+2),
  plus 8 May-29/30 session JSONs with masked (`sk-or-***…`) entries.
- **~/.claude session JSONLs:** 4 transcripts with real bytes (31 total
  hits).

### 2.8 Dream presence

- 5 dream JSONs at `~/.claude-os/dreams/` (May 31 – Jun 6) carry the key.
  Dream skill embeds env/config state into the snapshot when it runs.

### 2.9 Log presence

- `~/.hermes/interrupt_debug.log` (2 hits)
- `~/.hermes/.hermes_history` (2 hits)

### 2.10 Export presence

- `~/Downloads`: clean.

### 2.11 Remediation status

| Action | Status |
|---|---|
| Identify all files holding real bytes | ✅ Done (this report) |
| Scrub `~/.hermes/.env` + backups + logs + history | ❌ **Not done.** No scrub run on the OpenRouter key — only the Telegram scrub was performed on 2026-06-06 022400. |
| Scrub `~/.hermes/profiles/don/.env` | ❌ Not done. |
| Scrub `~/.hermes/sessions/session_20260524_*.json` (3 files) | ❌ Not done. |
| Scrub `~/.claude/settings.local.json` | ❌ Not done. Inspect what context it's in first. |
| Scrub `~/.claude/paste-cache/*.txt` | ❌ Not done. (Safe to delete entirely — paste-cache is regeneratable.) |
| Sanitize `~/.claude-os/dreams/*.json` (5 files) | ❌ Not done. |
| Regenerate `claude-os/src/data/live-data.json` after rotation | ❌ Not done. Will pick up the new key automatically once `~/.hermes/.env` carries it. |
| Rotate OpenRouter key via OpenRouter dashboard | ⏳ Walt action — pending |
| Delete or seal the Hermes-side env backup | ⏳ Pending rotation |

### 2.12 Rotation required

**Yes.** The key is present in plain text in 20+ files including session
transcripts and dream snapshots. Disk-scrubbing alone is insufficient
because:
- Multiple session JSONLs hold copies (some are append-only).
- Dream snapshots are immutable historical records by design.
- The Hermes-side `.hermes_history` is a shell-history file that can
  re-grow as Hermes is used.

Rotation invalidates the bytes; remediation cleans up the disk
remnants. **Rotation is the only durable fix.**

---

## 3. Cross-reference: shared remediation

### 3.1 Pre-scrub backup tarball

`~/.hermes-scrub-backup-20260606_022400/hermes-leaked-files.tar` (32 MB)
was created on 2026-06-06 022400 when the Telegram scrub ran. It
contains pre-scrub copies of every `~/.hermes` file scrubbed for the
Telegram token. **It may also contain the OpenRouter key** (those files
were not specifically scanned for the OpenRouter key before the scrub).

**Rule:** Do not delete this tarball until BOTH tokens have been
rotated. Until then it's forensic evidence; after rotation it's just
two invalidated strings, safe to delete.

### 3.2 Production deploy gate

Walt's standing rule: production deploy is blocked until both tokens
are rotated. The status:

| Token | Disk leak status | Walt rotation status | Deploy gate |
|---|---|---|---|
| Telegram | Disk-scrubbed except for active session JSONL + sealed backup | ⏳ Pending | **Blocked** |
| OpenRouter | Disk-leak in 20+ files; no scrub run yet | ⏳ Pending | **Blocked** |

---

## 4. Remediation checklist

### 4.1 Walt actions (you)

- [ ] **Rotate Telegram bot token via BotFather** — `/revoke` then
  `/token` for the bot, save the new token into the Credentials Manager
  (never paste into chat).
- [ ] **Rotate OpenRouter API key** via the OpenRouter dashboard. Save
  the new key into the Credentials Manager (never paste into chat).
- [ ] After both rotations confirmed: tell Claude `tokens rotated` to
  unblock the remediation-2 scrub run + deploy.

### 4.2 Claude actions (waiting on Walt's "tokens rotated" signal)

- [ ] **Telegram remediation** — already complete except: delete
  `~/.hermes-scrub-backup-20260606_022400/hermes-leaked-files.tar` after
  rotation confirmed.
- [ ] **OpenRouter remediation** (not yet run; scope below):
  - Scrub `~/.hermes/.env`, `~/.hermes/.env.bak.20260530_035718`,
    `~/.hermes/profiles/don/.env` (replace value with `<rotated>`).
  - Scrub `~/.hermes/interrupt_debug.log` (truncate or sanitize).
  - Scrub `~/.hermes/.hermes_history` (rewrite, drop offending lines).
  - Scrub `~/.hermes/sessions/session_20260524_{011916,013311,013720}_*.json`
    (replace key in each JSON value with `<rotated>`).
  - Delete `~/.claude/paste-cache/1f8843687156e29c.txt` and
    `~/.claude/paste-cache/eac8442433f1c978.txt` (paste-cache is
    safe to delete entirely).
  - Sanitize `~/.claude/settings.local.json` (inspect context first,
    likely a single-string value to replace).
  - Sanitize 5 `~/.claude-os/dreams/*.json` files (May 31 – Jun 6).
  - Delete `claude-os/src/data/live-data.json` (regeneratable via
    `bun run scripts/aggregate.ts` once Hermes env carries the new key).
  - Add `.hermes_history` and `interrupt_debug.log` to a recurring
    sanitize hook so they don't re-grow with the leaked value.

### 4.3 Files that CANNOT be safely scrubbed

| File | Reason |
|---|---|
| `~/.claude/projects/-Users-walt/*.jsonl` (4 session transcripts) | Active session is being appended to right now (`e2ba3684-…`); the other 3 are historical Claude Code transcripts. Scrubbing them mid-session corrupts Claude Code's state. The bytes become inert after rotation. |
| `~/.claude/file-history/236efe3e-…/*` | Claude Code's per-file revision snapshots. These are Claude Code-internal state; scrubbing risks breaking Claude Code's diff/recovery features. The bytes become inert after rotation. |
| Pre-scrub backup tarball | Forensic evidence; delete only after both rotations confirmed. |

### 4.4 Going forward (prevention)

- **Credentials Manager only** (Walt's standing rule). All provider
  keys land there; nothing in `.env` files committed to disk outside the
  encrypted store.
- Hermes env files should reference `$OPENROUTER_API_KEY` rather than
  containing the literal value. Investigate whether Hermes can pull its
  env from the Credentials Manager at runtime (it's a Phase B follow-up).
- Disable Hermes `.hermes_history` if it's not actively used (it
  echoed the key twice already).
- Add a pre-commit hook to mc-v8 and claude-os that rejects any file
  matching `sk-or-v1-[a-f0-9]{30,}` or `8484225062:AAEN`.

---

## 5. Methodology (for verifiability)

This report is produced by:

1. `grep -rl 8484225062` and `grep -rl AAENvi53Phcc` across all named
   surfaces (Telegram).
2. `grep -rlE 'sk-or-(v1-)?[a-f0-9]'` then per-file classification:
   "real" = `sk-or-v1-[a-f0-9]{30,}` shape; "fixture" = any other
   `sk-or-*` shape.
3. `git log --all -p -S '<signature>'` for git history (both repos).
4. Manual inspection of high-signal hits (Dream JSONs, settings.local.json,
   paste-cache) to confirm same-prefix grouping.

**No literal token bytes** were written to this report or to any other
new file during this investigation.

---

*Report owner: Claude (Mission Control / System Pilot). Awaiting Walt's
rotation signal to proceed with the OpenRouter-side scrub.*
