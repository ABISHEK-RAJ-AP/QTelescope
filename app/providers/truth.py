"""Honest provider capability labels for Admin UI (IMP-P5)."""
from __future__ import annotations

import os
from typing import Any, Dict

STUB = "STUB"
MOCK_ONLY = "MOCK_ONLY"
LIVE_NOT_CONFIGURED = "LIVE_NOT_CONFIGURED"
LIVE_UNVERIFIED = "LIVE_UNVERIFIED"
LIVE_VERIFIED = "LIVE_VERIFIED"


def ionq_live_enabled() -> bool:
    raw = os.getenv("IONQ_LIVE_ENABLED", "true").lower().strip()
    return raw in ("1", "true", "yes")


def provider_truth_label(
    catalog_item: Dict[str, Any],
    *,
    configured: bool,
    verified: bool = False,
) -> str:
    if catalog_item.get("adapter") == "stub":
        return STUB
    pid = catalog_item.get("id") or ""
    if pid == "ionq_quantum" and not ionq_live_enabled():
        return MOCK_ONLY
    if not configured:
        return LIVE_NOT_CONFIGURED
    if verified:
        return LIVE_VERIFIED
    return LIVE_UNVERIFIED


def truth_help(label: str) -> str:
    return {
        STUB: "Credential slot only — no collector adapter",
        MOCK_ONLY: "IonQ live poll disabled (IONQ_LIVE_ENABLED=false)",
        LIVE_NOT_CONFIGURED: "Adapter wired — credentials not set (Rigetti public ISA needs none)",
        LIVE_UNVERIFIED: "Configured; live poll not verified in this environment",
        LIVE_VERIFIED: "Live contract check passed with credentials",
    }.get(label, label)
