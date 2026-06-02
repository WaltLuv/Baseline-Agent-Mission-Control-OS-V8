"""Backend tests for the 3-step Activation Hub pass.

Covers:
  - /help (public) returns 200 unauthenticated
  - POST /api/onboarding/runtime-key (auth + validation + happy path)
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://token-monetization.preview.emergentagent.com").rstrip("/")
ADMIN_USER = "admin"
ADMIN_PASS = "admin12345"
UA = {"User-Agent": "Mozilla/5.0 (compatible; ActivationPassTest/1.0)"}


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update(UA)
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASS},
        timeout=30,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def anon_session():
    s = requests.Session()
    s.headers.update(UA)
    return s


# ---------- /help public route ----------
class TestHelpPublic:
    def test_help_loads_unauth_200(self, anon_session):
        r = anon_session.get(f"{BASE_URL}/help", timeout=30)
        assert r.status_code == 200, f"GET /help returned {r.status_code}"
        body = r.text.lower()
        assert "how can we help" in body, "Help h1 missing"
        assert 'data-testid="help-center"' in r.text
        assert 'data-testid="help-search"' in r.text


# ---------- /api/onboarding/runtime-key ----------
class TestRuntimeKeyApi:
    def test_unauth_returns_401(self, anon_session):
        r = anon_session.post(
            f"{BASE_URL}/api/onboarding/runtime-key",
            json={"runtime": "claude"},
            timeout=30,
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"

    def test_invalid_runtime_returns_400(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/onboarding/runtime-key",
            json={"runtime": "invalid"},
            timeout=30,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        body = r.json()
        assert "error" in body
        # error should mention allowed runtimes
        assert "runtime" in body["error"].lower()
        assert "claude" in body["error"].lower()

    @pytest.fixture
    def provisioned(self, admin_session, runtime):
        """Provision a runtime key and return the parsed response body."""
        r = admin_session.post(
            f"{BASE_URL}/api/onboarding/runtime-key",
            json={"runtime": runtime},
            timeout=30,
        )
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        return r.json()

    @pytest.mark.parametrize("runtime", ["claude", "codex", "openclaw", "hermes"])
    def test_returns_api_key_with_correct_prefix(self, provisioned):
        assert "api_key" in provisioned, provisioned
        assert provisioned["api_key"].startswith("mca_"), provisioned["api_key"]

    @pytest.mark.parametrize("runtime", ["claude", "codex", "openclaw", "hermes"])
    def test_api_key_length_meets_minimum(self, provisioned):
        assert len(provisioned["api_key"]) >= 47, f"api_key too short: {len(provisioned['api_key'])}"

    @pytest.mark.parametrize("runtime", ["claude", "codex", "openclaw", "hermes"])
    def test_returns_integer_agent_id(self, provisioned):
        assert "agent_id" in provisioned
        assert isinstance(provisioned["agent_id"], int)

    @pytest.mark.parametrize("runtime", ["claude", "codex", "openclaw", "hermes"])
    def test_agent_name_includes_runtime(self, provisioned, runtime):
        assert "agent_name" in provisioned and runtime in provisioned["agent_name"]

    @pytest.mark.parametrize("runtime", ["claude", "codex", "openclaw", "hermes"])
    def test_connect_command_shape(self, provisioned):
        assert "connect_command" in provisioned
        cmd = provisioned["connect_command"]
        assert "MC_URL=" in cmd
        assert "MC_API_KEY=" in cmd
        assert "node scripts/connect-runtime.mjs" in cmd
