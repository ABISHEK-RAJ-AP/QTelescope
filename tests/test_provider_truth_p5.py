from app.providers.catalog import BY_ID
from app.providers.truth import MOCK_ONLY, STUB, provider_truth_label, ionq_live_enabled
from app.providers.live_harness import run_live_verification
from app.facility.mqtt_boundary import NotBuiltFacilityMqtt, mqtt_ingest_status
from app.services.circuit_breaker import is_open, record_outcome
from app.services.collector_dlq import record_failure, list_failures
import pytest


def test_stub_vendor_truth():
    item = BY_ID["aws_braket"]
    assert provider_truth_label(item, configured=True) == STUB


def test_ionq_mock_only_default(monkeypatch):
    monkeypatch.delenv("IONQ_LIVE_ENABLED", raising=False)
    item = BY_ID["ionq_quantum"]
    assert provider_truth_label(item, configured=True) == MOCK_ONLY
    assert not ionq_live_enabled()


def test_live_harness_skips_without_secrets(monkeypatch):
    monkeypatch.delenv("IBM_QUANTUM_TOKEN", raising=False)
    monkeypatch.delenv("RIGETTI_API_KEY", raising=False)
    monkeypatch.delenv("IONQ_API_KEY", raising=False)
    results = {r["provider_id"]: r for r in run_live_verification()}
    assert results["ibm_quantum"].get("skipped")
    assert results["ionq_quantum"].get("skipped")
    assert not results["rigetti_quantum"].get("skipped")


def test_mqtt_disabled_without_broker(monkeypatch):
    monkeypatch.delenv("FACILITY_MQTT_BROKER", raising=False)
    assert mqtt_ingest_status()["status"] == "DISABLED"
    with pytest.raises(NotImplementedError):
        NotBuiltFacilityMqtt().connect("")


def test_circuit_breaker_and_dlq(tmp_path, monkeypatch):
    cb = tmp_path / "circuit.json"
    dlq = tmp_path / "dlq.jsonl"
    monkeypatch.setattr("app.services.circuit_breaker._PATH", str(cb))
    monkeypatch.setattr("app.services.collector_dlq._PATH", str(dlq))
    import app.services.circuit_breaker as cb_mod

    monkeypatch.setattr(cb_mod, "FAIL_THRESHOLD", 2)
    record_outcome("ibm_quantum", "ERROR")
    assert not is_open("ibm_quantum")
    record_outcome("ibm_quantum", "ERROR")
    assert is_open("ibm_quantum")
    record_failure("ibm_quantum", status="ERROR", error="timeout")
    assert len(list_failures()) == 1
