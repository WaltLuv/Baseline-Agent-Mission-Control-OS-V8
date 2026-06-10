"""Mission Control v8 ↔ Baseline OS integration smoke tests (iter 11).

Covers the eight scenarios in the review request:
 1. Login form POST works (Host header preserved → no CSRF mismatch)
 2. Authenticated /api/agents returns 200 after login
 3. Unauth /api/agents returns 401
 4. /api/runtime/handshake with x-api-key returns 2 Baseline runtimes
 5. Public pages /marketplace /roi-calculator /pricing render
 6. Login page /login renders
 7. Baseline OS console reachable internally on :4173
 8. Baseline OS sync doctor + push round-trip succeeds via the bun CLI
"""
import os
import subprocess
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    "https://c5bbdf3d-0d20-4a28-9767-ef9f129a4142.preview.emergentagent.com"
API_KEY = "mc_live_eba04a5e7773dc6901cb2699750c4c738ffd85ad5c33ac15"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_session(session):
    r = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin12345"},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
    return session


# ---- 1. Login POST (Host-header / CSRF fix) ----
class TestAuthLogin:
    def test_login_success(self, session):
        r = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin12345"},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["username"] == "admin"
        assert data["user"]["role"] == "admin"
        assert data["user"]["workspace_id"] == 1


# ---- 2 + 3. Protected endpoint auth gate ----
class TestProtectedEndpoints:
    def test_agents_unauth_401(self):
        r = requests.get(f"{BASE_URL}/api/agents", timeout=15)
        assert r.status_code == 401

    def test_agents_with_session_200(self, auth_session):
        r = auth_session.get(f"{BASE_URL}/api/agents", timeout=15)
        assert r.status_code == 200

    def test_agents_with_api_key_200(self):
        r = requests.get(
            f"{BASE_URL}/api/agents", headers={"x-api-key": API_KEY}, timeout=15
        )
        assert r.status_code == 200


# ---- 4. Runtime handshake via x-api-key ----
class TestRuntimeHandshake:
    def test_handshake_returns_two_baseline_runtimes(self):
        r = requests.get(
            f"{BASE_URL}/api/runtime/handshake",
            headers={"x-api-key": API_KEY},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        runtimes = data["runtimes"]
        kinds = sorted(rt["kind"] for rt in runtimes)
        assert "claude-code" in kinds
        assert "hermes" in kinds
        assert len(runtimes) >= 2
        for rt in runtimes:
            assert rt["workspaceId"] == 1
            assert "installationId" in rt
            assert "lastSeenAt" in rt and rt["lastSeenAt"] > 0


# ---- 5 + 6. Public + login pages render ----
class TestPublicPages:
    @pytest.mark.parametrize("path", ["/marketplace", "/roi-calculator", "/pricing", "/login"])
    def test_public_page_renders(self, path):
        r = requests.get(f"{BASE_URL}{path}", timeout=20)
        assert r.status_code == 200
        # very loose content sanity check — Next.js HTML response
        assert "<html" in r.text.lower() or "<!doctype html" in r.text.lower()


# ---- 7. Baseline OS console (internal-only by design) ----
class TestBaselineConsole:
    def test_console_reachable_internally(self):
        # Internal preview port — NOT externally routed (expected)
        r = requests.get("http://127.0.0.1:4173/", timeout=10)
        assert r.status_code == 200


# ---- 8. Baseline OS ↔ MC sync round-trip ----
class TestBaselineSyncCLI:
    def _run(self, args):
        env = os.environ.copy()
        env["PATH"] = "/app/.bun/bin:" + env.get("PATH", "")
        return subprocess.run(
            ["bun", "run", "scripts/mc.ts", *args, "--json"],
            cwd="/app/baseline-os",
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
        )

    def test_sync_doctor_all_checks_pass(self):
        out = self._run(["sync", "doctor"])
        assert out.returncode == 0, f"doctor failed: {out.stderr[:400]}"
        report = json.loads(out.stdout)
        assert report["ok"] is True
        assert all(c["ok"] for c in report["checks"]), report["checks"]

    def test_sync_push_two_runtimes_zero_failures(self):
        out = self._run(["sync", "push"])
        assert out.returncode == 0, f"push failed: {out.stderr[:400]}"
        report = json.loads(out.stdout)
        assert report["pushed"] == 2
        assert report["failed"] == 0
        for d in report["details"]:
            assert d["status"] == "ok"
