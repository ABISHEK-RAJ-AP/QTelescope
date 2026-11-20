"""Optional live adapter verification (CI / ops — secrets required) (IMP-P5)."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.providers.catalog import BY_ID
from app.providers.credential_live import build_live_adapter, env_token_for, normalize_provider_id
from app.providers.sdk.contract import run_adapter_contract
from app.providers.truth import provider_truth_label

_LIVE_PROVIDER_IDS = ("ibm_quantum", "rigetti_quantum", "ionq_quantum")


def _probe_backend_id(adapter, fallback: Optional[str] = None) -> str:
    try:
        backends = adapter.discover_backends() or []
        for row in backends:
            bid = (row.get("backend_id") or "").strip()
            if bid:
                return bid
    except Exception:
        pass
    return fallback or "unknown"


def _adapter_for(pid: str, token: str):
    return build_live_adapter(pid, token)


def run_live_verification() -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for pid in _LIVE_PROVIDER_IDS:
        item = BY_ID.get(pid) or {"id": pid, "adapter": "live"}
        env_key = item.get("env_key") or ""
        token = env_token_for(pid) if env_key else ""
        public_ok = pid == "rigetti_quantum"
        if (not token or len(token.strip()) < 8) and not public_ok:
            out.append(
                {
                    "provider_id": pid,
                    "skipped": True,
                    "reason": f"{env_key or 'credentials'} not set",
                    "truth_label": provider_truth_label(item, configured=False),
                }
            )
            continue
        adapter = _adapter_for(normalize_provider_id(pid), token or "")
        if not adapter:
            out.append(
                {
                    "provider_id": pid,
                    "skipped": True,
                    "reason": "No live adapter wired",
                    "truth_label": provider_truth_label(item, configured=False),
                }
            )
            continue
        probe = _probe_backend_id(adapter)
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