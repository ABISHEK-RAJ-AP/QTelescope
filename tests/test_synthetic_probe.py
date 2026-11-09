from app.services.synthetic_probe import run_lab_probes


def test_database_probe_ok():
    probes = run_lab_probes()
    assert len(probes) == 1
    assert probes[0]["probe_id"] == "database_select1"
    assert probes[0]["status"] == "OK"
    assert probes[0]["latency_ms"] >= 0
