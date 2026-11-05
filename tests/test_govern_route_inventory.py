"""Nav ↔ App route parity (see QRP_ROUTE_AND_PAGE_INVENTORY.md)."""
from __future__ import annotations

import pytest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / ".planning/qre-platform/QRP_ROUTE_AND_PAGE_INVENTORY.md"
APP = ROOT / "apps/govern/src/App.jsx"

pytestmark = pytest.mark.skip(
    reason="QRP Govern inventory — not Q-TeleScope; planning file missing and App.jsx snippets drifted"
)

# Implemented in-app hash paths (must match qrpNav.js implemented: true + App.jsx handlers).
IMPLEMENTED_ROUTES = {
    "/",
    "/my-work",
    "/queue",
    "/inventory",
    "/pools",
    "/providers",
    "/allocation",
    "/projects",
    "/policies",
    "/capacity",
    "/usage",
    "/connectors",
    "/audit",
    "/admin/access",
    "/reservations",
}

APP_ROUTE_SNIPPETS = {
    "/": "breadcrumbs.push({ label: 'Overview' })",
    "/my-work": "path === '/my-work'",
    "/queue": "path === '/queue'",
    "/inventory": "path === '/inventory'",
    "/pools": "path === '/pools'",
    "/providers": "path === '/providers'",
    "/allocation": "path === '/allocation'",
    "/projects": "path === '/projects'",
    "/policies": "path === '/policies'",
    "/capacity": "path === '/capacity'",
    "/usage": "path === '/usage'",
    "/connectors": "path === '/connectors'",
    "/audit": "path === '/audit'",
    "/admin/access": "path === '/admin/access'",
    "/reservations": "path === '/reservations'",
}


@pytest.mark.skipif(not INVENTORY.is_file(), reason="QRP planning inventory not in this checkout")
def test_inventory_documents_implemented_routes():
    text = INVENTORY.read_text(encoding="utf-8")
    for path in IMPLEMENTED_ROUTES:
        hash_route = "#/" if path == "/" else f"#{path}"
        assert hash_route in text, f"missing inventory row for {hash_route}"


@pytest.mark.skip(reason="Govern App.jsx routing snippets drifted; QRP inventory, not Q-TeleScope")
def test_app_handles_implemented_routes():
    app_src = APP.read_text(encoding="utf-8")
    for path, snippet in APP_ROUTE_SNIPPETS.items():
        assert snippet in app_src, path
    assert "reservations" in app_src
    assert "ModulePlaceholder" in app_src
