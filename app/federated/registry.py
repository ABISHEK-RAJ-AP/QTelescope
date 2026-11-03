"""Federation site registry — local hub + peer snapshot references."""
from __future__ import annotations

import json
import os
from typing import Any, Dict, List

from app.providers.catalog import DATA_DIR

REGISTRY_PATH = os.path.join(DATA_DIR, "federation_registry.json")
SNAPSHOT_DIR = os.path.join(DATA_DIR, "federation_snapshots")

DEFAULT_REGISTRY: Dict[str, Any] = {
    "local_site_id": "cdac-national-hub",
    "local_site_name": "C-DAC National Observability Hub",
    "peers": [
        {
            "site_id": "demo-iitr-lab",
            "site_name": "Demo IITR Lab (imported snapshot)",
            "snapshot_file": "demo_iitr_lab.json",
            "aggregate_url": None,
        }
    ],
}


def ensure_federation_layout() -> None:
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    demo = os.path.join(SNAPSHOT_DIR, "demo_iitr_lab.json")
    if not os.path.exists(demo):
        with open(demo, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "site_id": "demo-iitr-lab",
                    "site_name": "Demo IITR Lab",
                    "telemetry_source": "imported_snapshot",
                    "generated_at": "2026-10-31T12:00:00+00:00",
                    "fleet": {"total": 2, "online": 2, "offline": 0, "maintenance_or_other": 0},
                    "backends_by_modality": {"superconducting": 1, "simulator": 1},
                    "providers_active": ["cdac_quantum", "ibm_quantum"],
                    "operations": {"active_alerts": 1, "open_incidents": 0},
                },
                f,
                indent=2,
            )
    if not os.path.exists(REGISTRY_PATH):
        with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_REGISTRY, f, indent=2)


def load_registry() -> Dict[str, Any]:
    ensure_federation_layout()
    try:
        with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except (OSError, json.JSONDecodeError):
        pass
    return dict(DEFAULT_REGISTRY)


def list_peers() -> List[Dict[str, Any]]:
    reg = load_registry()
    return list(reg.get("peers") or [])
