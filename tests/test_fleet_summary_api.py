from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_fleet_summary_endpoint_and_schema():
    fleet = (ROOT / "app/api/fleet.py").read_text(encoding="utf-8")
    schemas = (ROOT / "app/schemas/schemas.py").read_text(encoding="utf-8")
    main = (ROOT / "app/main.py").read_text(encoding="utf-8")
    assert 'prefix="/fleet"' in fleet
    assert "pending_jobs_telemetry" in schemas
    assert "queued_jobs_execution" in schemas
    assert "include_router(fleet.router" in main


def test_alerts_summary_includes_stored_field():
    alerts = (ROOT / "app/api/alerts.py").read_text(encoding="utf-8")
    schemas = (ROOT / "app/schemas/schemas.py").read_text(encoding="utf-8")
    assert "stored=stored" in alerts or "stored=stored" in alerts.replace(" ", "")
    assert "stored: int" in schemas
