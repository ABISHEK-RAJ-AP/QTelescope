from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_dashboard_uses_alerts_summary_field_names():
    home = (ROOT / "frontend/src/pages/DashboardHome.jsx").read_text(encoding="utf-8")
    assert "active_count" not in home
    assert "critical_count" not in home
    assert "alertSummary?.active" in home
    assert "alertSummary?.critical" in home


def test_inventory_shows_full_registry_not_provider_filter():
    inv = (ROOT / "frontend/src/pages/BackendInventory.jsx").read_text(encoding="utf-8")
    assert "KNOWN_PROVIDER_IDS.has(r.providerId)" not in inv or "unlisted" in inv
    assert "displayRows = rows" in inv
    assert "MetricCard" in inv
    assert "BackendPreviewDrawer" in inv


def test_alerts_list_uses_drawer_not_immediate_full_page():
    app = (ROOT / "frontend/src/App.jsx").read_text(encoding="utf-8")
    alerts = (ROOT / "frontend/src/pages/AlertsEvents.jsx").read_text(encoding="utf-8")
    assert "onOpenAlertWorkspace" in app
    assert "onOpenAlertWorkspace" in alerts
    assert "setDrawerId(id)" in alerts
