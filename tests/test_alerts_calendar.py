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
