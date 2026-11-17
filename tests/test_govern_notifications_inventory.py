"""Govern notification stack — file and App wiring (QTS parity + server sync)."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GOVERN = ROOT / "apps/govern/src"


def test_govern_notification_modules_present():
    required = [
        GOVERN / "lib/governNotices.js",
        GOVERN / "lib/governServerFeed.js",
        GOVERN / "lib/notificationPanel.js",
        GOVERN / "components/NotificationHost.jsx",
        GOVERN / "components/NotificationBell.jsx",
        GOVERN / "components/GovernNotificationSync.jsx",
        GOVERN / "components/ui/notify-item.jsx",
    ]
    missing = [str(p.relative_to(ROOT)) for p in required if not p.is_file()]
    assert not missing, f"missing: {missing}"


def test_app_wires_notification_sync_and_host():
    app = (GOVERN / "App.jsx").read_text(encoding="utf-8")
    assert "NotificationHost" in app
    assert "GovernNotificationSync" in app
    assert "NotificationBell" in app
    assert "govern:data-refresh" in app


def test_toast_persists_to_govern_notices():
    toast = (GOVERN / "lib/toast.js").read_text(encoding="utf-8")
    notices = (GOVERN / "lib/governNotices.js").read_text(encoding="utf-8")
    assert "upsertGovernNotice" in toast
    assert "GOVERN_NOTICES_EVENT" in notices
    assert "localStorage" in notices


def test_server_feed_uses_governance_apis():
    feed = (GOVERN / "lib/governServerFeed.js").read_text(encoding="utf-8")
    assert "governance/summary" in feed or "governanceSummaryPath" in feed
    assert "approvalsListPath" in feed
    assert "govern:server:queue" in feed