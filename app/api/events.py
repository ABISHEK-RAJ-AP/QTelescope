import asyncio
import json
from datetime import datetime, timezone
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from app.core.database import SessionLocal
from app.models.entities import AlertModel, BackendTelemetryModel, JobRecordModel, QubitTelemetryModel
from app.analytics.coherence_aggregate import build_coherence_snapshot
from app.api.queues import _latest_telemetry_map
from app.services.collector_health import list_provider_health

router = APIRouter(prefix="/events", tags=["Live Telemetry Stream"])


def _tick_snapshot():
    db = SessionLocal()
    try:
        active_alerts = db.query(AlertModel).filter(AlertModel.status == "ACTIVE").count()
        queued = db.query(JobRecordModel).filter(JobRecordModel.status == "QUEUED").count()
        running = db.query(JobRecordModel).filter(JobRecordModel.status == "RUNNING").count()
        tel_map = _latest_telemetry_map(db)
        pending_telemetry = sum(
            int(r.pending_jobs)
            for r in tel_map.values()
            if r.pending_jobs is not None
        )
        coh = build_coherence_snapshot(db)
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
        latest_qubit_ts = db.query(func.max(QubitTelemetryModel.timestamp)).scalar()
        latest_backend_ts = db.query(func.max(BackendTelemetryModel.timestamp)).scalar()
        candidates = [t for t in (latest_qubit_ts, latest_backend_ts) if t is not None]
        latest_measurement_at = max(candidates) if candidates else None
        if latest_measurement_at and latest_measurement_at.tzinfo is None:
            latest_measurement_at = latest_measurement_at.replace(tzinfo=timezone.utc)
        staleness_seconds = None
        if latest_measurement_at:
            staleness_seconds = round((ui_tick_at - latest_measurement_at).total_seconds(), 1)

        collectors = list_provider_health()
        collector_ok = sum(1 for c in collectors if c.get("status") == "OK")
        return {
            "timestamp": ui_tick_at.isoformat(),
            "ui_tick_at": ui_tick_at.isoformat(),
            "latest_measurement_at": latest_measurement_at.isoformat() if latest_measurement_at else None,
            "staleness_seconds": staleness_seconds,
            "event_type": "PLATFORM_REFRESH",
            "stream_kind": "database_aggregate",
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
async def sse_telemetry_stream():
    async def event_generator():
        while True:
            data = await asyncio.to_thread(_tick_snapshot)
            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
