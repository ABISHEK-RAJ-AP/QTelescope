"""SSE stream_ticket auth (SEC-05)."""
from starlette.requests import Request

from fastapi.testclient import TestClient

from app.core.api_auth import _extract_token
from app.core.config import settings
from app.core.sessions import create_session
from app.core.stream_tickets import issue_stream_ticket, reset_stream_tickets
from app.main import app

P = settings.API_V1_STR


def _request(path: str, query: str) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": path,
        "query_string": query.encode("latin-1"),
        "headers": [],
    }
    return Request(scope)


def test_stream_ticket_mints_and_resolves():
    reset_stream_tickets()
    tok = create_session("alice", "Operator")
    ticket, ttl = issue_stream_ticket(tok)
    assert ticket.startswith("st_")
    assert ttl > 0
    client = TestClient(app)
    r = client.post(f"{P}/auth/stream-ticket", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    body = r.json()
    assert body["stream_ticket"].startswith("st_")
    assert body["expires_in"] >= 60


def test_middleware_resolves_stream_ticket(monkeypatch):
    monkeypatch.setenv("QRE_PROFILE", "production")
    reset_stream_tickets()
    tok = create_session("bob", "Operator")
    ticket, _ = issue_stream_ticket(tok)
    req = _request(f"{P}/events/stream", f"stream_ticket={ticket}")
    assert _extract_token(req) == tok


def test_production_rejects_access_token_query(monkeypatch):
    monkeypatch.setenv("QRE_PROFILE", "production")
    tok = create_session("bob", "Operator")
    req = _request(f"{P}/events/stream", f"access_token={tok}")
    assert _extract_token(req) is None


def test_lab_allows_legacy_access_token_query(monkeypatch):
    monkeypatch.delenv("QRE_PROFILE", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    tok = create_session("carol", "Operator")
    req = _request(f"{P}/events/stream", f"access_token={tok}")
    assert _extract_token(req) == tok


def test_sse_requires_auth_when_no_ticket(monkeypatch):
    monkeypatch.setenv("REQUIRE_API_AUTH", "true")
    client = TestClient(app)
    assert client.get(f"{P}/events/stream").status_code == 401
