import pytest
from fastapi.testclient import TestClient
from app.main import app, seed_initial_telemetry

@pytest.fixture(scope="session", autouse=True)
def setup_test_data():
    seed_initial_telemetry()

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert "platform" in response.json()

def test_admin_summary():
    response = client.get("/api/v1/admin/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_backends" in data
    assert data["total_backends"] >= 1

def test_get_backends():
    response = client.get("/api/v1/backends")
    assert response.status_code == 200
    backends = response.json()
    assert len(backends) > 0

def test_backend_detail():
    backends = client.get("/api/v1/backends").json()
    target_id = backends[0]["backend_id"]
    response = client.get(f"/api/v1/backends/{target_id}")
    assert response.status_code == 200
    assert response.json()["backend_id"] == target_id

def test_qubit_endpoints():
    backends = client.get("/api/v1/backends").json()
    target_id = backends[0]["backend_id"]
    response = client.get(f"/api/v1/backends/{target_id}/qubits")
    assert response.status_code == 200
    qubits = response.json()
    assert len(qubits) > 0
    assert qubits[0]["qubit_index"] == 0

def test_calibration_endpoints():
    response = client.get("/api/v1/calibration")
    assert response.status_code == 200
    assert len(response.json()) > 0

def test_drift_endpoints():
    backends = client.get("/api/v1/backends").json()
    target_id = backends[0]["backend_id"]
    response = client.get(f"/api/v1/drift/{target_id}?metric=t1")
    assert response.status_code == 200
    data = response.json()
    assert data["backend_id"] == target_id
    assert "drift_status" in data

def test_health_endpoints():
    response = client.get("/api/v1/health/backends")
    assert response.status_code == 200
    health_list = response.json()
    assert len(health_list) > 0
    assert "contributing_factors" in health_list[0]

def test_alerts_endpoints():
    response = client.get("/api/v1/alerts")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_jobs_endpoints():
    response = client.get("/api/v1/jobs")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_reports_export():
    response = client.get("/api/v1/reports/export?report_type=backend_monitoring&format=csv")
    assert response.status_code == 200
    assert "backend_id" in response.text

def test_captcha_generation():
    response = client.get("/api/v1/auth/captcha")
    assert response.status_code == 200
    data = response.json()
    assert "captcha_id" in data
    assert "captcha_image" in data
    assert data["captcha_image"].startswith("data:image/svg+xml")

def test_login_with_captcha_validation():
    from app.core.config import settings
    # 1. Fetch CAPTCHA
    cap_resp = client.get("/api/v1/auth/captcha").json()
    captcha_id = cap_resp["captcha_id"]

    # 2. Failed login with wrong CAPTCHA
    fail_resp = client.post("/api/v1/auth/login", json={
        "username": settings.ADMIN_USERNAME,
        "password": settings.ADMIN_PASSWORD,
        "captcha_id": captcha_id,
        "captcha_code": "WRONG"
    })
    assert fail_resp.status_code == 400

    # 3. Successful verification with correct CAPTCHA from internal store
    from app.api.auth import _CAPTCHA_STORE
    cap_resp2 = client.get("/api/v1/auth/captcha").json()
    cid2 = cap_resp2["captcha_id"]
    correct_code = _CAPTCHA_STORE[cid2]["code"]

    success_resp = client.post("/api/v1/auth/login", json={
        "username": settings.ADMIN_USERNAME,
        "password": settings.ADMIN_PASSWORD,
        "captcha_id": cid2,
        "captcha_code": correct_code,
        "role": "Admin"
    })
    assert success_resp.status_code == 200
    assert success_resp.json()["status"] == "SUCCESS"
    assert success_resp.json()["user"]["username"] == settings.ADMIN_USERNAME

