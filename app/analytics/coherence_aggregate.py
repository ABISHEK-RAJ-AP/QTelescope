"""Per-backend and per-modality T1/T2 aggregates (no cross-modality fleet mean)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.analytics.health_vector import mean_or_none
from app.models.entities import BackendModel, QubitTelemetryModel

COMPARISON_NOTE = (
    "Compare T1/T2 only within the same qpu_modality; units are microseconds."
)


def backend_coherence_row(db: Session, b: BackendModel) -> dict:
    rows = (
        db.query(QubitTelemetryModel)
        .filter(QubitTelemetryModel.backend_id == b.backend_id)
        .order_by(QubitTelemetryModel.timestamp.desc())
        .all()
    )
    latest: dict = {}
    for row in rows:
        latest.setdefault(row.qubit_index, row)
    t1s = [r.t1 for r in latest.values() if r.t1 is not None]
    t2s = [r.t2 for r in latest.values() if r.t2 is not None]
    return {
        "backend_id": b.backend_id,
        "backend_name": b.backend_name,
        "qpu_modality": b.qpu_modality or "unknown",
        "n": len(latest),
        "t1_mean": mean_or_none(t1s),
        "t1_min": min(t1s) if t1s else None,
        "t1_max": max(t1s) if t1s else None,
        "t2_mean": mean_or_none(t2s),
        "t2_min": min(t2s) if t2s else None,
        "t2_max": max(t2s) if t2s else None,
    }


def build_coherence_snapshot(db: Session) -> dict:
    backends = db.query(BackendModel).all()
    out = [backend_coherence_row(db, b) for b in backends]
    modality_buckets: dict = {}
    for row in out:
        mod = row["qpu_modality"] or "unknown"
        modality_buckets.setdefault(mod, {"t1": [], "t2": [], "backend_ids": []})
        modality_buckets[mod]["backend_ids"].append(row["backend_id"])
        if row["t1_mean"] is not None:
            modality_buckets[mod]["t1"].append(row["t1_mean"])
        if row["t2_mean"] is not None:
            modality_buckets[mod]["t2"].append(row["t2_mean"])
    by_modality = []
    for mod, bucket in sorted(modality_buckets.items()):
        by_modality.append(
            {
                "qpu_modality": mod,
                "backend_count": len(bucket["backend_ids"]),
                "backend_ids": bucket["backend_ids"],
                "t1_mean_of_backend_means": mean_or_none(bucket["t1"]),
                "t2_mean_of_backend_means": mean_or_none(bucket["t2"]),
            }
        )
    return {
        "comparison_note": COMPARISON_NOTE,
        "by_modality": by_modality,
        "backends": out,
    }
