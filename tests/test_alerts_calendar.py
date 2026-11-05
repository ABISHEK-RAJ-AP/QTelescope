from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_calendar_groups_and_paginates():
    cal = (ROOT / "frontend/src/components/observability/OpsMonthCalendar.jsx").read_text(encoding="utf-8")
    alerts = (ROOT / "frontend/src/pages/AlertsEvents.jsx").read_text(encoding="utf-8")
    assert "groupCalendarEvents" in cal
    assert "MEMBER_PAGE" in cal
    assert "groupKey" in alerts
    assert "CHILD_PAGE" in alerts
    assert "ListPager" in alerts


def test_load_errors_go_to_toast_not_page_banner():
    home = (ROOT / "frontend/src/pages/DashboardHome.jsx").read_text(encoding="utf-8")
    inc = (ROOT / "frontend/src/pages/IncidentDetailPage.jsx").read_text(encoding="utf-8")
    assert "notifyError" in home
    assert "Backend unreachable" in home
    assert 'role={noData ? \'alert\' : \'status\'}' not in home
    assert "fs-banner--err" not in home
    assert "DiscussionModal" in inc
    assert "ALERT_PAGE" in inc
    assert "CollapsibleSection" in inc
