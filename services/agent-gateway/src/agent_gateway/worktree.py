"""Per-task git worktree isolation. Workers operate in their own worktree so
parallel tasks can't stomp on each other's diffs.
"""
from __future__ import annotations

import asyncio
import shutil
from pathlib import Path


async def _git(*args: str, cwd: str | Path) -> tuple[int, str, str]:
    proc = await asyncio.create_subprocess_exec(
        "git", *args,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return proc.returncode or 0, stdout.decode(errors="replace"), stderr.decode(errors="replace")


async def create_worktree(base_repo: str, dest: Path, branch: str | None = None) -> Path:
    """Create a fresh worktree of `base_repo` at `dest`. Branch defaults to a
    short-lived branch named `agent-task/<dest-basename>`."""
    dest = Path(dest).resolve()
    dest.parent.mkdir(parents=True, exist_ok=True)
    branch_name = branch or f"agent-task/{dest.name}"

    # Find a reasonable base ref — prefer HEAD of the source repo.
    rc, head, err = await _git("rev-parse", "HEAD", cwd=base_repo)
    if rc != 0:
        raise RuntimeError(f"git rev-parse failed in {base_repo}: {err.strip()}")
    head_sha = head.strip()

    rc, _, err = await _git("worktree", "add", "-b", branch_name, str(dest), head_sha, cwd=base_repo)
    if rc != 0:
        raise RuntimeError(f"git worktree add failed: {err.strip()}")
    return dest


async def cleanup_worktree(base_repo: str, worktree: Path) -> None:
    """Remove a worktree. Safe to call even if the worktree was already
    removed manually."""
    worktree = Path(worktree)
    # `git worktree remove --force` is the canonical way
    await _git("worktree", "remove", "--force", str(worktree), cwd=base_repo)
    # If anything is left on disk, nuke it
    if worktree.exists():
        shutil.rmtree(worktree, ignore_errors=True)
