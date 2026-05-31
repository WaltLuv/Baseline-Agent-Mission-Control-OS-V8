"""Subprocess wrappers for the four CLI agents this gateway can drive.

Each worker exposes a single `run()` coroutine:

    await worker.run(prompt: str, workdir: str, task_id: str) -> WorkerResult

The worker is responsible for:
  - assembling the agent's CLI args
  - streaming stdout/stderr to per-task log files
  - applying TASK_MAX_RUNTIME_SECS
  - returning a WorkerResult dataclass

Workers do NOT touch the task store directly — the gateway is the single
writer for that. Workers are pure(ish) and easily unit-testable by swapping
asyncio.create_subprocess_exec in tests.
"""
from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

from .config import Config


@dataclass
class WorkerResult:
    agent: str
    exit_code: int
    status: str  # 'succeeded' | 'failed' | 'timeout'
    stdout_path: str
    stderr_path: str
    duration_ms: int
    cost_usd: float | None = None
    extra: dict[str, Any] = field(default_factory=dict)


async def _run_subprocess(
    *,
    cmd: list[str],
    cwd: str,
    env: dict[str, str],
    timeout_secs: int,
    stdout_path: Path,
    stderr_path: Path,
) -> tuple[int, str]:
    """Spawn a subprocess, stream both pipes to files, enforce timeout.

    Returns (exit_code, status) where status ∈ {'succeeded','failed','timeout'}.
    """
    started = time.time()
    stdout_path.parent.mkdir(parents=True, exist_ok=True)
    with stdout_path.open("wb") as out_f, stderr_path.open("wb") as err_f:
        proc = await asyncio.create_subprocess_exec(
            *cmd, cwd=cwd, env=env, stdout=out_f, stderr=err_f
        )
        try:
            await asyncio.wait_for(proc.wait(), timeout=timeout_secs)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            return proc.returncode or 124, "timeout"
        del started  # not needed past this point
        rc = proc.returncode or 0
        return rc, "succeeded" if rc == 0 else "failed"


class ClaudeWorker:
    name = "claude"

    def __init__(self, cfg: Config):
        self.cfg = cfg

    async def run(self, *, prompt: str, workdir: str, task_id: str) -> WorkerResult:
        cmd = [
            "claude", "-p", prompt,
            "--max-turns", str(self.cfg.claude_max_turns),
        ]
        if self.cfg.claude_allowed_tools:
            cmd.extend(["--allowedTools", ",".join(self.cfg.claude_allowed_tools)])
        return await self._run(cmd, workdir, task_id)

    async def _run(self, cmd: list[str], workdir: str, task_id: str) -> WorkerResult:
        stdout = self.cfg.logs_dir() / f"{task_id}.stdout"
        stderr = self.cfg.logs_dir() / f"{task_id}.stderr"
        t0 = time.time()
        rc, status = await _run_subprocess(
            cmd=cmd, cwd=workdir, env=self.cfg.worker_env(),
            timeout_secs=self.cfg.task_max_runtime_secs,
            stdout_path=stdout, stderr_path=stderr,
        )
        return WorkerResult(
            agent=self.name, exit_code=rc, status=status,
            stdout_path=str(stdout), stderr_path=str(stderr),
            duration_ms=int((time.time() - t0) * 1000),
        )


class CodexWorker:
    name = "codex"

    def __init__(self, cfg: Config):
        self.cfg = cfg

    async def run(self, *, prompt: str, workdir: str, task_id: str) -> WorkerResult:
        cmd = ["codex", "exec"]
        if self.cfg.codex_full_auto:
            cmd.append("--full-auto")
        if self.cfg.codex_model:
            cmd.extend(["--model", self.cfg.codex_model])
        cmd.append(prompt)
        stdout = self.cfg.logs_dir() / f"{task_id}.stdout"
        stderr = self.cfg.logs_dir() / f"{task_id}.stderr"
        t0 = time.time()
        rc, status = await _run_subprocess(
            cmd=cmd, cwd=workdir, env=self.cfg.worker_env(),
            timeout_secs=self.cfg.task_max_runtime_secs,
            stdout_path=stdout, stderr_path=stderr,
        )
        return WorkerResult(
            agent=self.name, exit_code=rc, status=status,
            stdout_path=str(stdout), stderr_path=str(stderr),
            duration_ms=int((time.time() - t0) * 1000),
        )


class OpenCodeWorker:
    name = "opencode"

    def __init__(self, cfg: Config):
        self.cfg = cfg

    async def run(self, *, prompt: str, workdir: str, task_id: str) -> WorkerResult:
        cmd = ["opencode", "run", prompt]
        if self.cfg.opencode_model:
            cmd.extend(["--model", self.cfg.opencode_model])
        stdout = self.cfg.logs_dir() / f"{task_id}.stdout"
        stderr = self.cfg.logs_dir() / f"{task_id}.stderr"
        t0 = time.time()
        rc, status = await _run_subprocess(
            cmd=cmd, cwd=workdir, env=self.cfg.worker_env(),
            timeout_secs=self.cfg.task_max_runtime_secs,
            stdout_path=stdout, stderr_path=stderr,
        )
        return WorkerResult(
            agent=self.name, exit_code=rc, status=status,
            stdout_path=str(stdout), stderr_path=str(stderr),
            duration_ms=int((time.time() - t0) * 1000),
        )


class HermesWorker:
    """Hermes is a long-running service, not a CLI we spawn — we POST a task
    to its delegate endpoint and write the response to the logs."""
    name = "hermes"

    def __init__(self, cfg: Config):
        self.cfg = cfg

    async def run(self, *, prompt: str, workdir: str, task_id: str) -> WorkerResult:
        stdout = self.cfg.logs_dir() / f"{task_id}.stdout"
        stderr = self.cfg.logs_dir() / f"{task_id}.stderr"
        t0 = time.time()
        if not self.cfg.hermes_url:
            stderr.write_text("Hermes URL not configured (set HERMES_URL).\n")
            return WorkerResult(
                agent=self.name, exit_code=2, status="failed",
                stdout_path=str(stdout), stderr_path=str(stderr),
                duration_ms=int((time.time() - t0) * 1000),
            )
        headers = {"content-type": "application/json"}
        if self.cfg.hermes_api_key:
            headers["authorization"] = f"Bearer {self.cfg.hermes_api_key}"
        body = {"task": prompt, "workdir": workdir, "task_id": task_id}
        try:
            async with httpx.AsyncClient(timeout=self.cfg.task_max_runtime_secs) as client:
                r = await client.post(
                    f"{self.cfg.hermes_url}/api/delegate", json=body, headers=headers,
                )
                stdout.write_text(r.text)
                if r.status_code >= 400:
                    return WorkerResult(
                        agent=self.name, exit_code=r.status_code, status="failed",
                        stdout_path=str(stdout), stderr_path=str(stderr),
                        duration_ms=int((time.time() - t0) * 1000),
                    )
        except httpx.TimeoutException:
            stderr.write_text("Hermes call timed out.\n")
            return WorkerResult(
                agent=self.name, exit_code=124, status="timeout",
                stdout_path=str(stdout), stderr_path=str(stderr),
                duration_ms=int((time.time() - t0) * 1000),
            )
        except Exception as e:
            stderr.write_text(f"Hermes call raised: {e}\n")
            return WorkerResult(
                agent=self.name, exit_code=1, status="failed",
                stdout_path=str(stdout), stderr_path=str(stderr),
                duration_ms=int((time.time() - t0) * 1000),
            )
        return WorkerResult(
            agent=self.name, exit_code=0, status="succeeded",
            stdout_path=str(stdout), stderr_path=str(stderr),
            duration_ms=int((time.time() - t0) * 1000),
        )


def build_workers(cfg: Config) -> dict[str, ClaudeWorker | CodexWorker | OpenCodeWorker | HermesWorker]:
    table = {
        "claude":   ClaudeWorker,
        "codex":    CodexWorker,
        "opencode": OpenCodeWorker,
        "hermes":   HermesWorker,
    }
    return {name: cls(cfg) for name, cls in table.items() if name in cfg.enabled_agents}
