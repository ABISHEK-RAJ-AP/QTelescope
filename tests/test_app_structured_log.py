"""Structured app logs + redaction."""
from app.core.app_structured_log import emit_app_log, search_app_logs


def test_emit_and_search_by_request_id(monkeypatch, tmp_path):
    monkeypatch.setattr("app.core.app_structured_log._PATH", str(tmp_path / "app.jsonl"))
    emit_app_log(
        severity="INFO",
        service="qtelescope",
        component="collector",
        message="run ok",
        event_code="collector.run_finished",
        provider_id="ibm_quantum",
        context={"api_token": "secret-value-should-redact"},
    )
    rows = search_app_logs(limit=10, provider_id="ibm_quantum")
    assert len(rows) == 1
    assert rows[0]["context"].get("api_token") == "[redacted]"


def test_execution_list_since_filter(monkeypatch, tmp_path):
    from app.services.collector_executions import append_execution, list_executions

    path = tmp_path / "cex.jsonl"
    monkeypatch.setattr("app.services.collector_executions._PATH", str(path))
    append_execution("ibm_quantum", status="OK", duration_ms=1, trigger_type="manual")
    rows = list_executions(limit=10, since="2099-01-01T00:00:00+00:00")
    assert rows == []
    rows2 = list_executions(limit=10, since="2020-01-01T00:00:00+00:00")
    assert len(rows2) == 1
    assert rows2[0]["trigger_type"] == "manual"
