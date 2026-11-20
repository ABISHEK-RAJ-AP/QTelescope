import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, func, or_
from app.core.database import SessionLocal
from app.models.entities import AlertModel, BackendTelemetryModel, JobRecordModel, QubitTelemetryModel
from app.analytics.coherence_aggregate import build_coherence_snapshot
from app.api.queues import _latest_telemetry_map
from app.services.collector_health import list_provider_health

router = APIRouter(prefix="/events", tags=["Live Telemetry Stream"])


def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _measurement_staleness(ui_tick_at: datetime, latest_measurement_at: Optional[datetime]) -> tuple[Optional[float], bool]:
    """Seconds since latest stored telemetry; clamp negative deltas (clock skew)."""
    if not latest_measurement_at:
        return None, False
    latest = _as_utc(latest_measurement_at)
    delta = round((ui_tick_at - latest).total_seconds(), 1)
    if delta < 0:
        return 0.0, True
    return delta, False


def _active_alerts_query(db, backend_id: Optional[str]):
    q = db.query(AlertModel).filter(AlertModel.status == "ACTIVE")
    if not backend_id:
        return q
    bid = backend_id.strip()
    return q.filter(
        or_(
            and_(AlertModel.resource_type == "BACKEND", AlertModel.resource_id == bid),
            AlertModel.resource_id.like(f"{bid}_%"),
        )
    )


def _latest_measurement_at(db, backend_id: Optional[str]) -> Optional[datetime]:
    q_qubit = db.query(func.max(QubitTelemetryModel.timestamp))
    q_backend = db.query(func.max(BackendTelemetryModel.timestamp))
    if backend_id:
        bid = backend_id.strip()
        q_qubit = q_qubit.filter(QubitTelemetryModel.backend_id == bid)
        q_backend = q_backend.filter(BackendTelemetryModel.backend_id == bid)
    latest_qubit_ts = q_qubit.scalar()
    latest_backend_ts = q_backend.scalar()
    candidates = [t for t in (latest_qubit_ts, latest_backend_ts) if t is not None]
    return max(candidates) if candidates else None


def _tick_snapshot(backend_id: Optional[str] = None):
    db = SessionLocal()
    scope = (backend_id or "").strip() or None
    try:
        active_alerts = _active_alerts_query(db, scope).count()
        job_q = db.query(JobRecordModel)
        if scope:
            job_q = job_q.filter(JobRecordModel.backend_id == scope)
        queued = job_q.filter(JobRecordModel.status == "QUEUED").count()
        running = job_q.filter(JobRecordModel.status == "RUNNING").count()

        tel_map = _latest_telemetry_map(db)
        if scope:
            row = tel_map.get(scope)
            pending_telemetry = int(row.pending_jobs) if row and row.pending_jobs is not None else 0
        else:
            pending_telemetry = sum(
                int(r.pending_jobs)
                for r in tel_map.values()
                if r.pending_jobs is not None
            )

        coh = build_coherence_snapshot(db)
        if scope:
            row = next((r for r in (coh.get("backends") or []) if r.get("backend_id") == scope), None)
            if row and row.get("t1_mean") is not None:
                t1_by_modality = [
                    {
                        "qpu_modality": row.get("qpu_modality") or "unknown",
                        "backend_count": 1,
                        "backend_id": scope,
                        "t1_mean_us": round(float(row["t1_mean"]), 2),
                    }
                ]
            else:
                t1_by_modality = []
        else:
            t1_by_modality = [
                {
                    "qpu_modality": m["qpu_modality"],
                    "backend_count": m["backend_count"],
                    "t1_mean_us": round(float(m["t1_mean_of_backend_means"]), 2)
                    if m.get("t1_mean_of_backend_means") is not None
                    else None,
                }
                for m in coh.get("by_modality") or []
            ]

        ui_tick_at = datetime.now(timezone.utc)
        latest_measurement_at = _latest_measurement_at(db, scope)
        staleness_seconds, measurement_clock_skew = _measurement_staleness(ui_tick_at, latest_measurement_at)
        latest_iso = _as_utc(latest_measurement_at).isoformat() if latest_measurement_at else None

        collectors = list_provider_health()
        collector_ok = sum(1 for c in collectors if c.get("status") == "OK")
        return {
            "timestamp": ui_tick_at.isoformat(),
            "ui_tick_at": ui_tick_at.isoformat(),
            "latest_measurement_at": latest_iso,
            "staleness_seconds": staleness_seconds,
            "measurement_clock_skew": measurement_clock_skew,
            "scope_backend_id": scope,
            "event_type": "PLATFORM_REFRESH",
            "stream_kind": "database_aggregate_scoped" if scope else "database_aggregate",
            "status": "ONLINE",
            "active_alerts": int(active_alerts),
            "queued_jobs": int(queued),
            "running_jobs": int(running),
            "pending_jobs": int(pending_telemetry),
            "pending_jobs_telemetry": int(pending_telemetry),
            "queued_jobs_records": int(queued),
            "t1_by_modality": t1_by_modality,
            "coherence_note": coh.get("comparison_note"),
            "collectors_ok": collector_ok,
            "collectors_total": len(collectors),
            "message": "Platform refresh — see latest_measurement_at for measurement freshness",
        }
    finally:
        db.close()


@router.get("/stream")
async def sse_telemetry_stream(
    backend_id: Optional[str] = Query(None, description="Limit aggregates to one backend"),
):
    scope = (backend_id or "").strip() or None

    async def event_generator():
        while True:
            data = await asyncio.to_thread(_tick_snapshot, scope)
            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")