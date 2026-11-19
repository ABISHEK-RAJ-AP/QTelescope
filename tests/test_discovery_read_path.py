"""Discovery must not block catalogue reads."""
from unittest.mock import MagicMock, patch

from app.discovery.hardware_discovery import bootstrap_catalog_if_empty


def test_bootstrap_skips_when_backends_exist():
    db = MagicMock()
    db.query.return_value.first.return_value = ("ibm_brisbane",)
    with patch(
        "app.discovery.hardware_discovery.HardwareDiscoveryEngine.run_auto_discovery"
    ) as run:
        bootstrap_catalog_if_empty(db)
        run.assert_not_called()


def test_bootstrap_runs_when_inventory_empty():
    db = MagicMock()
    db.query.return_value.first.return_value = None
    with patch(
        "app.discovery.hardware_discovery.HardwareDiscoveryEngine.run_auto_discovery",
        return_value={"status": "SUCCESS"},
    ) as run:
        with patch("app.discovery.status_store.record_discovery_run"):
            bootstrap_catalog_if_empty(db)
        run.assert_called_once()