"""Operator-editable fleet catalogue metadata (owner, facility, tags) keyed by backend_id."""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List

_LOCK = threading.RLock()
_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data",
    "backend_catalog.json",
)

_DEFAULT_FACILITY_BY_PROVIDER = {
    "ibm_quantum": "IBM Quantum",
    "rigetti_quantum": "Rigetti QCS",
    "ionq_quantum": "IonQ Cloud",
    "cdac_quantum": "C-DAC PARAM",
}


def _ensure_dir() -> None:
    os.makedirs(os.path.dirname(_PATH), exist_ok=True)


def load_all() -> Dict[str, Any]:
    with _LOCK:
        if not os.path.isfile(_PATH):
            return {"backends": {}, "updated_at": None}
        try:
            with open(_PATH, encoding="utf-8") as fh:
                return json.load(fh)
        except (json.JSONDecodeError, OSError):
            return {"backends": {}, "updated_at": None}


def get_catalog_entry(backend_id: str, *, provider_id: str | None = None) -> Dict[str, Any]:
    blob = load_all()
    raw = (blob.get("backends") or {}).get(backend_id) or {}
    facility = raw.get("facility")
    if not facility and provider_id:
        facility = _DEFAULT_FACILITY_BY_PROVIDER.get(provider_id)
    tags = raw.get("tags") or []
    if not isinstance(tags, list):
        tags = []
    return {
        "owner": raw.get("owner"),
        "facility": facility,
        "tags": [str(t) for t in tags if t][:12],
    }


def upsert_catalog(
    backend_id: str,
    *,
    owner: str | None = None,
    facility: str | None = None,
    tags: List[str] | None = None,
    actor: str | None = None,
) -> Dict[str, Any]:
    with _LOCK:
        _ensure_dir()
        data = load_all()
        backends = data.setdefault("backends", {})
        prev = backends.get(backend_id) or {}
        entry = dict(prev)
        if owner is not None:
            entry["owner"] = owner.strip()[:120] or None
        if facility is not None:
            entry["facility"] = facility.strip()[:120] or None
        if tags is not None:
            entry["tags"] = [str(t).strip()[:40] for t in tags if str(t).strip()][:12]
        entry["updated_at"] = datetime.now(timezone.utc).isoformat()
        if actor:
            entry["updated_by"] = actor[:80]
        backends[backend_id] = entry
        data["updated_at"] = entry["updated_at"]
        with open(_PATH, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
        return entry
