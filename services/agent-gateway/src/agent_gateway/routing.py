"""Task-routing heuristics. Pure function — easy to unit test.

Routing decision = keyword matching against the prompt + the operator's
preferred agent (if specified). Codex is the default workhorse because it's
the cheapest per-token for typical implementation work.
"""
from __future__ import annotations

import re
from typing import Iterable

# Lowercase keyword sets per agent. The match is "any keyword present".
KEYWORDS: dict[str, set[str]] = {
    "claude": {
        "refactor", "architecture", "review", "rewrite", "design", "rearchitect",
        "audit", "explain", "code review", "deep dive", "trace", "investigate",
    },
    "codex": {
        "implement", "add tests", "fix tests", "write tests", "fix bug", "patch",
        "add feature", "scaffold", "stub", "generate", "small change",
    },
    "opencode": {
        "browser", "scrape", "screenshot", "navigate", "browse",
        "openrouter", "cheap", "local model", "ollama", "open-source",
    },
    "hermes": {
        "schedule", "orchestrate", "queue", "long-running", "workflow",
        "remember", "memory", "background", "supervise",
    },
}


def _hits(prompt: str, keywords: Iterable[str]) -> int:
    p = prompt.lower()
    return sum(1 for k in keywords if k in p)


def pick_agent(prompt: str, preferred: str | None, enabled: list[str]) -> str:
    """Choose an agent for `prompt`. `preferred` ∈ {auto, claude, codex, opencode, hermes, None}.
    `enabled` is the list of agents the operator turned on in config.
    """
    if not enabled:
        raise ValueError("No agents enabled — set ENABLED_AGENTS in config")

    # Explicit override always wins, if the operator enabled it.
    if preferred and preferred not in {"auto", "automatic"}:
        if preferred in enabled:
            return preferred
        raise ValueError(f"Preferred agent {preferred!r} is not enabled ({enabled})")

    # Score each enabled agent
    scores = {a: _hits(prompt, KEYWORDS.get(a, set())) for a in enabled}
    best = max(scores.values())

    # If nothing matches, default by enabled-order preference: codex → claude → opencode → hermes
    if best == 0:
        for fallback in ("codex", "claude", "opencode", "hermes"):
            if fallback in enabled:
                return fallback
        return enabled[0]

    # Highest score wins; ties broken by KEYWORDS dict order
    for agent in KEYWORDS:
        if agent in enabled and scores.get(agent, 0) == best:
            return agent
    # Shouldn't reach here — defensive
    return enabled[0]


# Regex used by the build_feature flow to detect that a feature spec includes
# both implementation and review intent.
COMBINED_FEATURE_RE = re.compile(r"\b(build|ship|deliver|implement)\b.*\b(review|qa|verify)\b", re.IGNORECASE)
