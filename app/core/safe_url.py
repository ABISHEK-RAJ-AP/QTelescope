"""SSRF-safe HTTP(S) URLs for operator-supplied endpoints (on-prem / ingest)."""
from __future__ import annotations

import ipaddress
from urllib.parse import urlparse

from fastapi import HTTPException

_BLOCKED_HOSTS = frozenset({
    "169.254.169.254",
    "metadata.google.internal",
    "metadata.goog",
    "instance-data",
})


def assert_safe_http_url(url: str, *, allow_loopback: bool = True) -> str:
    raw = (url or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Endpoint URL cannot be empty.")
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Endpoint URL must use http or https.")
    host = (parsed.hostname or "").lower().rstrip(".")
    if not host:
        raise HTTPException(status_code=400, detail="Endpoint URL is missing a host.")
    if host in _BLOCKED_HOSTS or host.endswith(".metadata.google.internal"):
        raise HTTPException(status_code=400, detail="That host is not allowed.")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        ip = None
    if ip is not None:
        if ip.is_link_local or str(ip) == "169.254.169.254":
            raise HTTPException(status_code=400, detail="That host is not allowed.")
        if not allow_loopback and ip.is_loopback:
            raise HTTPException(status_code=400, detail="Loopback URLs are not allowed in production.")
    elif not allow_loopback and host in ("localhost", "ip6-localhost", "ip6-loopback"):
        raise HTTPException(status_code=400, detail="Loopback URLs are not allowed in production.")
    return raw
