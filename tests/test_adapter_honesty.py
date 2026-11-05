import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.safe_url import assert_safe_http_url
from app.providers.ibm_adapter import IBMProviderAdapter
from app.providers.ionq_adapter import parse_ionq_backends
from app.providers.onprem_adapter import OnPremiseProviderAdapter, parse_onprem_backends


def test_ibm_empty_when_mock_off(monkeypatch):
    monkeypatch.setenv("ENABLE_MOCK_DATA", "false")
    monkeypatch.setattr(type(settings), "ENABLE_MOCK_DATA", property(lambda self: False))
    monkeypatch.setattr(type(settings), "IBM_QUANTUM_TOKEN", property(lambda self: ""))
    adapter = IBMProviderAdapter(api_token="")
    assert adapter.discover_backends() == []
    status = adapter.get_backend_status("ibm_brisbane")
    assert status["operational"] is False
    assert adapter.get_backend_properties("ibm_brisbane")["qubits"] == []
    assert adapter.get_jobs("ibm_brisbane") == []


def test_parse_ionq_backends_no_invention():
    rows = parse_ionq_backends([
        {"backend": "qpu.aria-1", "status": "available", "qubits": 25},
        {"qubits": 3},
    ])
    assert len(rows) == 1
    assert rows[0]["backend_id"] == "ionq_qpu_aria_1"
    assert rows[0]["qubit_count"] == 25
    assert rows[0]["operational_status"] == "ONLINE"
    assert "quantum_volume" not in rows[0]


def test_parse_onprem_backends():
    rows = parse_onprem_backends(
        {"backends": [{"id": "lab_qpu", "n_qubits": 8, "status": "ONLINE"}]},
        "https://lab.example.internal",
    )
    assert rows[0]["backend_id"] == "lab_qpu"
    assert rows[0]["qubit_count"] == 8


def test_onprem_empty_without_url_when_mock_off(monkeypatch):
    monkeypatch.setenv("ENABLE_MOCK_DATA", "false")
    monkeypatch.setattr(type(settings), "ENABLE_MOCK_DATA", property(lambda self: False))
    monkeypatch.setattr(type(settings), "ONPREM_QPU_URL", property(lambda self: ""))
    adapter = OnPremiseProviderAdapter(endpoint_url="")
    assert adapter.is_connected is False
    assert adapter.discover_backends() == []


def test_safe_url_rejects_metadata_and_file():
    with pytest.raises(HTTPException):
        assert_safe_http_url("file:///etc/passwd")
    with pytest.raises(HTTPException):
        assert_safe_http_url("http://169.254.169.254/latest/meta-data")
    assert assert_safe_http_url("https://lab.example.edu/qpu") == "https://lab.example.edu/qpu"


def test_safe_url_blocks_loopback_in_prod():
    with pytest.raises(HTTPException):
        assert_safe_http_url("http://127.0.0.1:8080", allow_loopback=False)
