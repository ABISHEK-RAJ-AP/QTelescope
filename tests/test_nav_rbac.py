from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PERM = (ROOT / "frontend/src/lib/permissions.js").read_text(encoding="utf-8")


def test_nav_helpers_exist():
    assert "canSeeNavItem" in PERM
    assert "visibleAdminNav" in PERM
    assert "landingPathForRole" in PERM


def test_lazy_chunk_reload():
    lazy = (ROOT / "frontend/src/appLazyPages.js").read_text(encoding="utf-8")
    assert "qts_chunk_reload" in lazy
    nginx = (ROOT / "deployment/nginx-host.conf").read_text(encoding="utf-8")
    assert "no-store" in nginx
    assert "location = /index.html" in nginx
