"""Profile uses session role + human labels (bootstrap users without user-store row)."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.sessions import create_session
from app.main import app


def test_me_profile_uses_session_role_label():
    client = TestClient(app)
    tok = create_session("bootstrap_only", "PlatformAdmin")
    r = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    body = r.json()
    assert body["role"] == "PlatformAdmin"
    assert body["role_label"] == "Platform administrator"