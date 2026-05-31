"""Env-driven configuration. No defaults that could surprise — everything that
matters is explicit. Reads from process env; .env loading is the operator's
responsibility (systemd EnvironmentFile, docker --env-file, etc.).
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _csv(name: str, default: str = "") -> list[str]:
    raw = os.environ.get(name, default)
    return [s.strip() for s in raw.split(",") if s.strip()]


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name, "").strip().lower()
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    return default


@dataclass(frozen=True)
class Config:
    # Mission Control telemetry
    mc_url: str = field(default_factory=lambda: os.environ.get("MC_URL", "").rstrip("/"))
    mc_api_key: str = field(default_factory=lambda: os.environ.get("MC_API_KEY", ""))
    mc_workspace_id: int = field(default_factory=lambda: _int("GATEWAY_WORKSPACE_ID", 1))
    mc_report_interval_secs: int = field(default_factory=lambda: _int("MC_REPORT_INTERVAL_SECS", 15))

    # Local data layout
    data_dir: Path = field(default_factory=lambda: Path(os.environ.get("GATEWAY_DATA_DIR", "/var/lib/agent-gateway")))

    # Agent toggles
    enabled_agents: list[str] = field(default_factory=lambda: _csv("ENABLED_AGENTS", "claude,codex,opencode,hermes"))

    # Per-agent controls
    claude_allowed_tools: list[str] = field(default_factory=lambda: _csv("CLAUDE_ALLOWED_TOOLS", "Read,Write,Edit,Bash"))
    claude_max_turns: int = field(default_factory=lambda: _int("CLAUDE_MAX_TURNS", 12))
    codex_full_auto: bool = field(default_factory=lambda: _bool("CODEX_FULL_AUTO", True))
    codex_model: str = field(default_factory=lambda: os.environ.get("CODEX_MODEL", ""))
    opencode_model: str = field(default_factory=lambda: os.environ.get("OPENCODE_MODEL", ""))

    # Hard caps
    task_max_runtime_secs: int = field(default_factory=lambda: _int("TASK_MAX_RUNTIME_SECS", 1800))

    # Worktree
    worktree_base_repo: str = field(default_factory=lambda: os.environ.get("WORKTREE_BASE_REPO", ""))

    # Hermes
    hermes_url: str = field(default_factory=lambda: os.environ.get("HERMES_URL", "").rstrip("/"))
    hermes_api_key: str = field(default_factory=lambda: os.environ.get("HERMES_API_KEY", ""))

    # Env var allowlist for worker subprocesses
    worker_env_allowlist: list[str] = field(default_factory=lambda: _csv("WORKER_ENV_ALLOWLIST", "HOME,PATH,LANG,OPENAI_API_KEY,ANTHROPIC_API_KEY"))

    # Identity for MC telemetry
    gateway_name: str = field(default_factory=lambda: f"agent-gateway-{os.environ.get('GATEWAY_NAME_SUFFIX') or os.uname().nodename}")

    def db_path(self) -> Path:
        return self.data_dir / "tasks.db"

    def logs_dir(self) -> Path:
        return self.data_dir / "logs"

    def worktrees_dir(self) -> Path:
        return self.data_dir / "worktrees"

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir().mkdir(parents=True, exist_ok=True)
        self.worktrees_dir().mkdir(parents=True, exist_ok=True)

    def worker_env(self) -> dict[str, str]:
        """Subset of process env that worker subprocesses are allowed to see."""
        return {k: os.environ[k] for k in self.worker_env_allowlist if k in os.environ}
