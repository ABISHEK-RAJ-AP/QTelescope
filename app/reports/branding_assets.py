"""Embed repo brand marks in standalone HTML reports (data URIs for print/PDF)."""

from __future__ import annotations

import base64
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]

_LOGO_CANDIDATES = (
    ("frontend/public/logos/cdac-brand.svg", "image/svg+xml", "report-logo--cdac", "Centre for Development of Advanced Computing (C-DAC)"),
    ("frontend/public/brand/q-telescope-lockup-light.png", "image/png", "report-logo--qt", "Q-TeleScope"),
    ("frontend/public/favicon.svg", "image/svg+xml", "report-logo--qt", "Q-TeleScope"),
)


def _data_uri(rel: str, mime: str) -> str:
    path = _REPO_ROOT / rel
    if not path.is_file():
        return ""
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def report_brand_marks_html() -> str:
    # ponytail: try Q-TeleScope PNG first; favicon SVG fallback when brand PNG not in tree
    imgs: list[str] = []
    qt_done = False
    for rel, mime, css_class, alt in _LOGO_CANDIDATES:
        if css_class.endswith("--qt") and qt_done:
            continue
        uri = _data_uri(rel, mime)
        if not uri:
            continue
        if css_class.endswith("--qt"):
            qt_done = True
        height = "34" if "cdac" in css_class else "30"
        imgs.append(
            f'<img class="report-logo {css_class}" src="{uri}" alt="{alt}" height="{height}" decoding="async" />'
        )
    if not imgs:
        return (
            '<div class="head-logos head-logos--text">'
            '<span class="head-logos__cdac">C-DAC</span>'
            '<span class="head-logos__sep" aria-hidden="true">·</span>'
            '<span class="head-logos__qt">Q-TeleScope</span>'
            "</div>"
        )
    return f'<div class="head-logos">{"".join(imgs)}</div>'