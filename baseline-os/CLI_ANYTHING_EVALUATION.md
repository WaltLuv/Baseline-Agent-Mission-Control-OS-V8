# CLI Anything — Baseline OS Evaluation

> Per the Baseline OS Builder Directive: **evaluate, do not integrate massively.**

---

## 1. What it is

**CLI Anything** (HKUDS, `https://hkuds.github.io/CLI-Anything/`) is an agent-friendly registry and package manager for **command-line tools generated from existing software**. The project goal: turn any GUI app into a command surface an AI agent can call, log, and approve.

Two parts:

- **A registry of CLI wrappers** — community-contributed CLIs for things like Notion, Audacity, Obsidian, Blender, n8n, GIPHY, etc. Discoverable + installable via `npx skills add HKUDS/CLI-Anything --skill <name>`.
- **A meta-skill** — when installed inside an agent (OpenClaw, Claude Code, Codex, Antigravity, others that follow the skill protocol), it exposes a discovery surface: "what CLI tools exist for this task?" → install on demand → run.

This is the right shape conceptually. It treats the universe of business software as a **callable namespace** instead of a sea of browser DOM.

---

## 2. What it does (in mechanical terms)

| Action | Mechanism |
|---|---|
| **Discovery** | A skill listing (`SKILL_INDEX.json`) enumerates every wrapper. Agents query it by capability. |
| **Install** | `npx skills add HKUDS/CLI-Anything --skill <name> -g -y` drops the wrapper into the agent's skill directory. |
| **Invocation** | Wrappers are normal CLIs (`notion-cli`, `obsidian-cli`, …) — same `stdin` / `stdout` / exit-code contract. |
| **Outputs** | Most wrappers emit structured JSON when called with `--json`. |
| **Updates** | Pulled like any npm package; the registry is the index. |

There is **no embedded runtime, no daemon, no orchestrator** — it is purely a tool-discovery + tool-install layer. That's the property that makes it a good fit for Baseline OS: small surface area, no overlap with what we already own.

---

## 3. How it fits Baseline OS

CLI Anything **belongs in Pillar 6: Tool Registry**, not at the orchestration layer.

```
Operator
   ↓
Mission Control          (supervision, approval, billing, audit)
   ↓
Baseline OS              (routing, policy, decision)
   ↓
MCP Agent Gateway        (shared tool bus)
   ↓
┌──────────────┬─────────┬─────────────┐
│ Hermes       │ Claude  │ OpenClaw    │
│              │  Code   │ /OpenCode   │
└──────────────┴─────────┴─────────────┘
   ↓
Tool Registry            ← CLI Anything lives here
   · CLI tools (preferred)
   · API SDKs (fallback)
   · MCP tools
   · Browser tools (last resort)
   ↓
External business software (PropControl, AppFolio, Notion, …)
```

**The Tool Registry's job is to answer one question per task:**

> *"What is the cheapest, most reliable invocation that achieves this verb?"*

The answer is always preferred in this order:

1. **CLI** (deterministic, scriptable, JSON-out)
2. **API** (when no CLI exists, but stable contract)
3. **MCP tool** (when the vendor ships one)
4. **Browser** (DOM walking, only when nothing else exists)

CLI Anything is how the Tool Registry **grows entries 1 and (sometimes) 2 quickly** without us writing every wrapper from scratch.

### What Baseline OS uses CLI Anything for

| Baseline OS need | CLI Anything role |
|---|---|
| Discover whether a CLI exists for verb X | Index lookup in `SKILL_INDEX.json` |
| Install missing CLI on demand | `npx skills add` |
| Maintain catalog of installed tools | Mirror into Baseline OS Tool Registry |
| Run the tool | Direct shell call — *not* through CLI Anything itself |
| Capture exit code + stdout/stderr | Standard shell semantics |

### What Baseline OS does **NOT** delegate to CLI Anything

- **Approval gating** — that is Mission Control's job.
- **Memory / context** — Mission Control + Knowledge + Memory + SOUL own this.
- **Routing decisions** — Baseline OS Workforce Router decides which runtime gets the task, not CLI Anything.
- **Audit logging** — every CLI call is logged through Mission Control's command ledger; CLI Anything provides no audit guarantees on its own.

This separation is non-negotiable. CLI Anything is a **catalog plus installer**, not an orchestrator.

---

## 4. How it fits MCP (Agent Gateway)

The MCP Agent Gateway is the shared tool bus across runtimes. CLI Anything's CLI wrappers are **complementary, not competitive**:

- **MCP tools** are best when a vendor publishes one — they carry typed schemas, OAuth, and live streaming.
- **CLI wrappers** are best when there is no MCP and we control the install — they are deterministic, scriptable, and survive vendor UI changes.

Recommended bridge: a thin **MCP-CLI shim**. Any CLI in the Tool Registry can be exposed as an MCP tool with one schema declaration, so any runtime that speaks MCP (Hermes, Claude, Codex) can call it without knowing whether the underlying mechanism is a CLI binary or an HTTP MCP server. The shim's contract:

```
input  : MCP tool call (typed JSON)
output : { stdout, stderr, exit_code, duration_ms }
log    : Mission Control command-ledger entry
```

This is the integration point. It is **one file** — not a fork of CLI Anything, not a vendored copy. We treat CLI Anything as an external dependency for tool discovery and tool install only.

---

## 5. How it fits Mission Control

Mission Control already owns:

- MCP tools registry
- Runtime registry + heartbeats
- Task queue
- Memory / Knowledge / Skills
- Billing
- Audit logs
- Gateway

CLI Anything feeds **two** of those streams:

1. **Tools** — every installed CLI becomes a row in Mission Control's tool registry with provenance (`source: CLI-Anything`, `version: x.y.z`, `installed_at: …`).
2. **Audit / Command Ledger** — every `exec` of a CLI Anything wrapper is captured as:

```json
{
  "ts": "2026-06-01T12:34:56Z",
  "operator": "walt",
  "workspace": "ws_…",
  "runtime": "openclaw",
  "tool": "notion-cli",
  "argv": ["create-page", "--database", "Sales", "--title", "New Lead"],
  "stdout_sha256": "…",
  "exit_code": 0,
  "duration_ms": 412,
  "approval": "auto",
  "cost_usd": 0.000
}
```

This is exactly what the directive calls **"agent ran this command, with these inputs, at this time, for this workspace, returned this result, logged this proof."** CLI Anything makes that ledger viable for the long tail of business software where no MCP / API exists.

---

## 6. Security risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Untrusted code in wrappers** — `npx skills add` runs community-authored JS / Python on the operator's machine. | **High** | Default policy: **no auto-install**. Every install requires Mission Control approval, even in `auto` mode. The Tool Registry pins specific versions (no `latest`). Wrappers run inside the runtime's sandbox (Hermes / OpenClaw / Claude Code each have their own isolation primitives — use them). |
| **Credential exfiltration** — a malicious wrapper for `notion-cli` could read tokens from `~/.config`. | **High** | Wrappers run with a scoped env file (per-workspace), not the operator's full env. Mission Control's secret broker injects only the credentials the tool declares it needs. |
| **Supply-chain drift** — a published wrapper updates from v1.0 → v1.1 with new behavior. | **Medium** | Lockfile per workspace. Updates require approval. Diff the wrapper's source against the previously approved revision before re-running. |
| **Arbitrary shell injection via prompt** — agent constructs `argv` from untrusted text. | **High** | Every CLI invocation goes through the MCP-CLI shim, which serializes typed arguments. **No shell string interpolation anywhere.** Use `spawn(cmd, argv[])` exclusively. |
| **Approval bypass** — a wrapper internally hits an unsafe endpoint (e.g. `delete-all-pages`) the operator did not approve. | **High** | Approval Engine policy is attached to **the verb** (e.g. `notion.delete_page`), not the tool. Mission Control inspects the declared output of each wrapper at install time and tags destructive verbs. |
| **Network egress without observability** | Medium | Wrappers run in network-namespaced shells where possible; egress goes through Baseline OS's proxy so Mission Control sees every external hostname. |

The honest one-line summary: **CLI Anything is a code-execution vector by design.** That is exactly what makes it powerful and exactly why every install / invocation must pass through Mission Control's approval and audit surfaces. If we ever expose a CLI Anything install path that does not log to the command ledger, we have built the wrong thing.

---

## 7. Recommended uses

### Immediate (this quarter)

1. **Catalog the existing community wrappers** that map to Baseline workspaces today:
   - `notion-cli`, `gmail-cli`, `slack-cli`, `airtable-cli`, `trello-cli`, `asana-cli`, `monday-cli`, `hubspot-cli`, `stripe-cli`, `quickbooks-cli`
   - Property management: `appfolio-cli`, `buildium-cli`, `servicetitan-cli`, `jobber-cli`, `housecallpro-cli` (build wrappers ourselves where the community has not — those are the ones with real economic value to us)
2. **Build the MCP-CLI shim** (one file, one schema, one ledger entry per call). This is the entire integration surface — anything more is scope creep.
3. **Publish 3 first-party CLIs** so our own systems are agent-native:
   - `mission-control-cli` (already in the directive's required surface)
   - `propcontrol-cli`
   - `visionops-cli` / `voiceops-cli`

### Near-term

4. Write a "wrapper conformance test" — every wrapper Baseline accepts must pass: `--json` flag, structured errors, deterministic exit codes, no interactive prompts. Anything that fails the test stays out of the registry.
5. Approval policy templates per industry workforce (Property Management, GC, Mortgage, …) so the Approval Engine ships with sensible defaults for each verb the wrappers expose.

### Out of scope (per directive)

- ❌ **Forking CLI Anything.** We track upstream, we don't own it.
- ❌ **Replacing it with a custom registry.** We already have a registry — it's called Mission Control. CLI Anything feeds it; it does not duplicate it.
- ❌ **Embedding the meta-skill inside every runtime.** Hermes, Claude Code, Codex, OpenClaw — each of them can discover tools via Baseline OS's Tool Registry endpoint. We do not need a separate discovery path inside every runtime.
- ❌ **Building any agent orchestration on top of it.** It is not an orchestrator.

---

## 8. Verdict

CLI Anything is the **catalog + installer for Tool Registry Pillar 6**. It is the right shape, it does not overlap with what Baseline OS owns, and it solves a real problem: the long tail of business software has no MCP and no stable API, but it does have CLI surfaces we can wrap.

**Adopt it as a dependency. Do not fork. Do not orchestrate from it.** Wire it into Mission Control's command ledger through a single MCP-CLI shim. Approve every install, lockfile every wrapper, sandbox every execution. That is the entire integration.

If a future quarter shows CLI Anything's registry diverging from our needs (e.g. they pivot to a proprietary licensing model, or upstream goes unmaintained), the dependency surface is small enough — `npx skills add` + a JSON index lookup — that we can replace it without touching the Tool Registry or Mission Control. That replaceability is exactly the right test for what "good integration" means here.
