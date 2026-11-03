import json

from app.facility import env_store
from app.facility.ingest import append_records, ingest_status, scan_inbox


def test_append_and_status(tmp_path, monkeypatch):
    path = tmp_path / "env.json"
    monkeypatch.setattr(env_store, "ENV_PATH", str(path))
    added, errors = append_records(
        [
            {
                "backend_id": "ibm_brisbane",
                "channel": "cryo_temp_mK",
                "value": 15.0,
                "unit": "mK",
            }
        ],
        source="test",
    )
    assert added == 1
    assert not errors
    st = ingest_status()
    assert st["rest_ingest"] == "LIVE"
    assert st["mqtt_subscriber"] == "DISABLED"
    assert st["vendor_cryo_rf_adapter"] == "LIVE"


def test_inbox_scan(tmp_path, monkeypatch):
    env_path = tmp_path / "env.json"
    inbox = tmp_path / "inbox"
    inbox.mkdir()
    monkeypatch.setattr(env_store, "ENV_PATH", str(env_path))
    monkeypatch.setattr(env_store, "FACILITY_INBOX", str(inbox))
    payload = {
        "records": [
            {"backend_id": "ibm_brisbane", "channel": "vacuum_mbar", "value": 1e-9, "unit": "mbar"},
        ]
    }
    (inbox / "batch1.json").write_text(json.dumps(payload), encoding="utf-8")
    out = scan_inbox()
    assert out["files_processed"] == 1
    assert out["records_added"] == 1
