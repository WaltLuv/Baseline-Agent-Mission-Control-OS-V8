"""FastMCP gateway. Exposes 9 tools over streamable HTTP at /mcp.

This is the orchestration layer — it routes incoming tool calls to the right
worker, manages task lifecycle in storage, and emits telemetry to Mission
Control. Workers are dumb subprocess wrappers; the gateway is where policy
(routing, isolation, timeouts, MC reporting) lives.
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from fastmcp import FastMCP

from .config import Config
from .http_api import register_http_routes
from .routing import pick_agent
from .storage import TaskStore
from .telemetry import MissionControlTelemetry
from .workers import WorkerResult, build_workers
from .worktree import cleanup_worktree, create_worktree

log = logging.getLogger("agent_gateway.gateway")


def build_app(cfg: Config) -> FastMCP:
    cfg.ensure_dirs()
    store = TaskStore(cfg.db_path())
    workers = build_workers(cfg)
    telemetry = MissionControlTelemetry(cfg)
    mcp = FastMCP("baseline-agent-gateway")
    register_http_routes(mcp, cfg, store)

    # ──────────────────────────────────────────────────────────────────
    # Internal helper — common run path for every CLI worker.
    # ──────────────────────────────────────────────────────────────────
    async def _execute(*, agent_name: str, prompt: str, workdir: str | None, model: str | None,
                       extra: dict[str, Any] | None = None) -> dict[str, Any]:
        if agent_name not in workers:
            return {
                "task_id": None,
                "status": "failed",
                "error": f"Agent {agent_name!r} is not enabled in this gateway",
                "enabled_agents": cfg.enabled_agents,
            }

        # Reserve a task row first so we have an ID for the worktree dir name.
        task_id = store.create(
            agent=agent_name, prompt=prompt, workdir=workdir, worktree=None,
            workspace_id=cfg.mc_workspace_id, model=model, metadata=extra,
        )

        # Optional git worktree isolation
        worktree_path: Path | None = None
        if cfg.worktree_base_repo:
            try:
                worktree_path = await create_worktree(
                    cfg.worktree_base_repo,
                    cfg.worktrees_dir() / task_id,
                )
                workdir = str(worktree_path)
            except Exception as e:
                log.warning("worktree creation failed (running without isolation): %s", e)

        store.mark_started(task_id)
        await telemetry.report_task(task_id, "started", {"agent": agent_name})

        try:
            result: WorkerResult = await workers[agent_name].run(
                prompt=prompt, workdir=workdir or ".", task_id=task_id,
            )
        finally:
            if worktree_path is not None:
                await cleanup_worktree(cfg.worktree_base_repo, worktree_path)

        store.mark_finished(task_id, status=result.status, exit_code=result.exit_code,
                            cost_usd=result.cost_usd)
        await telemetry.report_task(task_id, "finished", {
            "agent": agent_name, "status": result.status, "exit_code": result.exit_code,
            "duration_ms": result.duration_ms,
        })

        return {
            "task_id": task_id,
            "agent": agent_name,
            "status": result.status,
            "exit_code": result.exit_code,
            "duration_ms": result.duration_ms,
            "stdout_path": result.stdout_path,
            "stderr_path": result.stderr_path,
        }

    # ──────────────────────────────────────────────────────────────────
    # Tools — direct agent invocations
    # ──────────────────────────────────────────────────────────────────
    @mcp.tool
    async def claude_run_task(prompt: str, workdir: str = ".") -> dict[str, Any]:
        """Run Claude Code (`claude -p ...`) on a bounded coding task.

        Best for: complex refactors, architecture decisions, multi-file
        reasoning, code review. Returns task_id, status, and log paths.
        """
        return await _execute(agent_name="claude", prompt=prompt, workdir=workdir, model=None)

    @mcp.tool
    async def codex_run_task(prompt: str, workdir: str = ".", model: str | None = None) -> dict[str, Any]:
        """Run OpenAI Codex (`codex exec --full-auto ...`) on a bounded task.

        Best for: implementation, test-fixing, fast coding loops, PR work.
        """
        return await _execute(agent_name="codex", prompt=prompt, workdir=workdir,
                              model=model or cfg.codex_model)

    @mcp.tool
    async def opencode_run_task(prompt: str, workdir: str = ".", model: str | None = None) -> dict[str, Any]:
        """Run OpenCode / OpenClaw (`opencode run ...`) on a bounded task.

        Best for: cheaper autonomous execution, OpenRouter / local-model
        flexibility, browser/tool tasks.
        """
        return await _execute(agent_name="opencode", prompt=prompt, workdir=workdir,
                              model=model or cfg.opencode_model)

    @mcp.tool
    async def hermes_delegate_task(prompt: str, workdir: str = ".") -> dict[str, Any]:
        """Hand a task to a Hermes agent over HTTP (POST to HERMES_URL/api/delegate).

        Best for: orchestration, scheduling, memory-bound, long-running.
        """
        return await _execute(agent_name="hermes", prompt=prompt, workdir=workdir, model=None)

    # ──────────────────────────────────────────────────────────────────
    # Tools — routing & composite flows
    # ──────────────────────────────────────────────────────────────────
    @mcp.tool
    async def route_task(task: str, workdir: str = ".", preferred_agent: str = "auto") -> dict[str, Any]:
        """Pick the right agent for `task` and run it.

        preferred_agent ∈ {auto, claude, codex, opencode, hermes}. When auto,
        the gateway uses keyword heuristics defined in routing.py.
        """
        chosen = pick_agent(task, preferred_agent, cfg.enabled_agents)
        return await _execute(
            agent_name=chosen, prompt=task, workdir=workdir, model=None,
            extra={"routed_by": "auto" if preferred_agent in {"auto", "automatic"} else preferred_agent},
        )

    @mcp.tool
    async def agent_review_code(diff: str | None = None, target_dir: str = ".") -> dict[str, Any]:
        """Run a code-review pass with Claude Code. Pass a diff string or
        let Claude inspect the working tree at target_dir.
        """
        if diff:
            prompt = (
                "Review the following diff for correctness, performance, security, "
                "and code-style consistency. Be concise and specific. Diff:\n\n" + diff
            )
        else:
            prompt = (
                f"Review the working tree at {target_dir}. Focus on the most "
                "recent changes (git diff HEAD~1 if possible). Flag bugs, "
                "missing tests, and security risks. Be concise."
            )
        if "claude" not in workers:
            return {"task_id": None, "status": "failed",
                    "error": "Claude agent not enabled — agent_review_code requires it."}
        return await _execute(agent_name="claude", prompt=prompt, workdir=target_dir, model=None)

    @mcp.tool
    async def agent_build_feature(feature_spec: str, workdir: str = ".") -> dict[str, Any]:
        """Implement a feature end-to-end: pick Codex for the build, then
        Claude for a review pass. Returns both task_ids.
        """
        if "codex" not in workers:
            return {"status": "failed", "error": "codex not enabled — required for agent_build_feature."}
        build_result = await _execute(
            agent_name="codex",
            prompt=f"Implement the following feature. Include tests. Feature:\n\n{feature_spec}",
            workdir=workdir, model=None,
            extra={"composite": "agent_build_feature", "phase": "implement"},
        )
        # Skip review if the build failed
        if build_result["status"] != "succeeded" or "claude" not in workers:
            return {"build": build_result, "review": None}
        review_result = await _execute(
            agent_name="claude",
            prompt=f"Review the implementation just produced for: {feature_spec}",
            workdir=workdir, model=None,
            extra={"composite": "agent_build_feature", "phase": "review",
                   "build_task_id": build_result["task_id"]},
        )
        return {"build": build_result, "review": review_result}

    # ──────────────────────────────────────────────────────────────────
    # Tools — observability
    # ──────────────────────────────────────────────────────────────────
    @mcp.tool
    async def agent_status(task_id: str | None = None, limit: int = 20,
                           agent: str | None = None) -> dict[str, Any]:
        """If task_id is given, return that task's row. Otherwise return the
        most recent `limit` tasks (optionally filtered by agent).
        """
        if task_id:
            row = store.get(task_id)
            return {"task": row} if row else {"task": None, "error": f"No task {task_id}"}
        return {"recent": store.list_recent(limit=limit, agent=agent)}

    @mcp.tool
    async def agent_logs(task_id: str, stream: str = "stdout", tail_bytes: int = 4096) -> dict[str, Any]:
        """Return the last `tail_bytes` of a task's log. stream ∈ {stdout, stderr}."""
        if stream not in {"stdout", "stderr"}:
            return {"error": f"stream must be 'stdout' or 'stderr', got {stream!r}"}
        path = cfg.logs_dir() / f"{task_id}.{stream}"
        if not path.exists():
            return {"task_id": task_id, "stream": stream, "content": "", "exists": False}
        with path.open("rb") as f:
            try:
                f.seek(-tail_bytes, 2)
            except OSError:
                f.seek(0)
            content = f.read().decode(errors="replace")
        return {"task_id": task_id, "stream": stream, "content": content, "exists": True}

    # ──────────────────────────────────────────────────────────────────
    # Background tasks
    # ──────────────────────────────────────────────────────────────────
    async def _startup():
        await telemetry.register()
        asyncio.create_task(telemetry.heartbeat_loop())

    started = {"flag": False}

    async def _ensure_started():
        if not started["flag"]:
            await _startup()
            started["flag"] = True

    @mcp.tool
    async def _gateway_heartbeat() -> dict[str, Any]:
        """Internal: registers gateway with MC on first call. Safe to invoke
        from a watchdog. Not user-facing."""
        await _ensure_started()
        return {"registered": True, "name": cfg.gateway_name}

    # Auto-register on first HTTP hit (covers /health probes). Idempotent.
    @mcp.custom_route("/v1/bootstrap", methods=["POST"])
    async def bootstrap_route(request):  # type: ignore[no-untyped-def]
        from starlette.responses import JSONResponse as _JR
        await _ensure_started()
        return _JR({"registered": True, "name": cfg.gateway_name})

    # Best-effort: kick off telemetry register at module-eval time using a
    # fire-and-forget asyncio task scheduled after the loop comes up. The
    # FastMCP server boots its own loop in run(); we attach via a custom
    # startup hook on the underlying Starlette app.
    try:
        http_app = mcp.http_app(transport="http")

        async def _on_startup_hook():
            try:
                await _ensure_started()
            except Exception as e:
                log.warning("startup telemetry register failed (will retry on tool call): %s", e)

        # Starlette exposes the lifespan via app.router.lifespan_context;
        # the simplest portable hook is `on_event`.
        try:
            http_app.add_event_handler("startup", _on_startup_hook)  # type: ignore[attr-defined]
            log.info("startup hook attached for telemetry register")
        except Exception:
            pass
    except Exception:
        # http_app might not be available in every FastMCP version — fall back to
        # the existing first-tool-call path.
        pass

    return mcp
