"""Honest provider capability labels for Admin UI (IMP-P5)."""
from __future__ import annotations

import os
from typing import Any, Dict

STUB = "STUB"
MOCK_ONLY = "MOCK_ONLY"
LIVE_NOT_CONFIGURED = "LIVE_NOT_CONFIGURED"
LIVE_UNVERIFIED = "LIVE_UNVERIFIED"
LIVE_VERIFIED = "LIVE_VERIFIED"

_TRUTH_TITLES = {
    STUB: "Stub only",
    MOCK_ONLY: "Mock / demo mode",
    LIVE_NOT_CONFIGURED: "Credentials required",
    LIVE_UNVERIFIED: "Not verified",
    LIVE_VERIFIED: "Verified",
}


def truth_status_title(label: str, *, provider_id: str | None = None) -> str:
    """Short operator-facing connection label (not raw enum codes)."""
    if provider_id == "rigetti_quantum":
        if label == LIVE_VERIFIED:
            return "Public QCS feed verified"
        if label in (LIVE_UNVERIFIED, LIVE_NOT_CONFIGURED):
            return "Public QCS feed (token optional)"
    return _TRUTH_TITLES.get(label, str(label).replace("_", " ").title())


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


def truth_help(label: str, *, provider_id: str | None = None) -> str:
    if provider_id == "rigetti_quantum" and label in (LIVE_NOT_CONFIGURED, LIVE_UNVERIFIED, LIVE_VERIFIED):
        base = (
            "Rigetti uses the public QCS instruction-set feed for topology and published qubit metrics. "
            "A QCS API token is optional and only needed for authenticated QCS endpoints."
        )
        if label == LIVE_NOT_CONFIGURED:
            return base
        if label == LIVE_UNVERIFIED:
            return f"{base} Save or run verification to confirm the feed in this deployment."
        return f"{base} The latest connection check succeeded."
    return {
        STUB: "Credential storage only. No telemetry adapter is installed for this vendor.",
        MOCK_ONLY: "Live IonQ polling is disabled (IONQ_LIVE_ENABLED=false). Demo catalog may still be used.",
        LIVE_NOT_CONFIGURED: (
            "Live adapter is installed but required credentials are not stored on the server. "
            "Enter values below or set the matching environment variables, then verify."
        ),
        LIVE_UNVERIFIED: (
            "Credentials are stored or not required for this vendor. "
            "Run live verification to confirm connectivity before relying on alerts."
        ),
        LIVE_VERIFIED: "Live connection check succeeded. Telemetry collection uses the vendor API.",
    }.get(label, label)
