"""Build reproducible evidence ZIP packages with SHA-256 manifest."""
from __future__ import annotations

import hashlib
import io
import json
import os
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.analytics.health_vector import HEALTH_MODEL_VERSION
from app.core.config import settings
from app.core.provenance import database_storage_mode, platform_data_mode, MOCK_BACKEND_IDS
from app.models.entities import (
    AlertModel,
    BackendModel,
    BackendTelemetryModel,
    CalibrationSnapshotModel,
    IncidentModel,
    QubitTelemetryModel,
)
from app.services.collector_health import list_provider_health

EVIDENCE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data",
    "evidence",
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _json_bytes(obj: Any) -> bytes:
    return json.dumps(obj, indent=2, default=str).encode("utf-8")


def _in_period(ts: Optional[datetime], start: Optional[datetime], end: Optional[datetime]) -> bool:
    if ts is None:
        return start is None and end is None
    if start and ts < start:
        return False
    if end and ts > end:
        return False
    return True


def build_evidence_payload(
    db: Session,
    *,
    backend_id: Optional[str] = None,
    period_start: Optional[datetime] = None,
    period_end: Optional[datetime] = None,
    include_alerts: bool = True,
    include_incidents: bool = True,
    include_calibration: bool = True,
    include_qubit_summary: bool = True,
) -> Dict[str, Any]:
    backends_q = db.query(BackendModel)
    if backend_id:
        backends_q = backends_q.filter(BackendModel.backend_id == backend_id)
    backends = backends_q.all()
    backend_ids = [b.backend_id for b in backends]
    live_ids = [bid for bid in backend_ids if bid not in MOCK_BACKEND_IDS]

    provenance = {
        "enable_mock_data": settings.ENABLE_MOCK_DATA,
        "database_storage": database_storage_mode(settings.DATABASE_URL),
        "platform_data_mode": platform_data_mode(settings.ENABLE_MOCK_DATA, bool(live_ids)),
        "health_model_version": HEALTH_MODEL_VERSION,
        "collectors": list_provider_health(),
        "disclaimer": (
            "Package may contain simulated catalog telemetry when ENABLE_MOCK_DATA is true "
            "or when vendor credentials are absent. Check telemetry_source on telemetry rows."
        ),
    }

    backend_rows = [
        {
            "backend_id": b.backend_id,
            "backend_name": b.backend_name,
            "provider_id": b.provider_id,
            "qpu_modality": b.qpu_modality,
            "operational_status": b.operational_status,
            "qubit_count": b.qubit_count,
            "is_demo_catalog_id": b.backend_id in MOCK_BACKEND_IDS,
        }
        for b in backends
    ]

    alerts: List[dict] = []
    if include_alerts:
        for a in db.query(AlertModel).all():
            if backend_id and backend_id not in (a.resource_id or ""):
                if not (a.resource_id or "").startswith(backend_id):
                    continue
            if not _in_period(a.detected_at, period_start, period_end):
                continue
            alerts.append(
                {
                    "alert_id": a.alert_id,
                    "resource_type": a.resource_type,
                    "resource_id": a.resource_id,
                    "alert_type": a.alert_type,
                    "severity": a.severity,
                    "status": a.status,
                    "message": a.message,
                    "detected_at": a.detected_at.isoformat() if a.detected_at else None,
                }
            )

    incidents: List[dict] = []
    if include_incidents:
        for inc in db.query(IncidentModel).all():
            if backend_id and inc.backend_id != backend_id:
                continue
            if not _in_period(inc.last_detected_at, period_start, period_end):
                continue
            incidents.append(
                {
                    "incident_id": inc.incident_id,
                    "title": inc.title,
                    "backend_id": inc.backend_id,
                    "severity": inc.severity,
                    "status": inc.status,
                    "first_detected_at": inc.first_detected_at.isoformat() if inc.first_detected_at else None,
                    "last_detected_at": inc.last_detected_at.isoformat() if inc.last_detected_at else None,
                }
            )

    calibrations: List[dict] = []
    if include_calibration:
        for s in db.query(CalibrationSnapshotModel).all():
            if backend_id and s.backend_id != backend_id:
                continue
            if not _in_period(s.timestamp, period_start, period_end):
                continue
            calibrations.append(
                {
                    "backend_id": s.backend_id,
                    "calibration_identifier": s.calibration_identifier,
                    "calibration_timestamp": s.calibration_timestamp.isoformat() if s.calibration_timestamp else None,
                    "freshness_status": s.freshness_status,
                    "calibration_age_hours": s.calibration_age,
                    "recorded_at": s.timestamp.isoformat() if s.timestamp else None,
                }
            )

    qubit_summary: List[dict] = []
    if include_qubit_summary:
        for bid in backend_ids:
            latest_ts = (
                db.query(QubitTelemetryModel.timestamp)
                .filter(QubitTelemetryModel.backend_id == bid)
                .order_by(QubitTelemetryModel.timestamp.desc())
                .first()
            )
            if not latest_ts:
                continue
            ts = latest_ts[0]
            rows = (
                db.query(QubitTelemetryModel)
                .filter(QubitTelemetryModel.backend_id == bid, QubitTelemetryModel.timestamp == ts)
                .all()
            )
            t1s = [r.t1 for r in rows if r.t1 is not None]
            if not t1s:
                continue
            qubit_summary.append(
                {
                    "backend_id": bid,
                    "measurement_at": ts.isoformat() if ts else None,
                    "qubit_samples": len(rows),
                    "t1_mean_us": sum(t1s) / len(t1s),
                    "t1_min_us": min(t1s),
                    "t1_max_us": max(t1s),
                }
            )

    queue_samples: List[dict] = []
    for bid in backend_ids:
        telem = (
            db.query(BackendTelemetryModel)
            .filter(BackendTelemetryModel.backend_id == bid)
            .order_by(BackendTelemetryModel.timestamp.desc())
            .limit(50)
            .all()
        )
        for t in telem:
            if not _in_period(t.timestamp, period_start, period_end):
                continue
            queue_samples.append(
                {
                    "backend_id": bid,
                    "timestamp": t.timestamp.isoformat() if t.timestamp else None,
                    "pending_jobs": t.pending_jobs,
                    "estimated_wait_time_s": t.estimated_wait_time,
                    "telemetry_source": t.telemetry_source,
                    "data_quality": t.data_quality,
                }
            )

    return {
        "provenance": provenance,
        "scope": {
            "backend_id": backend_id,
            "period_start": period_start.isoformat() if period_start else None,
            "period_end": period_end.isoformat() if period_end else None,
        },
        "backends": backend_rows,
        "alerts": alerts,
        "incidents": incidents,
        "calibrations": calibrations,
        "qubit_summary": qubit_summary,
        "queue_telemetry_samples": queue_samples,
        "data_quality_notes": {
            "collection_gaps": "Not computed in v1 — inspect queue_telemetry_samples density.",
            "simulated_backends": [b["backend_id"] for b in backend_rows if b["is_demo_catalog_id"]],
        },
    }


def package_evidence_zip(snapshot_id: str, payload: Dict[str, Any]) -> Tuple[bytes, Dict[str, Any]]:
    files = {
        "provenance.json": _json_bytes(payload["provenance"]),
        "scope.json": _json_bytes(payload["scope"]),
        "backends.json": _json_bytes(payload["backends"]),
        "alerts.json": _json_bytes(payload["alerts"]),
        "incidents.json": _json_bytes(payload["incidents"]),
        "calibrations.json": _json_bytes(payload["calibrations"]),
        "qubit_summary.json": _json_bytes(payload["qubit_summary"]),
        "queue_telemetry.json": _json_bytes(payload["queue_telemetry_samples"]),
        "data_quality.json": _json_bytes(payload["data_quality_notes"]),
        "README.txt": (
            "Q-TeleScope evidence snapshot. Verify manifest.json SHA-256 entries before trusting contents.\n"
        ).encode("utf-8"),
    }
    file_hashes = {name: _sha256(content) for name, content in files.items()}

    manifest = {
        "snapshot_id": snapshot_id,
        "generated_at": _utcnow().isoformat(),
        "platform_version": settings.VERSION,
        "files": file_hashes,
    }
    manifest_bytes = _json_bytes(manifest)
    manifest["manifest_sha256"] = _sha256(manifest_bytes)
    manifest_bytes = _json_bytes(manifest)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in files.items():
            zf.writestr(name, content)
        zf.writestr("manifest.json", manifest_bytes)

    zip_bytes = buf.getvalue()
    manifest["package_sha256"] = _sha256(zip_bytes)
    return zip_bytes, manifest


def write_evidence_archive(snapshot_id: str, zip_bytes: bytes) -> str:
    os.makedirs(EVIDENCE_DIR, exist_ok=True)
    path = os.path.join(EVIDENCE_DIR, f"{snapshot_id}.zip")
    with open(path, "wb") as f:
        f.write(zip_bytes)
    return path


def new_snapshot_id() -> str:
    return f"ev_{uuid.uuid4().hex[:12]}"
