from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


def test_coverage_export_csv():
    with TestClient(app) as client:
        r = client.get(f"{settings.API_V1_STR}/metrics/coverage/export")
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    header = r.text.splitlines()[0]
    assert "backend_id" in header
    assert "group" in header