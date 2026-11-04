"""Device capability mapper — pure unit checks (no DB)."""

from app.integrations.device_capabilities.mapper import (
    map_backend_to_device_sheet,
    map_job_status,
    map_operational_status,
)
from app.integrations.device_capabilities.vocabulary import DEVICE_STATUS, JOB_STATUS


def test_status_online_idle_busy():
    assert map_operational_status("ONLINE", 0) == "IDLE"
    assert map_operational_status("ONLINE", 3) == "BUSY"
    assert map_operational_status("OFFLINE", 9) == "OFFLINE"
    assert map_operational_status("MAINTENANCE", 0) == "MAINTENANCE"
    assert map_operational_status("ONLINE", 0, "CALIBRATING") == "CALIBRATION"
    assert DEVICE_STATUS[map_operational_status("ONLINE", 1)] == 2


def test_job_status_spellings():
    assert map_job_status("COMPLETED") == "DONE"
    assert map_job_status("CANCELLED") == "CANCELED"
    assert map_job_status("QUEUED") == "QUEUED"
    assert JOB_STATUS[map_job_status("FAILED")] == 6


def test_device_snapshot_shape():
    doc = map_backend_to_device_sheet(
        backend_id="ibm_brisbane",
        backend_name="ibm_brisbane",
        configuration_version="1.2.3",
        qubit_count=2,
        operational_status="ONLINE",
        pending_jobs=5,
        coupling_edges=[{"source_qubit": 0, "target_qubit": 1}],
        qubit_telemetry=[
            {"qubit_index": 1, "t1": 80.0, "t2": 40.0},
            {"qubit_index": 0, "t1": 100.0, "t2": 50.0},
        ],
        gate_telemetry=[
            {
                "gate_name": "cx",
                "qubits": [0, 1],
                "gate_error": 0.01,
                "gate_duration": 300.0,
            }
        ],
        recent_jobs=[{"job_id": "j1", "status": "RUNNING"}],
    )
    d = doc["device"]
    assert d["status"] == "BUSY"
    assert d["status_code"] == DEVICE_STATUS["BUSY"]
    assert d["queue_depth"] == 5
    assert d["qubit_count"] == 2
    assert d["coupling_map"] == [[0, 1]]
    assert d["duration_unit"] == "us"
    assert d["qubits"][0]["index"] == 0
    assert d["qubits"][0]["t1_us"] == 100.0
    assert d["gates"][0]["name"] == "cx"
    assert abs(d["gates"][0]["fidelity"] - 0.99) < 1e-9
    assert abs(d["gates"][0]["duration_us"] - 0.3) < 1e-9
    assert doc["recent_jobs"][0]["status"] == "RUNNING"
    assert "qdmi" not in doc
    assert "MQSS" not in str(doc)
