import base64
import hashlib
import io
import json
import os
import random
import threading
import time
import uuid
import urllib.parse
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.sessions import create_session, get_session, revoke_session
from app.core.rate_limit import check_auth_rate_limit
from app.core.bootstrap_security import bootstrap_security_report, reject_if_default_bootstrap_password
from app.core import user_store

router = APIRouter(prefix="/auth", tags=["Authentication & Security"])

_LOCK = threading.Lock()
_CAPTCHA_STORE: Dict[str, Dict[str, Any]] = {}
_MFA_LOGIN_PENDING: Dict[str, Dict[str, Any]] = {}
MFA_LOGIN_TTL_SECONDS = 300
CAPTCHA_TTL_SECONDS = 300
CAPTCHA_LEN = 6
# Unambiguous glyphs only (no 0/O, 1/I/l)
CAPTCHA_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

_FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
)


def _cleanup_expired_captchas():
    now = time.time()
    expired = [cid for cid, data in _CAPTCHA_STORE.items() if data["expires_at"] < now]
    for cid in expired:
        _CAPTCHA_STORE.pop(cid, None)


def _load_font(size: int):
    try:
        from PIL import ImageFont
    except ImportError:
        return None
    for path in _FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    try:
        return ImageFont.load_default()
    except Exception:
        return None


def generate_captcha_svg(code: str) -> str:
    width, height = 220, 72
    colors = ["#1d4ed8", "#7c3aed", "#047857", "#b45309", "#b91c1c", "#4338ca"]
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#efe8d8"/>',
    ]
    for _ in range(40):
        parts.append(
            f'<circle cx="{random.randint(4, width - 4)}" cy="{random.randint(4, height - 4)}" '
            f'r="{random.uniform(0.6, 2.2)}" fill="{random.choice(["#c4b89a", "#8b7d62", "#64748b"])}" opacity="0.55"/>'
        )
    for _ in range(5):
        parts.append(
            f'<line x1="{random.randint(0, 40)}" y1="{random.randint(8, height - 8)}" '
            f'x2="{random.randint(width - 50, width)}" y2="{random.randint(8, height - 8)}" '
            f'stroke="{random.choice(colors)}" stroke-width="{random.uniform(1.1, 2.0)}" opacity="0.45"/>'
        )
    spacing = (width - 24) / max(len(code), 1)
    for i, ch in enumerate(code):
        cx = 16 + i * spacing + random.uniform(-2, 2)
        cy = random.randint(44, 52)
        rot = random.randint(-22, 22)
        parts.append(
            f'<text x="{cx}" y="{cy}" font-family="DejaVu Sans, Liberation Sans, sans-serif" '
            f'font-size="{random.randint(26, 32)}" font-weight="700" fill="{colors[i % len(colors)]}" '
            f'transform="rotate({rot}, {cx}, {cy})">{ch}</text>'
        )
    parts.append("</svg>")
    return "data:image/svg+xml;utf8," + urllib.parse.quote("".join(parts))


def generate_captcha_image(code: str) -> str:
    """Alphanumeric PNG captcha. Falls back to SVG if Pillow is missing."""
    try:
        from PIL import Image, ImageDraw, ImageFilter
    except ImportError:
        return generate_captcha_svg(code)

    width, height = 220, 72
    bg = (239, 232, 216)
    img = Image.new("RGB", (width, height), bg)
    draw = ImageDraw.Draw(img)

    for _ in range(90):
        x, y = random.randint(0, width - 1), random.randint(0, height - 1)
        r = random.randint(0, 2)
        draw.ellipse((x, y, x + r, y + r), fill=random.choice([(180, 168, 140), (120, 110, 90), (90, 110, 140)]))

    for _ in range(6):
        draw.line(
            (
                random.randint(0, 40),
                random.randint(6, height - 6),
                random.randint(width - 50, width),
                random.randint(6, height - 6),
            ),
            fill=random.choice([(29, 78, 216), (124, 58, 237), (4, 120, 87), (180, 83, 9)]),
            width=random.randint(1, 2),
        )

    palette = [(29, 78, 216), (124, 58, 237), (4, 120, 87), (180, 83, 9), (185, 28, 28), (67, 56, 202)]
    spacing = (width - 20) / max(len(code), 1)
    for i, ch in enumerate(code):
        font = _load_font(random.randint(28, 34))
        glyph = Image.new("RGBA", (48, 56), (0, 0, 0, 0))
        gdraw = ImageDraw.Draw(glyph)
        fill = palette[i % len(palette)] + (255,)
        gdraw.text((6, 4), ch, font=font, fill=fill)
        rotated = glyph.rotate(random.randint(-24, 24), resample=Image.BICUBIC, expand=True)
        x = int(8 + i * spacing + random.uniform(-3, 3))
        y = int(random.uniform(4, 14))
        img.paste(rotated, (x, y), rotated)

    img = img.filter(ImageFilter.SMOOTH)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _consume_captcha(captcha_id: str, captcha_code: str) -> None:
    if not captcha_id or not captcha_code:
        raise HTTPException(status_code=400, detail="Image verification is required.")
    with _LOCK:
        _cleanup_expired_captchas()
        stored = _CAPTCHA_STORE.get(captcha_id)
        if not stored:
            raise HTTPException(status_code=400, detail="Challenge expired. Request a new image.")
        expected = stored["code"]
        _CAPTCHA_STORE.pop(captcha_id, None)
    if captcha_code.strip().upper() != expected.upper():
        raise HTTPException(status_code=400, detail="Characters do not match the image. Try a new one.")


def _hash_password(password: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        settings.SECRET_KEY.encode("utf-8"),
        120_000,
    ).hex()


class CaptchaResponse(BaseModel):
    captcha_id: str
    captcha_image: str
    expires_in_seconds: int


class VerifyCaptchaRequest(BaseModel):
    captcha_id: str
    captcha_code: str


class LoginRequest(BaseModel):
    username: str
    password: str
    captcha_id: str
    captcha_code: str
    role: Optional[str] = None


class MfaLoginRequest(BaseModel):
    mfa_token: str
    code: str = Field(min_length=6, max_length=32)


class RegisterRequest(BaseModel):
    username: str
    password: str = Field(min_length=6)
    full_name: Optional[str] = ""
    email: str
    org: Optional[str] = "C-DAC"
    role: Optional[str] = "Operator"
    captcha_id: str
    captcha_code: str


class AuthStatusResponse(BaseModel):
    enable_mock_data: bool
    project_name: str
    version: str
    bootstrap: dict


@router.get("/config-status", response_model=AuthStatusResponse)
def get_config_status():
    return AuthStatusResponse(
        enable_mock_data=settings.ENABLE_MOCK_DATA,
        project_name=settings.PROJECT_NAME,
        version=settings.VERSION,
        bootstrap=bootstrap_security_report(settings.ADMIN_USERNAME, settings.USER_USERNAME),
    )


@router.get("/captcha", response_model=CaptchaResponse)
def get_new_captcha():
    code = "".join(random.choices(CAPTCHA_CHARS, k=CAPTCHA_LEN))
    captcha_id = f"cap_{uuid.uuid4().hex[:12]}"
    with _LOCK:
        _cleanup_expired_captchas()
        _CAPTCHA_STORE[captcha_id] = {
            "code": code,
            "expires_at": time.time() + CAPTCHA_TTL_SECONDS,
        }
    return CaptchaResponse(
        captcha_id=captcha_id,
        captcha_image=generate_captcha_image(code),
        expires_in_seconds=CAPTCHA_TTL_SECONDS,
    )


@router.post("/verify-captcha")
def verify_captcha(req: VerifyCaptchaRequest):
    _consume_captcha(req.captcha_id, req.captcha_code)
    return {"status": "SUCCESS", "message": "Image challenge accepted."}


def _issue_session(username: str, role: str, extra: Optional[Dict[str, Any]] = None):
    from app.core.tenant import _slug_tenant, default_tenant_id

    payload = dict(extra or {})
    payload.setdefault("tenant_id", _slug_tenant(str(payload.get("org") or default_tenant_id())))
    token = create_session(username, role, payload)
    user = {
        "username": username,
        "role": role,
        "token": token,
        "loginTime": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    if extra:
        user.update({k: v for k, v in extra.items() if k not in ("token", "role", "username")})
    return {"status": "SUCCESS", "message": "Authentication successful.", "user": user}


@router.post("/register")
def register_user(req: RegisterRequest, request: Request):
    check_auth_rate_limit(request, "register")
    _consume_captcha(req.captcha_id, req.captcha_code)
    username = req.username.strip()
    email = req.email.strip().lower()
    if not username or not email:
        raise HTTPException(status_code=400, detail="Username and email are required.")
    if username in (settings.ADMIN_USERNAME, settings.USER_USERNAME):
        raise HTTPException(status_code=409, detail="That username is reserved.")

    role = (req.role or "Operator").strip()
    if role == "Admin":
        raise HTTPException(
            status_code=403,
            detail="Admin accounts cannot be self-registered. Contact a platform administrator.",
        )
    if role not in ("Operator", "Researcher"):
        role = "Operator"

    with _LOCK:
        users = user_store.load_all_users()
        if username in users:
            raise HTTPException(status_code=409, detail="Username already registered.")
        if any(u.get("email") == email for u in users.values()):
            raise HTTPException(status_code=409, detail="Email already registered.")
        user_store.upsert_user(
            username,
            {
                "username": username,
                "email": email,
                "full_name": (req.full_name or username).strip(),
                "org": (req.org or "C-DAC").strip(),
                "role": role,
                "password_hash": _hash_password(req.password),
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        )

    return {
        "status": "SUCCESS",
        "message": "Account created. Sign in with your username and password.",
        "user": {"username": username, "role": role, "email": email},
    }


@router.post("/login")
def authenticate_user(req: LoginRequest, request: Request):
    username = req.username.strip()
    password = req.password.strip()
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required.")

    check_auth_rate_limit(request, "login")
    _consume_captcha(req.captcha_id, req.captcha_code)
    reject_if_default_bootstrap_password(
        username, password, settings.ADMIN_USERNAME, settings.USER_USERNAME
    )

    if username == settings.ADMIN_USERNAME and password == settings.ADMIN_PASSWORD:
        return _issue_session(username, "Admin", {"email": "", "full_name": "Platform Admin", "org": "C-DAC"})
    if username == settings.USER_USERNAME and password == settings.USER_PASSWORD:
        return _issue_session(username, "Operator", {"email": "", "full_name": "Researcher", "org": "C-DAC"})

    with _LOCK:
        users = user_store.load_all_users()
        record = users.get(username)
    if record and record.get("password_hash") == _hash_password(password):
        return _issue_session(
            username,
            record.get("role") or "Operator",
            {
                "email": record.get("email", ""),
                "full_name": record.get("full_name", username),
                "org": record.get("org", "C-DAC"),
            },
        )

    raise HTTPException(status_code=401, detail="Invalid username or password.")


@router.get("/me")
def get_me(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    x_user_name: Optional[str] = Header(None, alias="X-User-Name"),
    x_qre_dev_ack: Optional[str] = Header(None, alias="X-QRE-Dev-Ack"),
):
    from app.core.permissions import ROLE_LABELS, permissions_for_role
    from app.core.rbac import rbac_enforced

    if (not authorization or not authorization.lower().startswith("bearer ")) and not rbac_enforced():
        if x_qre_dev_ack == "1" and x_user_role:
            role = x_user_role.strip()
            return {
                "authenticated": False,
                "dev_session": True,
                "username": (x_user_name or role).strip(),
                "role": role,
                "role_label": ROLE_LABELS.get(role, role),
                "permissions": sorted(permissions_for_role(role)),
                "org": "Development",
                "tenant_id": "default",
            }
        return {"authenticated": False}
    if not authorization or not authorization.lower().startswith("bearer "):
        return {"authenticated": False}
    sess = get_session(authorization[7:].strip())
    if not sess:
        return {"authenticated": False}
    from app.core.permissions import permissions_for_role, ROLE_LABELS
    from app.core.user_store import load_all_users

    from app.core.tenant import tenant_from_session_record

    username = sess.get("username")
    role = sess.get("role") or "Operator"
    rec = load_all_users().get(username) or {}
    return {
        "authenticated": True,
        "username": username,
        "role": role,
        "role_label": ROLE_LABELS.get(role, role),
        "permissions": sorted(permissions_for_role(role)),
        "full_name": rec.get("full_name") or sess.get("full_name") or username,
        "email": rec.get("email") or sess.get("email") or "",
        "org": rec.get("org") or sess.get("org") or "",
        "tenant_id": tenant_from_session_record(sess),
        "expires_at": sess.get("expires_at"),
    }


@router.post("/logout")
def logout_user(authorization: Optional[str] = Header(None, alias="Authorization")):
    if authorization and authorization.lower().startswith("bearer "):
        revoke_session(authorization[7:].strip())
    return {"status": "SUCCESS", "message": "Signed out."}


def _self_check():
    code = "A3K7P2"
    uri = generate_captcha_image(code)
    assert uri.startswith("data:image/"), uri[:40]
    assert len(code) == CAPTCHA_LEN


if __name__ == "__main__":
    _self_check()
    print("captcha image ok")
