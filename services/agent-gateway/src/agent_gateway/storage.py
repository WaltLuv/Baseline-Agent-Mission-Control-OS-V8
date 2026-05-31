"""SQLite-backed task store. Single-process, single-writer. The gateway is one
asyncio process, so a single connection with WAL mode is plenty.
"""
from __future__ import annotations

import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    agent TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'timeout', 'cancelled')),
    prompt TEXT NOT NULL,
    workdir TEXT,
    worktree TEXT,
    workspace_id INTEGER,
    model TEXT,
    exit_code INTEGER,
    started_at REAL,
    finished_at REAL,
    duration_ms INTEGER,
    cost_usd REAL,
    metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent  ON tasks(agent);
"""


class TaskStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        # isolation_level=None puts sqlite3 in autocommit mode; we then open
        # transactions explicitly with BEGIN ... COMMIT in `_tx()`.
        self._conn = sqlite3.connect(str(db_path), check_same_thread=False, isolation_level=None)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._conn.row_factory = sqlite3.Row
        # `executescript` issues its own COMMIT internally — run it OUTSIDE
        # the `_tx()` helper so we don't try to commit twice.
        self._conn.executescript(SCHEMA)

    @contextmanager
    def _tx(self):
        cur = self._conn.cursor()
        in_tx = False
        try:
            cur.execute("BEGIN")
            in_tx = True
            yield cur
            cur.execute("COMMIT")
            in_tx = False
        except Exception:
            if in_tx:
                cur.execute("ROLLBACK")
            raise
        finally:
            cur.close()

    def create(self, *, agent: str, prompt: str, workdir: str | None, worktree: str | None,
               workspace_id: int, model: str | None, metadata: dict[str, Any] | None = None) -> str:
        task_id = uuid.uuid4().hex
        with self._tx() as cur:
            cur.execute(
                "INSERT INTO tasks (id, agent, status, prompt, workdir, worktree, workspace_id, model, metadata_json) "
                "VALUES (?, ?, 'queued', ?, ?, ?, ?, ?, ?)",
                (task_id, agent, prompt, workdir, worktree, workspace_id, model, json.dumps(metadata or {})),
            )
        return task_id

    def mark_started(self, task_id: str) -> None:
        with self._tx() as cur:
            cur.execute(
                "UPDATE tasks SET status='running', started_at=? WHERE id=?",
                (time.time(), task_id),
            )

    def mark_finished(self, task_id: str, *, status: str, exit_code: int | None,
                      cost_usd: float | None = None) -> None:
        now = time.time()
        with self._tx() as cur:
            row = cur.execute("SELECT started_at FROM tasks WHERE id=?", (task_id,)).fetchone()
            started_at = row["started_at"] if row and row["started_at"] else now
            duration_ms = int((now - started_at) * 1000)
            cur.execute(
                "UPDATE tasks SET status=?, exit_code=?, finished_at=?, duration_ms=?, cost_usd=? WHERE id=?",
                (status, exit_code, now, duration_ms, cost_usd, task_id),
            )

    def get(self, task_id: str) -> dict[str, Any] | None:
        cur = self._conn.cursor()
        row = cur.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        cur.close()
        if not row:
            return None
        d = dict(row)
        d["metadata"] = json.loads(d.pop("metadata_json") or "{}")
        return d

    def list_recent(self, limit: int = 50, agent: str | None = None) -> list[dict[str, Any]]:
        cur = self._conn.cursor()
        if agent:
            rows = cur.execute(
                "SELECT * FROM tasks WHERE agent=? ORDER BY COALESCE(started_at, 0) DESC LIMIT ?",
                (agent, limit),
            ).fetchall()
        else:
            rows = cur.execute(
                "SELECT * FROM tasks ORDER BY COALESCE(started_at, 0) DESC LIMIT ?",
                (limit,),
            ).fetchall()
        cur.close()
        out = []
        for r in rows:
            d = dict(r)
            d["metadata"] = json.loads(d.pop("metadata_json") or "{}")
            out.append(d)
        return out

    def close(self) -> None:
        self._conn.close()
