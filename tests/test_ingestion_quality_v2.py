import json

from app.services.ingestion_quality import record_quality, list_quality


def test_quality_v2_records_measured_rows(monkeypatch, tmp_path):
    monkeypatch.setattr("app.services.ingestion_quality._PATH", str(tmp_path / "iq.jsonl"))
    record_quality(
        "ibm_quantum",
        status="OK",
        backends_detected=2,
        duration_ms=10,
        collection_stats={
            "backends_processed": 2,
            "backend_telemetry_rows": 2,
            "calibration_snapshots": 2,
        },
    )
    rows = list_quality(limit=5)
    assert rows[0]["schema_version"] == 2
    assert rows[0]["quality_outcome"] == "OK"
    assert rows[0]["backend_telemetry_rows"] == 2
    assert rows[0]["rejected_records"] is None


def test_quality_retention_trim(monkeypatch, tmp_path):
    path = tmp_path / "iq.jsonl"
    monkeypatch.setattr("app.services.ingestion_quality._PATH", str(path))
    monkeypatch.setattr("app.services.ingestion_quality._RETENTION_DAYS", 30)
    old = {"report_id": "old", "timestamp": "2020-01-01T00:00:00+00:00", "provider_id": "p", "status": "OK"}
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(old) + "\n")
    record_quality("p", status="OK", backends_detected=1, duration_ms=1.0)
    rows = list_quality(limit=10)
    assert len(rows) == 1
    assert rows[0]["report_id"] != "old"
