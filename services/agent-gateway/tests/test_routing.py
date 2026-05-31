"""Routing heuristics tests — pure function, no CLI agents needed."""
from __future__ import annotations

import pytest

from agent_gateway.routing import pick_agent


@pytest.fixture
def all_enabled() -> list[str]:
    return ["claude", "codex", "opencode", "hermes"]


def test_explicit_preferred_wins(all_enabled):
    assert pick_agent("anything", "claude", all_enabled) == "claude"
    assert pick_agent("anything", "codex", all_enabled) == "codex"
    assert pick_agent("anything", "hermes", all_enabled) == "hermes"


def test_preferred_not_enabled_raises():
    with pytest.raises(ValueError):
        pick_agent("x", "claude", ["codex"])


def test_refactor_routes_to_claude(all_enabled):
    assert pick_agent("Please refactor the auth middleware for clarity", "auto", all_enabled) == "claude"
    assert pick_agent("Code review this PR", "auto", all_enabled) == "claude"
    assert pick_agent("rearchitect the storage layer", "auto", all_enabled) == "claude"


def test_implement_routes_to_codex(all_enabled):
    assert pick_agent("Add tests for the login flow", "auto", all_enabled) == "codex"
    assert pick_agent("Fix the failing test in workers.py", "auto", all_enabled) == "codex"
    assert pick_agent("Implement a debounce helper", "auto", all_enabled) == "codex"


def test_browser_routes_to_opencode(all_enabled):
    assert pick_agent("Use a headless browser to scrape this page", "auto", all_enabled) == "opencode"


def test_orchestration_routes_to_hermes(all_enabled):
    assert pick_agent("Schedule this background workflow nightly", "auto", all_enabled) == "hermes"


def test_no_match_falls_back_to_codex_when_enabled(all_enabled):
    assert pick_agent("blue moon orange", "auto", all_enabled) == "codex"


def test_no_match_falls_back_to_claude_when_codex_disabled():
    assert pick_agent("blue moon", "auto", ["claude", "opencode"]) == "claude"


def test_empty_enabled_raises():
    with pytest.raises(ValueError):
        pick_agent("anything", "auto", [])


def test_auto_aliases():
    """Both 'auto' and 'automatic' map to heuristic routing."""
    assert pick_agent("refactor x", "auto", ["claude", "codex"]) == "claude"
    assert pick_agent("refactor x", "automatic", ["claude", "codex"]) == "claude"
