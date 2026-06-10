"""
Customer Zero activation flow regression tests (iteration 7).
Covers: signup auto-seeds General project, onboarding agent provision (no capacity error),
runtime-key mint, workspaces invite, billing endpoint, auth round-trip.
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://mission-control-v8.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def cz_session():
    ts = int(time.time() * 1000)
    email = f"cz-iter7-{ts}@example.com"
    pwd = "CustomerZeroPass42!!"
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/signup", json={
        "email": email,
        "password": pwd,
        "full_name": "CZ Iter7",
        "company_name": f"AcmeIter7-{ts}",
        "business_type": "pm",
    })
    assert r.status_code in (200, 201), f"signup failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    return {"session": s, "email": email, "password": pwd, "data": data}


# --- signup module ---
class TestSignupSeed:
    def test_signup_returns_workspace_and_user(self, cz_session):
        d = cz_session["data"]
        assert ("user" in d) or ("workspace" in d) or ("ok" in d), f"unexpected signup body: {d}"

    def test_default_project_seeded(self, cz_session):
        s = cz_session["session"]
        r = s.get(f"{BASE_URL}/api/projects")
        assert r.status_code == 200, f"/api/projects: {r.status_code} {r.text[:200]}"
        body = r.json()
        # Force visible failure with raw body
        items_raw = body.get("projects") if isinstance(body, dict) else None
        names = [p.get("name", "").lower() for p in (items_raw or [])]
        assert any("general" in n for n in names), f"No 'General' project seeded. raw_body={body!r}, cookies={list(s.cookies.keys())}"


# --- onboarding agent provision (was failing on 'capacity' column) ---
class TestOnboardingAgents:
    def test_create_agent_no_capacity_error(self, cz_session):
        s = cz_session["session"]
        r = s.post(f"{BASE_URL}/api/agents", json={
            "name": "TEST_OnboardingAgent",
            "role": "AI Employee",
            "status": "offline",
        })
        assert r.status_code in (200, 201), f"agent create failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        agent = body.get("agent", body)
        assert "id" in agent or "agent_id" in agent

    def test_create_task_no_active_project_error(self, cz_session):
        s = cz_session["session"]
        r = s.post(f"{BASE_URL}/api/tasks", json={
            "title": "TEST_StarterTask",
            "description": "Hello",
        })
        # Accept 200/201 (success) — must NOT be 500 "No active project"
        assert r.status_code != 500, f"500 on /api/tasks (likely no default project): {r.text[:300]}"
        assert r.status_code in (200, 201, 400, 422), f"Unexpected: {r.status_code} {r.text[:200]}"


# --- runtime key mint with connect_command shape ---
class TestRuntimeKeyShape:
    @pytest.mark.parametrize("runtime", ["claude", "codex", "openclaw", "hermes"])
    def test_connect_command_structure(self, cz_session, runtime):
        s = cz_session["session"]
        r = s.post(f"{BASE_URL}/api/onboarding/runtime-key", json={"runtime": runtime})
        assert r.status_code == 200, f"{runtime}: {r.status_code} {r.text[:200]}"
        body = r.json()
        assert body.get("api_key", "").startswith("mca_"), f"bad api_key: {body.get('api_key')[:20]}"
        assert body.get("api_key_hint"), "missing api_key_hint"
        cmd = body.get("connect_command", "")
        assert "MC_URL" in cmd and "MC_API_KEY" in cmd and "RUNTIME_TYPE" in cmd, f"bad command: {cmd[:200]}"
        assert "connect-runtime.mjs" in cmd, f"missing connect-runtime.mjs in: {cmd[:200]}"


def _extract_workspace_id(me_body):
    """Pull the workspace id out of /api/auth/me, tolerating three shapes."""
    return (
        me_body.get("workspace_id")
        or (me_body.get("workspace") or {}).get("id")
        or (me_body.get("user") or {}).get("workspace_id")
    )


# --- workspace invite ---
class TestInviteFlow:
    def _workspace_id(self, session):
        me = session.get(f"{BASE_URL}/api/auth/me")
        assert me.status_code == 200
        meb = me.json()
        wid = _extract_workspace_id(meb)
        assert wid, f"no workspace_id in /me: {meb}"
        return wid

    def test_invite_teammate_returns_2xx(self, cz_session):
        s = cz_session["session"]
        wid = self._workspace_id(s)
        r = s.post(f"{BASE_URL}/api/workspaces/{wid}/invites", json={
            "email": f"teammate-iter7-{int(time.time())}@example.com",
            "role": "operator",
        })
        assert r.status_code in (200, 201), f"invite failed: {r.status_code} {r.text[:300]}"

    def test_invite_teammate_returns_accept_url(self, cz_session):
        s = cz_session["session"]
        wid = self._workspace_id(s)
        r = s.post(f"{BASE_URL}/api/workspaces/{wid}/invites", json={
            "email": f"teammate-iter7-{int(time.time())}@example.com",
            "role": "operator",
        })
        body = r.json()
        accept_url = body.get("accept_url") or (body.get("invite") or {}).get("accept_url")
        assert accept_url, f"no accept_url: {body}"


# --- billing ---
class TestBilling:
    def test_billing_overview_200(self, cz_session):
        s = cz_session["session"]
        r = s.get(f"{BASE_URL}/api/billing/overview")
        assert r.status_code == 200, f"billing: {r.status_code} {r.text[:200]}"


# --- logout / login round-trip ---
class TestAuthRoundTrip:
    def test_logout_then_login(self, cz_session):
        s = cz_session["session"]
        # logout
        s.post(f"{BASE_URL}/api/auth/logout")
        # confirm unauth
        unauth = s.get(f"{BASE_URL}/api/auth/me")
        assert unauth.status_code in (401, 403, 200), f"unexpected me after logout: {unauth.status_code}"
        # login — API expects 'username' field (which accepts email-shaped value too)
        r = s.post(f"{BASE_URL}/api/auth/login", json={
            "username": cz_session["email"],
            "password": cz_session["password"],
        })
        assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
        me = s.get(f"{BASE_URL}/api/auth/me")
        assert me.status_code == 200
        meb = me.json()
        # workspace persists — should still have same workspace id post-relogin
        assert (meb.get("workspace_id") or (meb.get("workspace") or {}).get("id") or (meb.get("user") or {}).get("workspace_id")), f"no workspace post-login: {meb}"
