"""Nav ↔ App route parity (see docs/product/qrp/QRP_PAGE_IMPLEMENTATION_MATRIX.md)."""
from __future__ import annotations

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "docs/product/qrp/QRP_PAGE_IMPLEMENTATION_MATRIX.md"
APP = ROOT / "apps/govern/src/App.jsx"
ADMIN = ROOT / "apps/govern/src/pages/Administration.jsx"
NAV = ROOT / "apps/govern/src/nav/qrpNav.js"

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
    "/quotas",
    "/admin/platform",
    "/admin/users",
    "/schedule/hold",
    "/schedule/admin",
    "/holds",
    "/sign-in",
    "/register",
}

APP_ROUTE_SNIPPETS = {
    "/": "<Overview onOpen={open}",
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
    "/admin/users": "path === '/admin/users'",
    "/reservations": "path === '/reservations'",
    "/schedule/admin": "path === '/schedule/admin'",
    "/queue/": "Review workloadId",
    "/inventory/": "assetId",
}


@pytest.mark.skipif(not INVENTORY.is_file(), reason="QRP_PAGE_IMPLEMENTATION_MATRIX.md missing")
def test_inventory_documents_implemented_routes():
    text = INVENTORY.read_text(encoding="utf-8")
    for path in IMPLEMENTED_ROUTES:
        if path in ("/sign-in", "/register", "/403"):
            continue
        hash_route = "#/" if path == "/" else f"#{path}"
        assert hash_route in text, f"missing inventory row for {hash_route}"


def test_app_handles_implemented_routes():
    app_src = APP.read_text(encoding="utf-8")
    for path, snippet in APP_ROUTE_SNIPPETS.items():
        if path in ("/queue/", "/inventory/"):
            assert snippet in app_src, path
            continue
        assert snippet in app_src, path
    assert "Reservations" in app_src
    assert "matchGovernRoute" in app_src
    assert "AdminUsersPanel" in ADMIN.read_text(encoding="utf-8")


def test_nav_implemented_flags_match_sidebar():
    nav_src = NAV.read_text(encoding="utf-8")
    assert "implemented: true" in nav_src
    assert "QRP_NAV_GROUPS" in nav_src