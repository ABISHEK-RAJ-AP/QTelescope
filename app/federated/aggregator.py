"""Build local + peer federated aggregates — no invented cross-site telemetry."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.discovery.hardware_discovery import ensure_discovered
from app.federated import registry as fed_registry
from app.federated.registry import load_registry
from app.models.entities import AlertModel, BackendModel, IncidentModel

DISCLAIMER = (
    "National totals sum site-level aggregates. Peer sites use imported snapshots or "
    "optional aggregate_url pulls — not a live quantum mesh. Do not rank T1 across modalities."
)


def _backends_by_modality(backends: List[BackendModel]) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for b in backends:
        mod = b.qpu_modality or "unknown"
        out[mod] = out.get(mod, 0) + 1
    return out


def build_local_site_aggregate(db: Session) -> Dict[str, Any]:
    ensure_discovered(db)
    reg = load_registry()
    backends = db.query(BackendModel).all()
    online = sum(1 for b in backends if b.operational_status == "ONLINE")
    offline = sum(1 for b in backends if b.operational_status == "OFFLINE")
    other = len(backends) - online - offline
    providers = sorted({b.provider_id for b in backends if b.provider_id})
    open_incidents = (
        db.query(IncidentModel)
        .filter(IncidentModel.status.in_(["OPEN", "ACKNOWLEDGED", "INVESTIGATING"]))
        .count()
    )
    active_alerts = db.query(AlertModel).filter(AlertModel.status == "ACTIVE").count()
    return {
        "site_id": reg.get("local_site_id", "local"),
        "site_name": reg.get("local_site_name", "Local site"),
        "role": "local",
        "telemetry_source": "live_db",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "fleet": {
            "total": len(backends),
            "online": online,
            "offline": offline,
            "maintenance_or_other": other,
        },
        "backends_by_modality": _backends_by_modality(backends),
        "providers_active": providers,
        "operations": {"active_alerts": active_alerts, "open_incidents": open_incidents},
        "backend_ids": [b.backend_id for b in backends],
    }


def _load_snapshot_file(name: str) -> Optional[Dict[str, Any]]:
    path = os.path.join(fed_registry.SNAPSHOT_DIR, name)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def _fetch_peer_url(url: str, timeout: int = 8) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
        data = json.loads(raw)
        if isinstance(data, dict) and "fleet" in data:
            return data, None
        if isinstance(data, dict) and data.get("local_site"):
            return data["local_site"], None
        return None, "unexpected JSON shape"
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        return None, str(exc)


def resolve_peer_aggregate(peer: Dict[str, Any]) -> Dict[str, Any]:
    site_id = peer.get("site_id", "unknown")
    base = {
        "site_id": site_id,
        "site_name": peer.get("site_name", site_id),
        "role": "peer",
        "sync_status": "MISSING",
        "sync_error": None,
    }
    url = peer.get("aggregate_url")
    if url:
        payload, err = _fetch_peer_url(url)
        if payload:
            merged = {**base, **payload, "telemetry_source": payload.get("telemetry_source", "peer_url")}
            merged["sync_status"] = "OK"
            merged["role"] = "peer"
            return merged
        base["sync_error"] = err
    snap = peer.get("snapshot_file")
    if snap:
        payload = _load_snapshot_file(snap)
        if payload:
            merged = {**base, **payload, "telemetry_source": payload.get("telemetry_source", "imported_snapshot")}
            merged["sync_status"] = "OK"
            return merged
        if not base.get("sync_error"):
            base["sync_error"] = f"snapshot not found: {snap}"
    return base


def _sum_fleet(sites: List[Dict[str, Any]]) -> Dict[str, int]:
    totals = {"total": 0, "online": 0, "offline": 0, "maintenance_or_other": 0}
    for s in sites:
        if s.get("sync_status") not in (None, "OK") and s.get("role") == "peer":
            continue
        fleet = s.get("fleet") or {}
        for k in totals:
            totals[k] += int(fleet.get(k) or 0)
    return totals


def _sum_modality(sites: List[Dict[str, Any]]) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for s in sites:
        if s.get("role") == "peer" and s.get("sync_status") != "OK":
            continue
        for mod, n in (s.get("backends_by_modality") or {}).items():
            out[mod] = out.get(mod, 0) + int(n)
    return out


def build_national_summary(db: Session) -> Dict[str, Any]:
    local = build_local_site_aggregate(db)
    peers_cfg = load_registry().get("peers") or []
    peers = [resolve_peer_aggregate(p) for p in peers_cfg]
    reporting = [local] + [p for p in peers if p.get("sync_status") == "OK"]
    ops_alerts = sum((s.get("operations") or {}).get("active_alerts", 0) for s in reporting)
    ops_inc = sum((s.get("operations") or {}).get("open_incidents", 0) for s in reporting)
    return {
        "schema_version": "federated_aggregate_v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "disclaimer": DISCLAIMER,
        "local_site": local,
        "peer_sites": peers,
        "national_totals": {
            "sites_reporting": len(reporting),
            "sites_configured": 1 + len(peers_cfg),
            "fleet": _sum_fleet(reporting),
            "backends_by_modality": _sum_modality(reporting),
            "operations": {"active_alerts": ops_alerts, "open_incidents": ops_inc},
        },
    }


def import_peer_snapshot(payload: Dict[str, Any]) -> str:
    site_id = payload.get("site_id") or "peer"
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in site_id)
    os.makedirs(fed_registry.SNAPSHOT_DIR, exist_ok=True)
    path = os.path.join(fed_registry.SNAPSHOT_DIR, f"{safe}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return path
