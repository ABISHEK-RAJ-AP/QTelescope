import os

from app.core.deployment import airgap_mode_enabled, deployment_profile


def test_airgap_env(monkeypatch):
    monkeypatch.delenv("AIRGAP_MODE", raising=False)
    monkeypatch.delenv("QTELESCOPE_AIRGAP", raising=False)
    assert airgap_mode_enabled() is False
    monkeypatch.setenv("AIRGAP_MODE", "true")
    assert airgap_mode_enabled() is True
    prof = deployment_profile()
    assert prof["profile"] == "airgap_onprem"
    assert prof["ingress_paths"]["vendor_cloud_poll"] == "DISABLED_IN_AIRGAP"
