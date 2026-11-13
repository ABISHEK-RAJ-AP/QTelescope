"""Resolve catalog provider id → adapter instance (live or neutral stub)."""
from __future__ import annotations

from typing import Optional, Tuple

from app.providers.base import BaseProviderAdapter
from app.providers.catalog import catalog_by_id
from app.providers.ibm_adapter import IBMProviderAdapter
from app.providers.ionq_adapter import IonQProviderAdapter
from app.providers.neutral_stub_adapter import NeutralStubProviderAdapter
from app.providers.onprem_adapter import OnPremiseProviderAdapter
from app.providers.rigetti_adapter import RigettiProviderAdapter


# Catalog ids with a live class. Short names are the same providers.
_LIVE = {
    "ibm_quantum": lambda token: IBMProviderAdapter(api_token=token),
    "rigetti_quantum": lambda token: RigettiProviderAdapter(api_key=token or None),
    "ionq_quantum": lambda token: IonQProviderAdapter(api_key=token),
    "cdac_quantum": lambda token: OnPremiseProviderAdapter(),
}
_ALIASES = {
    "ibm": "ibm_quantum",
    "rigetti": "rigetti_quantum",
    "ionq": "ionq_quantum",
    "cdac": "cdac_quantum",
    "onprem": "cdac_quantum",
}


def adapter_for_provider(provider_id: str, *, token: Optional[str] = None) -> Tuple[BaseProviderAdapter, str]:
    item = catalog_by_id(provider_id) or {}
    name = item.get("name") or provider_id
    raw = (provider_id or "").lower()
    canonical = _ALIASES.get(raw) or item.get("id") or raw
    factory = _LIVE.get(canonical)
    if factory is not None:
        return factory(token), name
    stub_id = item.get("id") or canonical or "unknown"
    return NeutralStubProviderAdapter(stub_id, name), name
