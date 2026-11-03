"""Governance notifications — log, timeline, webhook (allowlisted), email stub."""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

_CONFIG: Optional[Dict[str, Any]] = None

_LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def load_notifications_config() -> Dict[str, Any]:
    cfg = _load_config()
    return {
        "schema_version": cfg.get("schema_version", 1),
        "events": cfg.get("events") or [],
        "webhook_allowlist": {
            "local_hosts": True,
            "extra_hosts": cfg.get("webhook_allowed_hosts") or [],
            "host_suffixes": cfg.get("webhook_allowed_host_suffixes") or [],
        },
        "channels": {
            name: {"enabled": bool(ch.get("enabled"))}
            for name, ch in (cfg.get("channels") or {}).items()
        },
    }


def _load_config() -> Dict[str, Any]:
    global _CONFIG
    if _CONFIG is not None:
        return _CONFIG
    path = Path(__file__).resolve().parents[2] / "config" / "governance_notifications.json"
    if not path.is_file():
        _CONFIG = {"events": [], "channels": {}}
        return _CONFIG
    _CONFIG = json.loads(path.read_text(encoding="utf-8"))
    return _CONFIG


def _webhook_url_allowed(url: str, cfg: Dict[str, Any]) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    host = (parsed.hostname or "").lower()
    if not host:
        return False
    if host in _LOCAL_HOSTS:
        return True
    if host in [h.lower() for h in (cfg.get("webhook_allowed_hosts") or [])]:
        return True
    for suffix in cfg.get("webhook_allowed_host_suffixes") or []:
        s = str(suffix).lower()
        if s and host.endswith(s):
            return True
    return False


def _post_webhook(url: str, record: Dict[str, Any], cfg: Dict[str, Any], timeout_sec: float = 5.0) -> Dict[str, Any]:
    if not url or not url.startswith(("http://", "https://")):
        return {"ok": False, "error": "invalid_or_missing_webhook_url"}
    if not _webhook_url_allowed(url, cfg):
        return {"ok": False, "error": "webhook_host_not_allowlisted"}
    data = json.dumps(record).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "QRE-Governance-Notify/1"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            return {"ok": True, "status": resp.status}
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"HTTP {e.code}", "status": e.code}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _send_email_stub(channel_cfg: Dict[str, Any], record: Dict[str, Any]) -> Dict[str, Any]:
    to_addr = channel_cfg.get("default_to") or channel_cfg.get("to") or "governance@local"
    frm = channel_cfg.get("from") or "qre-platform@local"
    logger.info("governance_email_stub from=%s to=%s event=%s", frm, to_addr, record.get("event"))
    return {"ok": True, "stub": True, "to": to_addr, "from": frm}


def emit_governance_notify(
    event: str,
    payload: Dict[str, Any],
    *,
    db: Any = None,
    workload_id: Optional[str] = None,
) -> Dict[str, Any]:
    cfg = _load_config()
    if event not in (cfg.get("events") or []):
        return {"queued": False, "reason": "event_not_subscribed"}
    channels: List[str] = []
    delivery: Dict[str, Any] = {}
    for name, ch in (cfg.get("channels") or {}).items():
        if ch.get("enabled"):
            channels.append(name)
    record = {"event": event, "channels": channels, "payload": payload}
    logger.info("governance_notify %s", record)

    if "webhook" in channels:
        wh = (cfg.get("channels") or {}).get("webhook") or {}
        delivery["webhook"] = _post_webhook(str(wh.get("url") or ""), record, cfg)

    if "email" in channels:
        em = (cfg.get("channels") or {}).get("email") or {}
        delivery["email"] = _send_email_stub(em, record)

    wh_ok = (delivery.get("webhook") or {}).get("ok") is True
    result: Dict[str, Any] = {
        "queued": True,
        "stub": not wh_ok,
        "channels": channels,
        "event": event,
        "delivery": delivery,
    }
    wid = workload_id or payload.get("workload_id")
    if db is not None and wid:
        from app.services import development_service as dev_svc

        event_type = "notify.delivered" if wh_ok else "notify.stub"
        dev_svc.append_timeline(
            db,
            str(wid),
            "governance",
            event_type,
            {
                "event": event,
                "channels": channels,
                "stub": result["stub"],
                "delivery": delivery,
            },
        )
    return result
