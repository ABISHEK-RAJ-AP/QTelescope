"""Load site quota policy (S10 — file-backed caps per tenant)."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict

_POLICY_PATH = Path(__file__).resolve().parents[2] / "config" / "quota_policy.json"


@lru_cache(maxsize=1)
def load_quota_policy() -> Dict[str, Any]:
    if not _POLICY_PATH.is_file():
        return {"defaults": {"daily_shots_cap": 1_000_000, "warn_threshold_pct": 80}, "tenants": {}}
    with _POLICY_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def daily_shots_cap_for_tenant(tenant_id: str) -> int:
    policy = load_quota_policy()
    tenant = (policy.get("tenants") or {}).get(tenant_id) or {}
    if tenant.get("daily_shots_cap") is not None:
        return int(tenant["daily_shots_cap"])
    return int((policy.get("defaults") or {}).get("daily_shots_cap", 1_000_000))


def warn_threshold_pct() -> int:
    policy = load_quota_policy()
    return int((policy.get("defaults") or {}).get("warn_threshold_pct", 80))
