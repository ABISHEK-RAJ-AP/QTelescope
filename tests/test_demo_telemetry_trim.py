from app.jobs.demo_telemetry_trim import demo_trim_policy, run_demo_telemetry_trim
from app.core.database import Base, SessionLocal, engine
import app.models.entities  # noqa: F401


def test_demo_trim_policy_bounds():
    p = demo_trim_policy()
    assert 3 <= p["retention_days"] <= 90
    assert p["max_rows_per_backend"] >= 200


def test_run_demo_trim_empty_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        out = run_demo_telemetry_trim(db)
        assert out["total_telemetry_after"] == 0
        assert "counts_before" in out
    finally:
        db.close()