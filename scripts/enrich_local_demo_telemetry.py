#!/usr/bin/env python3
"""Backfill mock telemetry time series for local/demo charts (bounded row budget)."""
from __future__ import annotations

import argparse
import datetime
import os
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.database import SessionLocal  # noqa: E402
from app.core.mock_data import (  # noqa: E402
    MOCK_HARDWARE_BACKENDS,
    get_mock_backend_properties,
    get_mock_backend_status,
    get_mock_jobs,
)
from sqlalchemy import func  # noqa: E402

from app.models.entities import (  # noqa: E402
    BackendModel,
    BackendTelemetryModel,
    CalibrationSnapshotModel,
    GateTelemetryModel,
    JobRecordModel,
    QubitTelemetryModel,
)
from app.normalizers.telemetry_normalizer import TelemetryNormalizer  # noqa: E402

# ponytail: O(backends × snapshots × qubits); cap snapshots via env; upgrade = lower interval or add API downsample.


def utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _template_id(backend: BackendModel) -> str:
    if backend.backend_id in MOCK_HARDWARE_BACKENDS:
        return backend.backend_id
    pid = (backend.provider_id or "").lower()
    if "ibm" in pid:
        return "ibm_brisbane"
    if "rigetti" in pid:
        return "rigetti_aspen_m3"
    if "ionq" in pid:
        return "ionq_forte"
    if "cdac" in pid:
        return "cdac_qsim_param"
    return "ibm_brisbane"


def _props_for_backend(backend_id: str, template_id: str, n_qubits: int, at: datetime.datetime) -> dict:
    random.seed(hash((backend_id, int(at.timestamp()))) % (2**31))
    props = get_mock_backend_properties(template_id)
    props["backend_id"] = backend_id
    qubits = props.get("qubits") or []
    if len(qubits) > n_qubits:
        qubits = qubits[:n_qubits]
    while len(qubits) < n_qubits:
        i = len(qubits)
        qubits.append({**qubits[-1], "qubit_index": i} if qubits else {"qubit_index": i, "t1": 50.0, "t2": 45.0})
    props["qubits"] = qubits
    gates = []
    for g in props.get("gates") or []:
        qs = g.get("qubits") or []
        if not qs or max(qs) < n_qubits:
            gates.append(g)
    props["gates"] = gates
    return props


def _snapshot_times(days: int, interval_hours: float) -> list[datetime.datetime]:
    interval = max(1.0, float(interval_hours))
    end = utcnow()
    start = end - datetime.timedelta(days=max(1, days))
    out: list[datetime.datetime] = []
    t = start
    while t <= end:
        out.append(t)
        t += datetime.timedelta(hours=interval)
    return out


def enrich(
    *,
    days: int,
    interval_hours: float,
    max_rows_per_backend: int,
    dry_run: bool,
) -> dict:
    stats = {
        "backends": 0,
        "backends_skipped": 0,
        "snapshots": 0,
        "backend_rows": 0,
        "qubit_rows": 0,
        "gate_rows": 0,
        "calibration_rows": 0,
    }
    db = SessionLocal()
    try:
        backends = db.query(BackendModel).all()
        stats["backends"] = len(backends)
        min_series = int(os.getenv("LOCAL_DEMO_ENRICH_MIN_Q0_SAMPLES", "12"))
        for backend in backends:
            q0_series = int(
                db.query(func.count(QubitTelemetryModel.id))
                .filter(
                    QubitTelemetryModel.backend_id == backend.backend_id,
                    QubitTelemetryModel.qubit_index == 0,
                )
                .scalar()
                or 0
            )
            if min_series > 0 and q0_series >= min_series:
                stats["backends_skipped"] += 1
                continue
            template = _template_id(backend)
            n_q = int(backend.qubit_count or 0) or len((get_mock_backend_properties(template).get("qubits") or []))
            times = _snapshot_times(days, interval_hours)
            if n_q * len(times) > max_rows_per_backend:
                keep = max(8, max_rows_per_backend // max(1, n_q))
                times = times[-keep:]
            stats["snapshots"] += len(times)

            if dry_run:
                continue

            for idx, at in enumerate(times):
                random.seed(int(at.timestamp()) ^ hash(backend.backend_id))
                status_raw = get_mock_backend_status(template)
                status_raw["backend_id"] = backend.backend_id
                status_raw["timestamp"] = at.isoformat()
                status_norm = TelemetryNormalizer.normalize_backend_status(
                    status_raw, provider_id=backend.provider_id or "mock", lineage="simulated"
                )
                status_norm["timestamp"] = at
                db.add(BackendTelemetryModel(**status_norm))
                stats["backend_rows"] += 1

                props = _props_for_backend(backend.backend_id, template, n_q, at)
                calib_time = at - datetime.timedelta(hours=random.uniform(0.5, 4.0))
                props["calibration_timestamp"] = calib_time.isoformat()

                for q_raw in props.get("qubits", []):
                    q_norm = TelemetryNormalizer.normalize_qubit_metric(q_raw, backend.backend_id)
                    q_norm["timestamp"] = at
                    db.add(QubitTelemetryModel(**q_norm))
                    stats["qubit_rows"] += 1

                for g_raw in props.get("gates", []):
                    g_norm = TelemetryNormalizer.normalize_gate_metric(g_raw, backend.backend_id)
                    g_norm["timestamp"] = at
                    db.add(GateTelemetryModel(**g_norm))
                    stats["gate_rows"] += 1

                if idx % 6 == 0:
                    db.add(
                        CalibrationSnapshotModel(
                            timestamp=at,
                            backend_id=backend.backend_id,
                            calibration_timestamp=calib_time,
                            calibration_identifier=f"cal_{backend.backend_id}_{at.strftime('%Y%m%d%H')}",
                            calibration_age=max(0.0, (at - calib_time).total_seconds() / 3600.0),
                            freshness_status="Recent",
                            metrics_summary={"qubits_count": n_q},
                        )
                    )
                    stats["calibration_rows"] += 1

            db.commit()

            for j_raw in get_mock_jobs(backend.backend_id, limit=20):
                job_data = {k: v for k, v in j_raw.items() if k in {
                    "job_id", "backend_id", "status", "submitted_at", "created_at", "runtime", "failure_reason", "calibration_identifier", "tags"
                }}
                for key in ("submitted_at", "created_at"):
                    val = job_data.get(key)
                    if isinstance(val, str):
                        try:
                            job_data[key] = datetime.datetime.fromisoformat(val.replace("Z", "+00:00"))
                        except Exception:
                            job_data[key] = utcnow()
                if not db.query(JobRecordModel).filter(JobRecordModel.job_id == job_data.get("job_id")).first():
                    db.add(JobRecordModel(**job_data))
            db.commit()

        try:
            from app.core.cache import invalidate_operational_cache

            invalidate_operational_cache()
        except Exception:
            pass
    finally:
        db.close()
    return stats


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--days", type=int, default=int(os.getenv("LOCAL_DEMO_HISTORY_DAYS", "14")))
    p.add_argument("--interval-hours", type=float, default=float(os.getenv("LOCAL_DEMO_HISTORY_INTERVAL_HOURS", "3")))
    p.add_argument(
        "--max-rows-per-backend",
        type=int,
        default=int(os.getenv("LOCAL_DEMO_HISTORY_QUBIT_CAP", "10000")),
    )
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    stats = enrich(
        days=args.days,
        interval_hours=args.interval_hours,
        max_rows_per_backend=args.max_rows_per_backend,
        dry_run=args.dry_run,
    )
    total_q = stats["qubit_rows"]
    print(
        f"enrich: backends={stats['backends']} skipped={stats['backends_skipped']} snapshots≈{stats['snapshots']} "
        f"backend_telemetry={stats['backend_rows']} qubit={total_q} gate={stats['gate_rows']} "
        f"calibration={stats['calibration_rows']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())