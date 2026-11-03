"""HMAC snapshot signing for federated peer import (IMP-P6)."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Tuple

ALGORITHM = "HMAC-SHA256"


def signing_required() -> bool:
    return os.getenv("FEDERATION_REQUIRE_SIGNATURE", "false").lower().strip() in (
        "1",
        "true",
        "yes",
    )


def signing_key_configured() -> bool:
    return bool(os.getenv("FEDERATION_SIGNING_KEY", "").strip())


def _signing_key() -> str:
    return os.getenv("FEDERATION_SIGNING_KEY", "").strip()


def canonical_bytes(payload: Dict[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sign_snapshot_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Return envelope {payload, signature, algorithm, signed_at} — signature null if no key."""
    body = dict(payload)
    body.setdefault("signed_at", datetime.now(timezone.utc).isoformat())
    key = _signing_key()
    if not key:
        return {
            "payload": body,
            "signature": None,
            "algorithm": ALGORITHM,
            "signing_status": "unsigned_no_key",
        }
    sig = hmac.new(key.encode("utf-8"), canonical_bytes(body), hashlib.sha256).hexdigest()
    return {
        "payload": body,
        "signature": sig,
        "algorithm": ALGORITHM,
        "signing_status": "signed",
    }


def verify_snapshot_envelope(envelope: Dict[str, Any]) -> Tuple[bool, str]:
    payload = envelope.get("payload")
    if not isinstance(payload, dict):
        return False, "missing payload object"
    sig = envelope.get("signature")
    if not sig:
        if signing_required():
            return False, "signature required (FEDERATION_REQUIRE_SIGNATURE)"
        return True, "unsigned accepted"
    key = _signing_key()
    if not key:
        return False, "FEDERATION_SIGNING_KEY not configured on hub"
    expected = hmac.new(key.encode("utf-8"), canonical_bytes(payload), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, str(sig)):
        return False, "signature mismatch"
    return True, "ok"


def verify_import_body(body: Dict[str, Any]) -> Tuple[bool, str]:
    """Accept signed envelope or flat snapshot with optional top-level signature."""
    if "payload" in body and isinstance(body.get("payload"), dict):
        return verify_snapshot_envelope(body)
    sig = body.get("signature")
    if sig:
        payload = {k: v for k, v in body.items() if k not in ("signature", "algorithm")}
        return verify_snapshot_envelope({"payload": payload, "signature": sig, "algorithm": body.get("algorithm")})
    if signing_required():
        return False, "signature required"
    return True, "unsigned accepted"
