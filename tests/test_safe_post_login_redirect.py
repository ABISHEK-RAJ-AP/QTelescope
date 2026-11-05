"""Python mirror of frontend/src/lib/safePostLoginRedirect.js — keep in sync."""


def safe_post_login_redirect(raw, origin="http://127.0.0.1:4173"):
    if not raw or not isinstance(raw, str):
        return None
    value = raw.strip()
    if not value:
        return None
    if value.startswith("/app") and not value.startswith("//") and "://" not in value:
        return value
    from urllib.parse import urlparse

    try:
        u = urlparse(value)
        if not u.scheme:
            return None
        if f"{u.scheme}://{u.netloc}" == origin and u.path.startswith("/app"):
            return f"{u.path}{u.query and '?' + u.query or ''}{u.fragment and '#' + u.fragment or ''}"
    except Exception:
        return None
    return None


def test_blocks_external_open_redirect():
    assert safe_post_login_redirect("https://evil.example/phish") is None
    assert safe_post_login_redirect("//evil.example") is None
    assert safe_post_login_redirect("/login") is None
    assert safe_post_login_redirect("/app/overview") == "/app/overview"
    assert safe_post_login_redirect("http://127.0.0.1:4173/app/operate") == "/app/operate"
