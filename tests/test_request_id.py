"""API request correlation IDs and error envelope."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthz_includes_request_id_header():
    r = client.get("/healthz", headers={"X-Request-Id": "req-test-001"})
    assert r.status_code == 200
    assert r.headers.get("X-Request-Id") == "req-test-001"


def test_validation_error_uses_error_envelope():
    r = client.post("/api/v1/auth/login", json={})
    assert r.status_code == 422
    body = r.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["request_id"]
    assert r.headers.get("X-Request-Id") == body["error"]["request_id"]
