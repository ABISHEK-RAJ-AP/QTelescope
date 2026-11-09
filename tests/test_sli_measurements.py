import json

import pytest

from app.services import sli_measurements as mod


def test_compute_collector_sli_empty(monkeypatch, tmp_path):
    monkeypatch.setattr(mod, "_PATH", str(tmp_path / "sli.jsonl"))
    monkeypatch.setattr(
        "app.services.collector_executions.list_executions",
        lambda **_: [],
    )
    out = mod.compute_collector_execution_sli()
    assert out["sli_id"] == mod.COLLECTOR_SLI_ID
    assert out["missing_data"] is True
    assert out["value"] is None
    assert out["compliant"] is False


def test_compute_collector_sli_ratio(monkeypatch, tmp_path):
    monkeypatch.setattr(mod, "_PATH", str(tmp_path / "sli.jsonl"))
    rows = [{"status": "OK"}, {"status": "OK"}, {"status": "FAIL"}]
    monkeypatch.setattr(
        "app.services.collector_executions.list_executions",
        lambda **_: rows,
    )
    out = mod.compute_collector_execution_sli()
    assert out["numerator"] == 2
    assert out["denominator"] == 3
    assert out["value"] == pytest.approx(0.6667, rel=1e-3)
    assert out["compliant"] is (2 / 3 >= mod.COLLECTOR_SLO_TARGET)


def test_record_and_read_latest(monkeypatch, tmp_path):
    path = tmp_path / "sli.jsonl"
    monkeypatch.setattr(mod, "_PATH", str(path))
    monkeypatch.setattr(mod, "RECORD_INTERVAL_S", 0)
    monkeypatch.setattr(
        "app.services.collector_executions.list_executions",
        lambda **_: [{"status": "OK"}],
    )
    slis = mod.latest_slis_for_ui()
    assert len(slis) == 1
    assert path.is_file()
    with open(path, encoding="utf-8") as fh:
        assert json.loads(fh.readline())["sli_id"] == mod.COLLECTOR_SLI_ID
