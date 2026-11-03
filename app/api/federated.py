from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.core.rbac import require_admin
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.federated.aggregator import build_local_site_aggregate, build_national_summary, import_peer_snapshot
from app.federated.registry import ensure_federation_layout, list_peers, load_registry
from app.federated.signing import (
    sign_snapshot_payload,
    signing_required,
    verify_import_body,
    signing_key_configured,
)

router = APIRouter(prefix="/federated", tags=["Federated observability"])


class PeerSnapshotImport(BaseModel):
    site_id: str
    site_name: Optional[str] = None
    fleet: Dict[str, Any]
    backends_by_modality: Optional[Dict[str, int]] = None
    providers_active: Optional[List[str]] = None
    operations: Optional[Dict[str, int]] = None
    telemetry_source: str = "imported_snapshot"
    signature: Optional[str] = None
    algorithm: Optional[str] = None


class SignedSnapshotEnvelope(BaseModel):
    payload: Dict[str, Any]
    signature: Optional[str] = None
    algorithm: str = "HMAC-SHA256"


@router.get("/status")
def federation_status():
    ensure_federation_layout()
    reg = load_registry()
    peers = list_peers()
    return {
        "mode": "federated_v1",
        "local_site_id": reg.get("local_site_id"),
        "local_site_name": reg.get("local_site_name"),
        "peer_count": len(peers),
        "snapshot_dir": "data/federation_snapshots",
        "live_peer_mesh": "NOT_BUILT",
        "aggregate_pull": "LIVE",
        "snapshot_import": "LIVE",
        "signing": {
            "algorithm": "HMAC-SHA256",
            "require_signature": signing_required(),
            "hub_key_configured": signing_key_configured(),
        },
    }


@router.get("/identity")
def federation_identity():
    reg = load_registry()
    return {
        "site_id": reg.get("local_site_id"),
        "site_name": reg.get("local_site_name"),
        "role": "national_hub",
        "signing_policy": {
            "require_signature": signing_required(),
            "hub_key_configured": signing_key_configured(),
        },
    }


@router.get("/sites")
def federation_sites(db: Session = Depends(get_db)):
    summary = build_national_summary(db)
    return {
        "local": summary["local_site"],
        "peers": summary["peer_sites"],
    }


@router.get("/summary")
def federation_summary(db: Session = Depends(get_db)):
    return build_national_summary(db)


@router.get("/local")
def federation_local(db: Session = Depends(get_db)):
    return build_local_site_aggregate(db)


def _import_after_verify(raw: Dict[str, Any]) -> Dict[str, Any]:
    ok, msg = verify_import_body(raw)
    if not ok:
        raise HTTPException(status_code=400, detail=f"Snapshot signature invalid: {msg}")
    if "payload" in raw and isinstance(raw.get("payload"), dict):
        payload = dict(raw["payload"])
    else:
        payload = {k: v for k, v in raw.items() if k not in ("signature", "algorithm")}
    payload.setdefault("generated_at", datetime.now(timezone.utc).isoformat())
    path = import_peer_snapshot(payload)
    return {"status": "SUCCESS", "path": path, "site_id": payload.get("site_id"), "verify": msg}


@router.get("/local/export")
def federation_export_local_signed(db: Session = Depends(get_db), _: str = Depends(require_admin)):
    payload = build_local_site_aggregate(db)
    return sign_snapshot_payload(payload)


@router.post("/snapshots/import")
def federation_import_snapshot(body: PeerSnapshotImport, _: str = Depends(require_admin)):
    return _import_after_verify(body.model_dump(exclude_none=True))


@router.post("/snapshots/import-signed")
def federation_import_signed(body: SignedSnapshotEnvelope, _: str = Depends(require_admin)):
    return _import_after_verify(body.model_dump(exclude_none=True))
