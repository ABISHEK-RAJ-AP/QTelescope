"""Data lineage helpers — live vs simulated vs stub, telemetry source labels."""
from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional

from app.core.config import settings

# Canonical demo/mock backend IDs from app.core.mock_data
MOCK_BACKEND_IDS = frozenset(
    {"ibm_brisbane", "rigetti_aspen_m3", "ionq_forte", "cdac_qsim_param"}
)

LineageMode = str  # live | simulated | stub | replay


def format_telemetry_source(lineage: LineageMode, provider_id: str) -> str:
    mode = (lineage or "stub").lower().strip()
    if mode not in ("live", "simulated", "stub", "replay"):
        mode = "stub"
    return f"{mode}:{provider_id}"


def infer_collection_lineage(backends: List[Dict[str, Any]]) -> LineageMode:
    """Infer lineage for a collection cycle from discovered backend IDs."""
    if not backends:
        return "stub"
    ids = {str(b.get("backend_id", "")) for b in backends}
    if ids and ids <= MOCK_BACKEND_IDS:
        return "simulated"
    return "live"


def database_storage_mode(database_url: str) -> str:
    if ":memory:" in database_url:
        return "memory"
    if database_url.startswith("sqlite"):
        return "file_sqlite"
    return "server"


def platform_data_mode(enable_mock: bool, has_live_backends: bool) -> str:
    """High-level label for UI banner."""
    if enable_mock and not has_live_backends:
        return "simulated"
    if enable_mock and has_live_backends:
        return "mixed"
    if not enable_mock and has_live_backends:
        return "live"
    return "unknown"


def parse_telemetry_source(raw: Optional[str]) -> Dict[str, str]:
    if not raw or ":" not in raw:
        return {"lineage": "stub", "provider_id": raw or "unknown"}
    lineage, provider_id = raw.split(":", 1)
    return {"lineage": lineage, "provider_id": provider_id}


_PROVIDER_LABEL = {
    "ibm_quantum": "IBM Quantum API",
    "rigetti_quantum": "Rigetti QCS API",
    "ionq_quantum": "IonQ Cloud API",
    "cdac_quantum": "C-DAC API",
}


def _provider_display(provider_id: Optional[str]) -> str:
    pid = (provider_id or "unknown").strip()
    return _PROVIDER_LABEL.get(pid, pid.replace("_", " "))


def resolve_backend_data_lineage(
    *,
    backend_id: str,
    provider_id: str,
    latest_telemetry_source: Optional[str] = None,
) -> Dict[str, str]:
    """Per-backend lineage — from last ingest row, not catalog ID alone."""
    from app.core.hybrid_demo import hybrid_demo_enabled, is_demo_live_provider

    if latest_telemetry_source and ":" in str(latest_telemetry_source):
        parsed = parse_telemetry_source(latest_telemetry_source)
        mode = parsed["lineage"]
        prov = parsed.get("provider_id") or provider_id
    else:
        prov = provider_id
        if backend_id not in MOCK_BACKEND_IDS:
            mode = "live"
        elif hybrid_demo_enabled() and is_demo_live_provider(provider_id):
            mode = "live"
        elif latest_telemetry_source in (None, "", "api"):
            mode = "stub"
        else:
            mode = "simulated"

    if mode == "live":
        label = f"Provider API · {_provider_display(prov)}"
    elif mode == "simulated":
        label = "Demo catalog (simulated)"
    elif mode == "replay":
        label = "Replay snapshot"
    else:
        label = "Awaiting provider ingest"

    return {
        "lineage": mode,
        "label": label,
        "telemetry_source": latest_telemetry_source or None,
    }


def utcnow_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()
