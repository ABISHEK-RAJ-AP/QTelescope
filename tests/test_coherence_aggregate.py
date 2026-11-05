from app.analytics.coherence_aggregate import COMPARISON_NOTE, build_coherence_snapshot
from app.core.database import Base, SessionLocal, engine
import app.models.entities  # noqa: F401


def test_comparison_note_warns_modality():
    assert "qpu_modality" in COMPARISON_NOTE


def test_build_coherence_snapshot_shape():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        snap = build_coherence_snapshot(db)
        assert isinstance(snap["by_modality"], list)
        assert isinstance(snap["backends"], list)
    finally:
        db.close()
