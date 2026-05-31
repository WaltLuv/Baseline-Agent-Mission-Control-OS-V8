"""Config tests — env-driven, no side effects."""
from __future__ import annotations

import os
from pathlib import Path

import pytest

from agent_gateway.config import Config


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    """Wipe gateway env vars so each test starts clean."""
    for var in [
        "MC_URL", "MC_API_KEY", "GATEWAY_WORKSPACE_ID", "MC_REPORT_INTERVAL_SECS",
        "GATEWAY_DATA_DIR", "ENABLED_AGENTS",
        "CLAUDE_ALLOWED_TOOLS", "CLAUDE_MAX_TURNS", "CODEX_FULL_AUTO", "CODEX_MODEL",
        "OPENCODE_MODEL", "TASK_MAX_RUNTIME_SECS", "WORKTREE_BASE_REPO",
        "HERMES_URL", "HERMES_API_KEY", "WORKER_ENV_ALLOWLIST",
    ]:
        monkeypatch.delenv(var, raising=False)


def test_defaults_are_sane():
    cfg = Config()
    assert cfg.enabled_agents == ["claude", "codex", "opencode", "hermes"]
    assert cfg.claude_max_turns == 12
    assert cfg.codex_full_auto is True
    assert cfg.task_max_runtime_secs == 1800
    assert cfg.mc_workspace_id == 1
    assert cfg.mc_report_interval_secs == 15


def test_enabled_agents_csv(monkeypatch):
    monkeypatch.setenv("ENABLED_AGENTS", "claude, codex,opencode ")
    cfg = Config()
    assert cfg.enabled_agents == ["claude", "codex", "opencode"]


def test_bool_parsing(monkeypatch):
    monkeypatch.setenv("CODEX_FULL_AUTO", "no")
    assert Config().codex_full_auto is False
    monkeypatch.setenv("CODEX_FULL_AUTO", "true")
    assert Config().codex_full_auto is True


def test_int_parsing_with_garbage(monkeypatch):
    monkeypatch.setenv("CLAUDE_MAX_TURNS", "not-a-number")
    assert Config().claude_max_turns == 12  # falls back to default


def test_url_trailing_slash_stripped(monkeypatch):
    monkeypatch.setenv("MC_URL", "https://example.com/")
    assert Config().mc_url == "https://example.com"


def test_worker_env_filters_to_allowlist(monkeypatch):
    monkeypatch.setenv("WORKER_ENV_ALLOWLIST", "ALPHA,BETA")
    monkeypatch.setenv("ALPHA", "1")
    monkeypatch.setenv("BETA", "2")
    monkeypatch.setenv("GAMMA", "3")  # not in allowlist → must NOT appear
    cfg = Config()
    env = cfg.worker_env()
    assert env == {"ALPHA": "1", "BETA": "2"}


def test_worker_env_never_leaks_mc_secrets(monkeypatch):
    """MC_API_KEY must never be in the default allowlist — confirms that worker
    subprocesses can't read it from their env."""
    cfg = Config()
    monkeypatch.setenv("MC_API_KEY", "supersecret")
    env = cfg.worker_env()
    assert "MC_API_KEY" not in env


def test_ensure_dirs_creates_layout(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("GATEWAY_DATA_DIR", str(tmp_path / "data"))
    cfg = Config()
    cfg.ensure_dirs()
    assert cfg.data_dir.exists()
    assert cfg.logs_dir().exists()
    assert cfg.worktrees_dir().exists()
