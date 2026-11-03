from app.analytics.coherence_aggregate import COMPARISON_NOTE, build_coherence_snapshot
from app.core.database import SessionLocal


def test_comparison_note_warns_modality():
    assert "qpu_modality" in COMPARISON_NOTE


def test_build_coherence_snapshot_shape():
    db = SessionLocal()
    try:
        snap = build_coherence_snapshot(db)
        assert isinstance(snap["by_modality"], list)
        assert isinstance(snap["backends"], list)
    finally:
        db.close()
