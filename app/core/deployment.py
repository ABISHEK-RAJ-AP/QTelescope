"""Deployment profile — connected vs on-prem air-gap."""
from __future__ import annotations

import os
from typing import Any, Dict

from app.core.bootstrap_security import block_default_bootstrap_enabled
from app.core.config import settings
from app.core.env_profile import env_flag, is_production_profile
from app.core.provenance import database_storage_mode
from app.core.sessions import require_api_auth
from app.core.rbac import rbac_enforced


def airgap_mode_enabled() -> bool:
    val = os.getenv("AIRGAP_MODE") or os.getenv("QTELESCOPE_AIRGAP") or ""
    return str(val).lower().strip() in ("1", "true", "yes", "on")


def deployment_profile() -> Dict[str, Any]:
    airgap = airgap_mode_enabled()
    db_mode = database_storage_mode(settings.DATABASE_URL)
    return {
        "profile": "airgap_onprem" if airgap else "connected",
        "airgap_mode": airgap,
        "version": settings.VERSION,
        "database_storage": db_mode,
        "enable_mock_data": settings.ENABLE_MOCK_DATA,
        "outbound_vendor_apis": "POLICY_BLOCKED" if airgap else "ALLOWED_IF_CREDENTIALS",
        "data_persistence": "data/ volume (sqlite, federation, facility, evidence)",
        "ingress_paths": {
            "facility_rest": "LIVE",
            "facility_inbox": "LIVE",
            "federation_snapshot": "LIVE",
            "vendor_cloud_poll": "DISABLED_IN_AIRGAP" if airgap else "LIVE_WITH_CREDS",
        },
        "security": {
            "require_api_auth": require_api_auth(),
            "enforce_rbac": rbac_enforced(),
            "allow_env_credential_write": env_flag(
                "ALLOW_ENV_CREDENTIAL_WRITE", default=not is_production_profile()
            ),
            "recommended_prod": {
                "ENVIRONMENT": "production",
                "REQUIRE_API_AUTH": "true",
                "ENFORCE_RBAC": "true",
                "ALLOW_ENV_CREDENTIAL_WRITE": "false",
                "BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS": "true",
                "CORS_ORIGINS": "<exact UI origin>",
            },
            "block_default_bootstrap_credentials": block_default_bootstrap_enabled(),
        },
        "operator_notes": (
            "Air-gap: use on-prem adapter + snapshot/federation import; no cloud token egress required."
            if airgap
            else "Connected: configure provider credentials in Admin for live vendor APIs."
        ),
        "ux": {
            "operator_landing": os.getenv("OPERATOR_LANDING", "operations").strip().lower()
            or "operations",
        },
    }
