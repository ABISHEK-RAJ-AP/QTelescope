"""Optional live adapter verification (CI / ops — secrets required) (IMP-P5)."""
from __future__ import annotations

import os
from typing import Any, Dict, List

from app.providers.ibm_adapter import IBMProviderAdapter
from app.providers.ionq_adapter import IonQProviderAdapter
from app.providers.rigetti_adapter import RigettiProviderAdapter
from app.providers.sdk.contract import run_adapter_contract
from app.providers.truth import provider_truth_label
from app.providers.catalog import BY_ID

_HARNESS = (
    ("ibm_quantum", "IBM_QUANTUM_TOKEN", "ibm_brisbane"),
    ("rigetti_quantum", "RIGETTI_API_KEY", "rigetti_aspen_m3"),
    ("ionq_quantum", "IONQ_API_KEY", "ionq_forte"),
)


def _adapter_for(pid: str, token: str):
    if pid == "ibm_quantum":
        return IBMProviderAdapter(api_token=token)
    if pid == "rigetti_quantum":
        return RigettiProviderAdapter(api_key=token)
    return IonQProviderAdapter(api_key=token)


def run_live_verification() -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for pid, env_key, probe in _HARNESS:
        item = BY_ID.get(pid) or {"id": pid, "adapter": "live"}
        token = os.getenv(env_key, "")
        if not token or len(token.strip()) < 8:
            out.append(
                {
                    "provider_id": pid,
                    "skipped": True,
                    "reason": f"{env_key} not set",
                    "truth_label": provider_truth_label(item, configured=False),
                }
            )
            continue
        adapter = _adapter_for(pid, token)
        result = run_adapter_contract(adapter, probe_backend_id=probe)
        verified = bool(result.get("ok"))
        out.append(
            {
                "provider_id": pid,
                "skipped": False,
                "verified": verified,
                "truth_label": provider_truth_label(item, configured=True, verified=verified),
                "contract": result,
            }
        )
    return out
