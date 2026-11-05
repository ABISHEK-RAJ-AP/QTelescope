"""Optional LDAP bind for directory logins.

Off unless LDAP_URL is set. Requires the ldap3 package at runtime.
This is simple bind + optional group→role map — not full AD federation/SSO.
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional
from urllib.parse import urlparse


def ldap_enabled() -> bool:
    return bool((os.getenv("LDAP_URL") or "").strip())


def ldap_public_status() -> Dict[str, Any]:
    url = (os.getenv("LDAP_URL") or "").strip()
    if not url:
        return {"enabled": False, "mode": None, "host": None, "library": _ldap3_ok()}
    host = urlparse(url).hostname or url
    mode = "search" if (os.getenv("LDAP_USER_SEARCH_BASE") or "").strip() else "dn_template"
    return {
        "enabled": True,
        "mode": mode,
        "host": host,
        "library": _ldap3_ok(),
        "default_role": (os.getenv("LDAP_DEFAULT_ROLE") or "Operator").strip() or "Operator",
    }


def _ldap3_ok() -> bool:
    try:
        import ldap3  # noqa: F401
        return True
    except ImportError:
        return False


def _role_from_groups(member_of: list[str]) -> Optional[str]:
    raw = (os.getenv("LDAP_GROUP_ROLE_MAP") or "").strip()
    if not raw:
        return None
    mapping = {}
    for part in raw.split(";"):
        if "=" not in part:
            continue
        group, role = part.split("=", 1)
        mapping[group.strip().lower()] = role.strip()
    blob = " ".join(member_of).lower()
    for group, role in mapping.items():
        if group and group in blob:
            return role
    return None


def authenticate_ldap(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Bind as the user. Returns {username, role, extra} or None."""
    if not ldap_enabled() or not username or not password:
        return None
    if not _ldap3_ok():
        raise RuntimeError("LDAP_URL is set but the ldap3 package is not installed.")

    from ldap3 import ALL, Connection, Server

    url = os.getenv("LDAP_URL", "").strip()
    start_tls = os.getenv("LDAP_START_TLS", "false").lower() in ("1", "true", "yes")
    timeout = float(os.getenv("LDAP_TIMEOUT_SECONDS", "8") or 8)
    default_role = (os.getenv("LDAP_DEFAULT_ROLE") or "Operator").strip() or "Operator"
    dn_template = (os.getenv("LDAP_USER_DN") or "").strip()
    search_base = (os.getenv("LDAP_USER_SEARCH_BASE") or "").strip()
    search_filter = (os.getenv("LDAP_USER_FILTER") or "(uid={username})").strip()
    svc_dn = (os.getenv("LDAP_BIND_DN") or "").strip()
    svc_pw = os.getenv("LDAP_BIND_PASSWORD") or ""

    server = Server(url, get_info=ALL, connect_timeout=timeout)
    user_dn = None
    attrs: Dict[str, Any] = {}

    if search_base:
        if not svc_dn:
            raise RuntimeError("LDAP_USER_SEARCH_BASE requires LDAP_BIND_DN and LDAP_BIND_PASSWORD.")
        svc = Connection(server, user=svc_dn, password=svc_pw, auto_bind=True, receive_timeout=timeout)
        fltr = search_filter.replace("{username}", username.replace(")", "").replace("(", ""))
        svc.search(search_base, fltr, attributes=["cn", "mail", "displayName", "memberOf", "uid"])
        if not svc.entries:
            svc.unbind()
            return None
        entry = svc.entries[0]
        user_dn = str(entry.entry_dn)
        attrs = {k: (list(v) if hasattr(v, "__iter__") and not isinstance(v, (str, bytes)) else str(v)) for k, v in entry.entry_attributes_as_dict.items()}
        svc.unbind()
    elif dn_template:
        user_dn = dn_template.replace("{username}", username)
    else:
        raise RuntimeError("Set LDAP_USER_DN (template) or LDAP_USER_SEARCH_BASE.")

    conn = Connection(server, user=user_dn, password=password, receive_timeout=timeout, auto_bind=False)
    conn.open()
    if start_tls:
        conn.start_tls()
    if not conn.bind():
        return None
    member_of = []
    if "memberOf" in attrs:
        raw_m = attrs.get("memberOf") or []
        member_of = raw_m if isinstance(raw_m, list) else [str(raw_m)]
    conn.unbind()

    role = _role_from_groups(member_of) or default_role
    display = ""
    if attrs.get("displayName"):
        display = attrs["displayName"][0] if isinstance(attrs["displayName"], list) else str(attrs["displayName"])
    email = ""
    if attrs.get("mail"):
        email = attrs["mail"][0] if isinstance(attrs["mail"], list) else str(attrs["mail"])
    return {
        "username": username,
        "role": role,
        "extra": {
            "email": email,
            "full_name": display or username,
            "org": os.getenv("LDAP_ORG", "Directory").strip() or "Directory",
            "auth_source": "ldap",
        },
    }
