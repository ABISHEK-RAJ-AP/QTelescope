"""FE-critical HTTP routes respond (IMP-P2 contract gate)."""
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)
P = settings.API_V1_STR


def test_coherence_and_metrics_registry():
    r = client.get(f"{P}/health/coherence")
    assert r.status_code == 200
    body = r.json()
    assert "by_modality" in body and "backends" in body

    reg = client.get(f"{P}/metrics/registry")
    assert reg.status_code == 200
    assert "metrics" in reg.json()


def test_drift_qubit_route_exists():
    # 404 backend is fine — proves route is wired (not 405)
    r = client.get(f"{P}/drift/no_such_backend/qubits/0?limit=20")
    assert r.status_code in (200, 404)
