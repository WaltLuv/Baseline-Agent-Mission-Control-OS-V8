# Claude OS — Changelog

Tracks shipped versions of the Hermes-tier Claude OS dashboard. Older
versions are kept as zipped artefacts locally for rollback.

---

## V2.3 — 31 May 2026

One headline feature this release: the **Documents Gallery**. Plus two
small dashboard fixes and a pricing-accuracy improvement. Everything
else from V2 is unchanged.

### New

- **Documents Gallery** — lives on the Hermes page, between the Skills
  section and the CLI Commands cheatsheet. A real, file-system-backed
  view of everything your Hermes agent (or you) drops into
  `~/Documents/Hermes/`. Reads files live, polls every 5 seconds, and
  renders each as a card with a hand-engraved Hermes-style placeholder
  per file type (sealed-scroll PDFs, loom-web HTML, codex for Markdown,
  abacus for Data, Dionysus mask for Video, lyre for Audio, treasure
  chest for Archive, Heron-of-Alexandria astrolabe for Code, etc.).
  Features:
  - Live type filtering with extension tooltips (".txt vs .md" never
    a mystery)
  - Live search across title, description, filename, type
  - Recency grouping (Today / Yesterday / This Week / Earlier) when
    you have more than six files
  - In-dashboard preview modal — click any card to render inline
    (HTML in iframe, markdown / JSON / text as styled `<pre>`, image /
    video / audio with native players)
  - Open-in-new-tab arrow if you prefer the full-browser view
  - **Soft delete to `.trash/`** with an 8-second Undo toast — the
    toast pauses on hover; the file stays in `~/Documents/Hermes/.trash/`
    forever so you can always recover from Finder
  - Trash modal (header chip appears when `.trash/` has items) for
    restore / permanently-delete-per-file / Empty trash
  - **"Install Prompt" modal** — one paste-able prompt + a full
    type-classification table you give to your Hermes agent so it
    saves all generated artefacts to `~/Documents/Hermes/` with proper
    metadata (HTML meta tags, Markdown YAML frontmatter, JSON `_hermes`
    block, first-line conventions for text + code). Includes explicit
    Save-here vs Don't-save-here rules so Hermes doesn't dump build
    artefacts or GitHub-repo project files into your gallery.
  - 10 engraved file-type placeholder cards in the existing Hermes
    Pantheon art style.

### Fixed

- **DreamCarousel clipping on long prescriptions** — long prescription
  bodies pushed the bottom nav (next arrow + "apply & mark done") below
  the fixed-height card, making later prescriptions unreachable. Changed
  `md:h-[440px]` → `md:min-h-[440px]` in `src/routes/index.tsx` so cards
  grow when content needs the room. Bottom controls are always reachable
  now.
- **Hardcoded "7am daily" copy** — the dream-status copy claimed a fixed
  7am run time, but the cron schedule is configurable. Replaced with
  "runs on your configured cron schedule" so it's accurate regardless of
  when you scheduled it.
- **Pricing accuracy via OAuth** — aggregator now reads the official
  `/api/oauth/usage` endpoint when your Claude Code OAuth session has
  one cached, so per-token costs match Anthropic's billing exactly.
  Falls back to the previous estimator if OAuth isn't available.
- **Daily activity counts** — uses real per-day session counts from
  the aggregator instead of synthesised noise + base when no data is
  available. Honest zeros beat lies.
- **Hermes sessions endpoint** — listing was capped at 20 and excluded
  Telegram threads; raised to 200 and merged in the `sessions.json`
  index so the chat sidebar surfaces everything.
- **Anthropic OAuth path** — reads from macOS Keychain via
  `find-generic-password -s "Claude Code-credentials" -a $USER` and
  sets the right `User-Agent` + `anthropic-beta: oauth-2025-04-20`
  headers.

### Security

- **Symlink-escape guard** on every gallery endpoint
  (`/__hermes_documents/file`, DELETE, restore, trash DELETE). Without
  it, an operator-planted symlink in `~/Documents/Hermes/` could leak
  arbitrary files (e.g. `~/.ssh/id_rsa`) or get those files moved to
  `.trash/` on delete. Every entry point now `realpathSync`'s the
  joined path and refuses anything that escapes the documents folder.
  Listing also skips symlinks entirely via `lstatSync`.

### Performance + safety

- **Streaming `/file` endpoint** — switched from `readFileSync` + buffer
  to `createReadStream().pipe(res)` so multi-GB videos / PDFs don't
  pull the entire file into memory before the first byte ships.
- **Directory enumeration cap** (1000 entries) with a `truncated` flag
  in the response. Operator with a runaway folder gets a clean
  truncation instead of a hung dev server.
- **`parseDocMeta` cache** — keyed on (path, mtimeMs, size). The 5-second
  poll no longer re-reads + re-parses the first 4KB of every file
  every tick; cache hits when nothing's changed. Bounded at 5000
  entries with oldest-eviction.
- **Body scroll lock stacking counter** — three modals (preview,
  install-prompt, trash) used to each snapshot/restore
  `document.body.style.overflow` independently. Closing them
  out-of-order could leave the page permanently scroll-locked. Now
  managed by a module-level reference counter; first mount locks,
  last unmount restores.
- **Undo toast interval leak** — the countdown's `setInterval` used to
  be recreated ~10×/s because the parent's `onDismiss` was a fresh
  closure every render. Fixed by wrapping the handlers in `useCallback`
  on the parent and using ref-backed `paused` / `onDismiss` inside the
  toast so the interval mounts once for the lifetime.

### Removed

- 70MB of unused PNG source files from `src/assets/hermes-art/file-types/`
  — only the webp versions were imported by the gallery; PNGs were
  dead weight in the ship. Regenerate via
  `scripts/gen-hermes-file-type-art.ts` if you ever want them back.

---

## V2 — 24 May 2026

Initial Hermes-tier release. Personal & Commercial Use License with
Attribution. Mission Labyrinth art swap. Personas skill. Auto-discovery
of `*_API_KEY` / `*_TOKEN` from `~/.hermes/.env` as connection
candidates.
