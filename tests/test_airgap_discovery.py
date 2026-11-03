from app.discovery.hardware_discovery import HardwareDiscoveryEngine


def test_probe_environment_airgap_cdac_only(monkeypatch):
    monkeypatch.setenv("AIRGAP_MODE", "true")
    rows = HardwareDiscoveryEngine.probe_environment()
    assert len(rows) == 1
    assert rows[0][0] == "cdac_quantum"
