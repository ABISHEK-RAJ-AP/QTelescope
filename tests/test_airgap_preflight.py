import os
import stat
from pathlib import Path

from app.core.deployment import airgap_mode_enabled, deployment_profile


ROOT = Path(__file__).resolve().parents[1]


def test_compose_and_preflight_assets_exist():
    assert (ROOT / "docker-compose.yml").is_file()
    assert (ROOT / "docker-compose.airgap.yml").is_file()
    preflight = ROOT / "deployment/airgap/preflight.sh"
    assert preflight.is_file()
    mode = preflight.stat().st_mode
    assert mode & stat.S_IXUSR


def test_deployment_profile_shape():
    p = deployment_profile()
    assert p["profile"] in ("connected", "airgap_onprem")
    assert "ingress_paths" in p
    assert p["ingress_paths"]["federation_snapshot"] == "LIVE"


def test_airgap_mode_env(monkeypatch):
    monkeypatch.setenv("AIRGAP_MODE", "true")
    assert airgap_mode_enabled()
    p = deployment_profile()
    assert p["airgap_mode"] is True
    assert p["outbound_vendor_apis"] == "POLICY_BLOCKED"
