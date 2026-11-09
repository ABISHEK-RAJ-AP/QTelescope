"""Collector execution history + ingestion quality snapshots."""
import json

from app.services.collector_executions import append_execution, list_executions
from app.services.collector_health import record_provider_run
from app.services.ingestion_quality import list_quality


def test_execution_history_appended(monkeypatch, tmp_path):
    path = tmp_path / "cex.jsonl"
    monkeypatch.setattr("app.services.collector_executions._PATH", str(path))
    append_execution("ibm_quantum", status="OK", duration_ms=12.5, backends_detected=2)
    append_execution("ionq_quantum", status="ERROR", duration_ms=3.0, error="timeout")
    rows = list_executions(limit=10)
    assert len(rows) == 2
    assert rows[0]["provider_id"] == "ionq_quantum"
    assert rows[1]["status"] == "OK"


def test_record_provider_run_writes_history(monkeypatch, tmp_path):
    monkeypatch.setenv("COLLECTOR_HEALTH_PATH", str(tmp_path / "health.json"))
    monkeypatch.setattr("app.services.collector_executions._PATH", str(tmp_path / "cex.jsonl"))
    monkeypatch.setattr("app.services.ingestion_quality._PATH", str(tmp_path / "iq.jsonl"))
    record_provider_run("rigetti_quantum", status="OK", duration_ms=50, backends_detected=1, lineage="live")
    assert len(list_executions()) == 1
    qual = list_quality()
    assert qual[0]["completeness_pct"] == 100.0
