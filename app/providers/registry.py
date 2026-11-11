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


def adapter_for_provider(provider_id: str, *, token: Optional[str] = None) -> Tuple[BaseProviderAdapter, str]:
    item = catalog_by_id(provider_id) or {}
    name = item.get("name") or provider_id
    pid = (provider_id or "").lower()

    if pid in ("ibm", "ibm_quantum") or item.get("id") == "ibm_quantum":
        return IBMProviderAdapter(api_token=token), name
    if pid in ("rigetti", "rigetti_quantum"):
        return RigettiProviderAdapter(api_key=token or None), name
    if pid in ("ionq", "ionq_quantum"):
        return IonQProviderAdapter(api_key=token), name
    if pid in ("cdac", "cdac_quantum", "onprem"):
        return OnPremiseProviderAdapter(), name

    if item.get("adapter") == "live":
        # Live flag without wired class yet — still neutral stub until driver lands.
        return NeutralStubProviderAdapter(item.get("id", pid), name), name

    return NeutralStubProviderAdapter(item.get("id", pid), name), name
