"""Daily Brief consumer endpoint tests (iteration 9).

Scope: GET /api/daily-brief — Mission Control fallback aggregator.
Verifies the DailyBriefPayload contract, both window variants, the
empty-state path (skipped when a workforce is already installed), and
401 on unauthenticated access.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://mission-control-v8.preview.emergentagent.com"
).rstrip("/")


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin12345"},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


REQUIRED_KEYS = {
    "workspace_id", "workforce_slug", "workforce_vertical", "date_range",
    "headline", "narrative", "by_the_numbers", "attention", "persona_breakdown",
    "proof_links", "status_line", "critical_banner", "empty_state",
    "generated_at", "source",
}

NUMBERS_KEYS = {
    "tasks_handled", "approvals_requested", "approvals_granted",
    "tool_executions", "proofs_delivered", "failed_executions",
    "estimated_hours_saved",
}


# ─── Authentication ──────────────────────────────────────────────
class TestAuth:
    def test_unauthenticated_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/daily-brief", timeout=10)
        assert r.status_code == 401


# ─── Contract / payload shape ────────────────────────────────────
class TestContract:
    def test_since_yesterday_payload_shape(self, session):
        r = session.get(f"{BASE_URL}/api/daily-brief?window=since-yesterday", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert REQUIRED_KEYS.issubset(d.keys()), f"missing keys: {REQUIRED_KEYS - d.keys()}"
        assert d["source"] == "mission-control-fallback"
        # date_range
        dr = d["date_range"]
        assert dr["window"] == "since-yesterday"
        assert set(dr.keys()) >= {"from_iso", "to_iso", "window", "label"}
        # by_the_numbers — all 7 fields
        nums = d["by_the_numbers"]
        assert NUMBERS_KEYS == set(nums.keys())
        for k, v in nums.items():
            assert isinstance(v, (int, float)), f"{k} not numeric"

    def test_since_last_login_window_and_copy(self, session):
        r = session.get(f"{BASE_URL}/api/daily-brief?window=since-last-login", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["date_range"]["window"] == "since-last-login"
        # Quiet-stretch headline ("Quiet stretch") OR active headline must use the
        # "since you were last here" copy variant.
        assert ("since you were last here" in d["headline"]) or ("Quiet stretch" in d["headline"])


# ─── Property Management installed scenario ──────────────────────
class TestPropertyManagement:
    def test_numbers_match_seeded_state(self, session):
        r = session.get(f"{BASE_URL}/api/daily-brief?window=since-yesterday", timeout=15)
        d = r.json()
        assert d["workforce_slug"] == "property-management"
        assert d["workforce_vertical"] == "Property Management"
        nums = d["by_the_numbers"]
        # Spec: 3/1/0/3/1/1/1.5
        assert nums["tasks_handled"] == 3
        assert nums["approvals_requested"] == 1
        assert nums["approvals_granted"] == 0
        assert nums["tool_executions"] == 3
        assert nums["proofs_delivered"] == 1
        assert nums["failed_executions"] == 1
        assert nums["estimated_hours_saved"] == 1.5

    def test_attention_kinds_present(self, session):
        r = session.get(f"{BASE_URL}/api/daily-brief?window=since-yesterday", timeout=15)
        d = r.json()
        kinds = {a["kind"] for a in d["attention"]}
        assert "approval_pending" in kinds
        assert "failed_execution" in kinds
        assert "critical_workflow" in kinds

    def test_critical_banner_and_status_line(self, session):
        r = session.get(f"{BASE_URL}/api/daily-brief?window=since-yesterday", timeout=15)
        d = r.json()
        assert d["critical_banner"] is not None
        cb = d["critical_banner"]
        for key in ("headline", "detail", "action_url", "action_label"):
            assert key in cb and cb[key]
        assert d["status_line"] == "Status: 3 items need your eye."

    def test_persona_breakdown_six_pm_personas(self, session):
        r = session.get(f"{BASE_URL}/api/daily-brief?window=since-yesterday", timeout=15)
        d = r.json()
        assert len(d["persona_breakdown"]) == 6
        for p in d["persona_breakdown"]:
            assert {"agent_id", "name", "role", "completed", "in_progress", "blocked"} <= p.keys()

    def test_proof_links_have_required_fields(self, session):
        r = session.get(f"{BASE_URL}/api/daily-brief?window=since-yesterday", timeout=15)
        d = r.json()
        assert len(d["proof_links"]) >= 1
        for pl in d["proof_links"]:
            assert {"task_id", "title", "delivered_at_iso"} <= pl.keys()

    def test_attention_urls_are_mission_control_deep_links(self, session):
        r = session.get(f"{BASE_URL}/api/daily-brief?window=since-yesterday", timeout=15)
        d = r.json()
        for a in d["attention"]:
            assert a["url"].startswith("/app/"), f"non-MC url: {a['url']}"

    def test_empty_state_is_null_when_workforce_installed(self, session):
        r = session.get(f"{BASE_URL}/api/daily-brief?window=since-yesterday", timeout=15)
        d = r.json()
        assert d["empty_state"] is None
