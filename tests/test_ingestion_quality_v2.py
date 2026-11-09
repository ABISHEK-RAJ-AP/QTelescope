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
