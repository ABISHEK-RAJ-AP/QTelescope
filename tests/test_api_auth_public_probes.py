"""Health probes stay public when REQUIRE_API_AUTH is on."""
from fastapi.testclient import TestClient

from app.main import app


def test_health_probes_public_with_require_auth(monkeypatch):
    monkeypatch.setenv("REQUIRE_API_AUTH", "true")
    client = TestClient(app)
    assert client.get("/healthz").status_code == 200
    assert client.get("/readyz").status_code in (200, 503)
