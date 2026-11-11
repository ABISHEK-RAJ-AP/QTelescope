#!/usr/bin/env python3
"""Refresh mock demo fleet: purge migration junk, resolve orphan alerts, re-collect telemetry."""
from __future__ import annotations

import argparse
import datetime
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.core.provenance import MOCK_BACKEND_IDS  # noqa: E402
from app.discovery.hardware_discovery import HardwareDiscoveryEngine  # noqa: E402
from app.models.entities import AlertModel, BackendModel, BackendTelemetryModel, ProviderModel  # noqa: E402
from app.services.backend_purge import purge_backend  # noqa: E402
from app.services.alert_dedupe import dedupe_open_alerts  # noqa: E402
from app.services.incident_service import backend_id_from_alert  # noqa: E402

JUNK_BACKEND_IDS = frozenset({"b1", "b2", "test_backend"})


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _resolve_orphan_alerts(db) -> int:
    valid = {r[0] for r in db.query(BackendModel.backend_id).all()}
    n = 0
    now = _utcnow()
    for a in db.query(AlertModel).filter(AlertModel.status.in_(["ACTIVE", "ACKNOWLEDGED"])).all():
        bid = backend_id_from_alert(a)
        if bid and bid not in valid:
            a.status = "RESOLVED"
            a.resolved_at = now
            n += 1
    return n


def _latest_telemetry_age_hours(db) -> float | None:
    row = db.query(BackendTelemetryModel).order_by(BackendTelemetryModel.timestamp.desc()).first()
    if not row or not row.timestamp:
        return None
    ts = row.timestamp
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=datetime.timezone.utc)
    return (_utcnow() - ts).total_seconds() / 3600.0


def refresh(*, force: bool, if_stale_hours: float) -> dict:
    if not settings.ENABLE_MOCK_DATA:
        print("ENABLE_MOCK_DATA is false — skip demo fleet refresh (live mode).", file=sys.stderr)
        return {"skipped": True, "reason": "mock_disabled"}

    db = SessionLocal()
    try:
        age = _latest_telemetry_age_hours(db)
        if not force and age is not None and age < if_stale_hours:
            print(f"Telemetry fresh ({age:.1f}h < {if_stale_hours}h) — skip (use --force to refresh).")
            return {"skipped": True, "telemetry_age_hours": age}

        removed = []
        purge_ids = set(JUNK_BACKEND_IDS)
        if settings.ENABLE_MOCK_DATA:
            for row in db.query(BackendModel).all():
                if row.backend_id not in MOCK_BACKEND_IDS:
                    purge_ids.add(row.backend_id)
        for bid in purge_ids:
            if db.query(BackendModel).filter(BackendModel.backend_id == bid).first():
                purge_backend(db, bid)
                removed.append(bid)

        orphans = _resolve_orphan_alerts(db)
        deduped = dedupe_open_alerts(db)
        for prov in db.query(ProviderModel).all():
            if not db.query(BackendModel).filter(BackendModel.provider_id == prov.provider_id).first():
                db.delete(prov)
        db.commit()

        print(f"Purged backends: {removed or 'none'}; resolved orphan alerts: {orphans}; deduped open alerts: {deduped}")
        result = HardwareDiscoveryEngine.run_auto_discovery(db)
        db.commit()

        backends = [b.backend_id for b in db.query(BackendModel).all()]
        print(f"Fleet after refresh ({len(backends)}): {', '.join(sorted(backends))}")
        print(f"Discovery: {result.get('total_backends_discovered', 0)} backends touched across providers")
        return {"skipped": False, "backends": backends, "discovery": result}
    finally:
        db.close()


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--force", action="store_true", help="Always run full collection cycle")
    p.add_argument(
        "--if-stale",
        type=float,
        default=4.0,
        metavar="HOURS",
        help="Refresh when latest backend telemetry is older than this (default 4)",
    )
    args = p.parse_args()
    out = refresh(force=args.force, if_stale_hours=args.if_stale)
    if not out.get("skipped"):
        have = set(out.get("backends") or [])
        missing = MOCK_BACKEND_IDS - have
        if missing:
            print(f"Warning: mock catalog backends still missing: {sorted(missing)}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
