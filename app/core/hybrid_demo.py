"""Demo profile: one or more providers on live ingest; others stay simulated."""
from __future__ import annotations

import os
from typing import FrozenSet

from app.core.config import settings

_DEFAULT_LIVE = "rigetti_quantum"


def _env_true(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).lower().strip() in ("1", "true", "yes", "on")


def demo_live_provider_ids() -> FrozenSet[str]:
    raw = os.getenv("DEMO_LIVE_PROVIDERS", _DEFAULT_LIVE).strip()
    if not raw:
        return frozenset()
    return frozenset(p.strip() for p in raw.split(",") if p.strip())


def hybrid_demo_enabled() -> bool:
    if _env_true("HYBRID_DEMO_ENABLED", "false"):
        return bool(demo_live_provider_ids())
    return settings.ENABLE_MOCK_DATA and bool(demo_live_provider_ids()) and _env_true(
        "HYBRID_DEMO_WITH_MOCK", "true"
    )


def provider_uses_live_collection(provider_id: str) -> bool:
    if not hybrid_demo_enabled():
        return True
    return provider_id in demo_live_provider_ids()


def is_demo_live_provider(provider_id: str) -> bool:
    return hybrid_demo_enabled() and provider_id in demo_live_provider_ids()


def ensure_demo_live_provider(provider_id: str) -> list[str]:
    """
    When hybrid demo is on, add a provider to DEMO_LIVE_PROVIDERS (e.g. after IBM token save).
    Returns sorted live provider ids after the merge.
    """
    pid = (provider_id or "").strip()
    if not pid:
        return sorted(demo_live_provider_ids())
    live = set(demo_live_provider_ids())
    if pid in live:
        return sorted(live)
    live.add(pid)
    merged = ",".join(sorted(live))
    os.environ["DEMO_LIVE_PROVIDERS"] = merged
    return sorted(live)


def hybrid_demo_public_snapshot() -> dict:
    live = sorted(demo_live_provider_ids())
    return {
        "hybrid_demo_enabled": hybrid_demo_enabled(),
        "demo_live_providers": live,
        "mock_only_providers_note": (
            "Non-listed providers use simulated catalog when hybrid demo is on."
            if hybrid_demo_enabled()
            else None
        ),
        "rigetti_isa_poll_seconds": int(os.getenv("RIGETTI_ISA_CACHE_SECONDS", "45")),
        "collection_scheduler_enabled": _env_true("COLLECTION_SCHEDULER_ENABLED", "true"),
    }