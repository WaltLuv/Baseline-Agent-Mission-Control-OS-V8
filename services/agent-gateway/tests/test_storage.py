"""TaskStore tests — SQLite round-trip, status transitions, retrieval."""
from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from agent_gateway.storage import TaskStore


@pytest.fixture
def store(tmp_path: Path) -> TaskStore:
    s = TaskStore(tmp_path / "tasks.db")
    yield s
    s.close()


def test_create_returns_unique_ids(store: TaskStore):
    ids = {store.create(agent="codex", prompt="t1", workdir=".", worktree=None,
                        workspace_id=1, model=None) for _ in range(5)}
    assert len(ids) == 5


def test_round_trip_metadata(store: TaskStore):
    tid = store.create(agent="claude", prompt="refactor", workdir="/tmp",
                       worktree=None, workspace_id=2, model="claude-sonnet-4",
                       metadata={"phase": "review"})
    row = store.get(tid)
    assert row is not None
    assert row["agent"] == "claude"
    assert row["status"] == "queued"
    assert row["workspace_id"] == 2
    assert row["model"] == "claude-sonnet-4"
    assert row["metadata"] == {"phase": "review"}


def test_mark_started_updates_status_and_timestamp(store: TaskStore):
    tid = store.create(agent="codex", prompt="x", workdir=".", worktree=None,
                       workspace_id=1, model=None)
    before = time.time()
    store.mark_started(tid)
    after = time.time()
    row = store.get(tid)
    assert row["status"] == "running"
    assert before <= row["started_at"] <= after


def test_mark_finished_records_duration(store: TaskStore):
    tid = store.create(agent="codex", prompt="x", workdir=".", worktree=None,
                       workspace_id=1, model=None)
    store.mark_started(tid)
    time.sleep(0.01)
    store.mark_finished(tid, status="succeeded", exit_code=0, cost_usd=0.0012)
    row = store.get(tid)
    assert row["status"] == "succeeded"
    assert row["exit_code"] == 0
    assert row["cost_usd"] == pytest.approx(0.0012)
    assert row["duration_ms"] is not None
    assert row["duration_ms"] >= 0


def test_mark_finished_without_start_still_works(store: TaskStore):
    tid = store.create(agent="codex", prompt="x", workdir=".", worktree=None,
                       workspace_id=1, model=None)
    store.mark_finished(tid, status="failed", exit_code=2)
    row = store.get(tid)
    assert row["status"] == "failed"
    assert row["exit_code"] == 2


def test_list_recent_orders_newest_first(store: TaskStore):
    ids = []
    for i in range(3):
        tid = store.create(agent="codex", prompt=f"p{i}", workdir=".", worktree=None,
                           workspace_id=1, model=None)
        store.mark_started(tid)
        ids.append(tid)
        time.sleep(0.005)
    recent = store.list_recent(limit=10)
    assert [r["id"] for r in recent] == list(reversed(ids))


def test_list_recent_filter_by_agent(store: TaskStore):
    a1 = store.create(agent="codex", prompt="a", workdir=".", worktree=None,
                      workspace_id=1, model=None)
    a2 = store.create(agent="claude", prompt="b", workdir=".", worktree=None,
                      workspace_id=1, model=None)
    store.mark_started(a1)
    store.mark_started(a2)
    codex_only = store.list_recent(limit=10, agent="codex")
    assert [r["id"] for r in codex_only] == [a1]


def test_get_returns_none_for_unknown(store: TaskStore):
    assert store.get("does-not-exist") is None


def test_status_check_rejects_invalid(store: TaskStore):
    tid = store.create(agent="codex", prompt="x", workdir=".", worktree=None,
                       workspace_id=1, model=None)
    import sqlite3
    with pytest.raises(sqlite3.IntegrityError):
        store._conn.execute("UPDATE tasks SET status='banana' WHERE id=?", (tid,))
