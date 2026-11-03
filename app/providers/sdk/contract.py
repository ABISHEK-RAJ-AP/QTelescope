"""Minimal adapter contract — shared by national SDK and CI."""
from __future__ import annotations

from typing import Any, Dict, List

from app.providers.base import BaseProviderAdapter

BACKEND_KEYS = {"backend_id", "backend_name", "backend_type", "qubit_count", "operational_status"}
JOB_KEYS = {"job_id", "backend_id", "status", "submitted_at"}


def validate_backend_record(record: Dict[str, Any]) -> List[str]:
    missing = BACKEND_KEYS - set(record.keys())
    if missing:
        return [f"backend missing keys: {sorted(missing)}"]
    return []


def validate_job_record(record: Dict[str, Any]) -> List[str]:
    missing = JOB_KEYS - set(record.keys())
    if missing:
        return [f"job missing keys: {sorted(missing)}"]
    return []


def run_adapter_contract(
    adapter: BaseProviderAdapter,
    probe_backend_id: str = "ibm_brisbane",
) -> Dict[str, Any]:
    """Exercise adapter surface; returns {ok, errors, lineage_mode, probe_backend_id}."""
    errors: List[str] = []
    lineage = adapter.lineage_mode()

    try:
        if not adapter.authenticate():
            errors.append("authenticate() returned False")
    except Exception as exc:  # ponytail: contract boundary — surface vendor exceptions
        errors.append(f"authenticate() raised: {exc}")

    if errors:
        return {"ok": False, "errors": errors, "lineage_mode": lineage, "probe_backend_id": probe_backend_id}

    bid = probe_backend_id
    try:
        backends = adapter.discover_backends() or []
        for b in backends:
            errors.extend(validate_backend_record(b))
        if backends and backends[0].get("backend_id"):
            bid = backends[0]["backend_id"]
    except Exception as exc:
        errors.append(f"discover_backends() raised: {exc}")

    for name, fn, args in (
        ("get_backend_status", adapter.get_backend_status, (bid,)),
        ("get_backend_properties", adapter.get_backend_properties, (bid,)),
        ("get_connectivity", adapter.get_connectivity, (bid,)),
        ("get_jobs", adapter.get_jobs, (bid, 3)),
    ):
        try:
            result = fn(*args)
        except Exception as exc:
            errors.append(f"{name}() raised: {exc}")
            continue
        if name == "get_jobs":
            for job in result or []:
                errors.extend(validate_job_record(job))
        elif name == "get_connectivity" and result is not None and not isinstance(result, list):
            errors.append(f"{name}() must return list")

    return {
        "ok": not errors,
        "errors": errors,
        "lineage_mode": lineage,
        "probe_backend_id": bid,
    }
