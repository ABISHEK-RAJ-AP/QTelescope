"""Catalog-driven live credential resolution and adapter construction."""
from __future__ import annotations

import os
from typing import Any, Dict, Optional, Tuple

from app.core.config import read_env_val
from app.providers.catalog import BY_ID, catalog_by_id, stored_configured, stored_secret_token, upsert_stored
from app.providers.ibm_adapter import IBMProviderAdapter
from app.providers.ionq_adapter import IonQProviderAdapter
from app.providers.onprem_adapter import OnPremiseProviderAdapter
from app.providers.rigetti_adapter import RigettiProviderAdapter

_ALIAS_TO_ID = {
    "ibm": "ibm_quantum",
    "rigetti": "rigetti_quantum",
    "ionq": "ionq_quantum",
    "cdac": "cdac_quantum",
    "onprem": "cdac_quantum",
}


def normalize_provider_id(raw: str) -> str:
    p = (raw or "").strip().lower()
    return _ALIAS_TO_ID.get(p, p)


def catalog_spec(provider_id: str) -> Optional[Dict[str, Any]]:
    pid = normalize_provider_id(provider_id)
    return catalog_by_id(pid) or BY_ID.get(pid)


def env_token_for(provider_id: str) -> str:
    spec = catalog_spec(provider_id)
    if not spec:
        return ""
    key = spec.get("env_key")
    if key:
        from_env = (read_env_val(key, "") or os.getenv(key, "")).strip()
        if from_env:
            return from_env
    return stored_secret_token(normalize_provider_id(provider_id))


def resolve_token(provider_id: str, submitted: Optional[str]) -> str:
    t = (submitted or "").strip()
    if t:
        return t
    return env_token_for(provider_id)


def resolve_endpoint_url(provider_id: str, submitted: Optional[str]) -> str:
    u = (submitted or "").strip()
    if u:
        return u
    if normalize_provider_id(provider_id) == "cdac_quantum":
        return (read_env_val("ONPREM_QPU_URL", "") or os.getenv("ONPREM_QPU_URL", "")).strip()
    return ""


def build_live_adapter(provider_id: str, token: str, endpoint_url: str = ""):
    pid = normalize_provider_id(provider_id)
    if pid == "ibm_quantum":
        return IBMProviderAdapter(api_token=token or None)
    if pid == "rigetti_quantum":
        return RigettiProviderAdapter(api_key=token or None)
    if pid == "ionq_quantum":
        return IonQProviderAdapter(api_key=token or None)
    if pid == "cdac_quantum":
        return OnPremiseProviderAdapter(endpoint_url=endpoint_url or None)
    return None


def persist_live_env(provider_id: str, token: str, endpoint_url: str = "") -> None:
    """Writes known env keys for live adapters (process + .env handled by caller)."""
    pid = normalize_provider_id(provider_id)
    if pid == "ibm_quantum" and token:
        os.environ["IBM_QUANTUM_TOKEN"] = token
    elif pid == "rigetti_quantum" and token:
        os.environ["RIGETTI_API_KEY"] = token
        os.environ["QCS_API_KEY"] = token
    elif pid == "ionq_quantum" and token:
        os.environ["IONQ_API_KEY"] = token
    elif pid == "cdac_quantum" and endpoint_url:
        os.environ["ONPREM_QPU_URL"] = endpoint_url


def env_keys_to_persist(provider_id: str, token: str, endpoint_url: str) -> list[Tuple[str, str]]:
    pid = normalize_provider_id(provider_id)
    out: list[Tuple[str, str]] = []
    if pid == "ibm_quantum" and token:
        out.append(("IBM_QUANTUM_TOKEN", token))
    elif pid == "rigetti_quantum" and token:
        out.append(("RIGETTI_API_KEY", token))
    elif pid == "ionq_quantum" and token:
        out.append(("IONQ_API_KEY", token))
    elif pid == "cdac_quantum" and endpoint_url:
        out.append(("ONPREM_QPU_URL", endpoint_url))
    return out


def validate_live_credentials(provider_id: str, token: str, endpoint_url: str) -> None:
    from fastapi import HTTPException

    pid = normalize_provider_id(provider_id)
    spec = catalog_spec(pid)
    if not spec or spec.get("adapter") != "live":
        return
    needs_token = any(
        f.get("in") == "token" and f.get("required", True) for f in spec.get("fields") or []
    )
    needs_url = any(
        f.get("in") == "endpoint_url" and f.get("required", True) for f in spec.get("fields") or []
    )
    if needs_token and not token and not stored_configured(pid) and not env_token_for(pid):
        raise HTTPException(status_code=400, detail=f"{spec['name']} token cannot be empty.")
    if needs_url and not endpoint_url and not stored_configured(pid) and not resolve_endpoint_url(pid, None):
        raise HTTPException(status_code=400, detail=f"{spec['name']} endpoint URL cannot be empty.")
    adapter = build_live_adapter(pid, token, endpoint_url)
    if pid == "ibm_quantum" and token and adapter and not adapter.is_authenticated:
        raise HTTPException(
            status_code=400,
            detail="IBM Quantum Token authentication failed. Check your IBM Cloud API key.",
        )
    if pid == "ionq_quantum" and token and adapter and not adapter.is_authenticated:
        raise HTTPException(status_code=400, detail="IonQ API key was rejected or api.ionq.co did not respond.")


def stub_save(provider_id: str, token: str, endpoint_url: str, extra: Optional[Dict[str, Any]]) -> Dict[str, str]:
    pid = normalize_provider_id(provider_id)
    upsert_stored(pid, token or None, endpoint_url or None, extra)
    spec = catalog_spec(pid) or {"name": pid}
    return {
        "status": "STUB",
        "provider_id": pid,
        "message": (
            f"{spec.get('name', pid)} credentials stored. "
            "Live poll adapter not installed — slot is STUB until wired."
        ),
    }