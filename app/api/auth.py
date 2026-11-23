import base64
import hashlib
import hmac
import io
import json
import os
import random
import secrets
import threading
import time
import urllib.parse
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.env_profile import env_flag, is_production_profile
from app.core.sessions import create_session, get_session, revoke_session
from app.core.rate_limit import check_auth_rate_limit
from app.core.bootstrap_security import bootstrap_security_report, reject_if_default_bootstrap_password
from app.core import user_store
from app.core.identity import bound_password, normalize_email, normalize_username

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


E2E_CAPTCHA_BYPASS_CODE = "BYPASS"


def e2e_captcha_bypass_enabled() -> bool:
    """Playwright-only: never enabled on production profile."""
    return env_flag("E2E_CAPTCHA_BYPASS", default=False) and not is_production_profile()


def _consume_captcha(captcha_id: str, captcha_code: str) -> None:
    if not captcha_id or not captcha_code:
        raise HTTPException(status_code=400, detail="Image verification is required.")
    if e2e_captcha_bypass_enabled() and captcha_code.strip().upper() == E2E_CAPTCHA_BYPASS_CODE:
        return
    with _LOCK:
        _cleanup_expired_captchas()
        stored = _CAPTCHA_STORE.get(captcha_id)
        if not stored:
            raise HTTPException(status_code=400, detail="Challenge expired. Request a new image.")
        expected = stored["code"]
        _CAPTCHA_STORE.pop(captcha_id, None)
    got = captcha_code.strip().upper()
    want = expected.upper()
    if len(got) != len(want) or not hmac.compare_digest(got, want):
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
    username: str = Field(max_length=32)
    password: str = Field(max_length=256)
    captcha_id: str = ""
    captcha_code: str = ""


class MfaLoginRequest(BaseModel):
    mfa_token: str
    code: str = Field(min_length=6, max_length=32)


class ForgotPasswordRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    captcha_id: str = ""
    captcha_code: str = ""


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=8)
    new_password: str = Field(min_length=6)
    confirm_password: str = Field(min_length=6)
    captcha_id: str = ""
    captcha_code: str = ""


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=256)
    full_name: Optional[str] = Field(default="", max_length=120)
    email: str = Field(max_length=254)
    org: Optional[str] = Field(default="C-DAC", max_length=80)
    role: Optional[str] = "Operator"
    captcha_id: str
    captcha_code: str


class RegisterConfirmRequest(BaseModel):
    otp_session_id: str = Field(min_length=8, max_length=128)
    otp_code: str = Field(min_length=4, max_length=16)


class AuthStatusResponse(BaseModel):
    enable_mock_data: bool
    project_name: str
    version: str
    bootstrap: dict
    ldap: dict = {}
    allow_public_registration: bool = True
    registration_require_admin_approval: bool = False
    registration_org_options: list = []
    registration_otp_email: bool = False


@router.get("/config-status", response_model=AuthStatusResponse)
def get_config_status():
    from app.core.ldap_auth import ldap_public_status
    from app.core.mail_delivery import registration_otp_delivery, registration_smtp_ready
    from app.core.registration_policy import (
        public_registration_allowed,
        registration_org_options,
        registration_requires_admin_approval,
    )

    return AuthStatusResponse(
        enable_mock_data=settings.ENABLE_MOCK_DATA,
        project_name=settings.PROJECT_NAME,
        version=settings.VERSION,
        bootstrap=bootstrap_security_report(
            settings.ADMIN_USERNAME,
            settings.USER_USERNAME,
            settings.SUPERADMIN_USERNAME,
        ),
        ldap=ldap_public_status(),
        allow_public_registration=public_registration_allowed(),
        registration_require_admin_approval=registration_requires_admin_approval(),
        registration_org_options=registration_org_options(),
        registration_otp_email=registration_smtp_ready(),
    )


@router.get("/registration-options")
def get_registration_options():
    from app.core.mail_delivery import registration_otp_delivery, registration_smtp_ready
    from app.core.registration_policy import (
        public_registration_allowed,
        registered_organisation_names,
        registration_org_options,
        registration_requires_admin_approval,
    )

    return {
        "allow_public_registration": public_registration_allowed(),
        "require_admin_approval": registration_requires_admin_approval(),
        "org_options": registration_org_options(),
        "registered_orgs": registered_organisation_names(),
        "otp_delivery": registration_otp_delivery(),
    }


@router.get("/captcha", response_model=CaptchaResponse)
def get_new_captcha():
    code = "".join(random.choices(CAPTCHA_CHARS, k=CAPTCHA_LEN))
    captcha_id = f"cap_{secrets.token_urlsafe(12)}"
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


def _maybe_mfa_or_session(username: str, role: str, extra: Optional[Dict[str, Any]] = None):
    from app.core.user_mfa import mfa_status

    if mfa_status(username).get("enabled"):
        mfa_token = f"mfa_{secrets.token_urlsafe(32)}"
        with _LOCK:
            expired = [k for k, v in _MFA_LOGIN_PENDING.items() if v.get("expires_at", 0) < time.time()]
            for k in expired:
                _MFA_LOGIN_PENDING.pop(k, None)
            _MFA_LOGIN_PENDING[mfa_token] = {
                "username": username,
                "role": role,
                "extra": extra or {},
                "expires_at": time.time() + MFA_LOGIN_TTL_SECONDS,
            }
        return {
            "status": "MFA_REQUIRED",
            "message": "Enter the authenticator code.",
            "mfa_token": mfa_token,
            "expires_in_seconds": MFA_LOGIN_TTL_SECONDS,
        }
    return _issue_session(username, role, extra)


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


def _registration_success_message(*, pending_admin: bool) -> str:
    if pending_admin:
        return (
            "Registration received. Your account is pending administrator approval. "
            "You can sign in after an admin approves your request in Administration → Access & approvals."
        )
    return (
        "Account created. Sign in with your username and password. "
        "Your organisation admin can change your role in Admin → Users & roles."
    )


@router.post("/register/send-otp")
def register_send_otp(req: RegisterRequest, request: Request):
    from app.core.mail_delivery import (
        deliver_registration_otp,
        registration_otp_delivery,
        registration_smtp_ready,
    )
    from app.core.registration_flow import validate_new_account_fields
    from app.core.registration_otp import issue_registration_otp
    from app.core.registration_policy import public_registration_allowed, registration_screen_otp_exposed

    if not public_registration_allowed():
        raise HTTPException(
            status_code=403,
            detail="Public registration is disabled on this deployment. Contact your platform administrator.",
        )
    check_auth_rate_limit(request, "register_send_otp")
    _consume_captcha(req.captcha_id, req.captcha_code)
    from app.core.registration_flow import assert_org_open_for_self_registration

    assert_org_open_for_self_registration((req.org or "").strip())
    username, email, role = validate_new_account_fields(
        username=req.username,
        email=req.email,
        password=req.password,
        role=req.role,
    )
    payload = {
        "username": username,
        "email": email,
        "full_name": (req.full_name or username).strip(),
        "org": (req.org or "C-DAC").strip(),
        "role": role,
        "password_hash": _hash_password(req.password),
    }
    session_id, otp_code, ttl = issue_registration_otp(email=email, payload=payload)
    delivery_mode = registration_otp_delivery()
    out: Dict[str, Any] = {
        "status": "SUCCESS",
        "otp_session_id": session_id,
        "expires_in_seconds": ttl,
    }
    # ENABLE_MOCK_DATA / REGISTRATION_OTP_DELIVERY=screen never use SMTP for registration OTP.
    use_email = (
        delivery_mode == "email"
        and registration_smtp_ready()
        and not settings.ENABLE_MOCK_DATA
    )
    if use_email:
        ok, err = deliver_registration_otp(
            to_email=email,
            username=username,
            code=otp_code,
            ttl_minutes=max(1, ttl // 60),
        )
        if not ok:
            raise HTTPException(status_code=503, detail=err or "Unable to send verification email.")
        out["delivery"] = "email"
        out["message"] = "Enter the verification code sent to your email."
    else:
        if not registration_screen_otp_exposed():
            raise HTTPException(
                status_code=503,
                detail=(
                    "Registration email is not configured on this deployment. "
                    "Contact your platform administrator."
                ),
            )
        out["delivery"] = "screen"
        out["screen_otp"] = otp_code
        out["message"] = "Enter the verification code shown in the toast and the box below."
    return out


@router.post("/register/confirm")
def register_confirm(body: RegisterConfirmRequest, request: Request):
    from app.core.registration_flow import registration_user_record
    from app.core.registration_otp import consume_registration_otp
    from app.core.registration_policy import public_registration_allowed, registration_requires_admin_approval

    if not public_registration_allowed():
        raise HTTPException(status_code=403, detail="Public registration is disabled on this deployment.")
    check_auth_rate_limit(request, "register_confirm")
    payload = consume_registration_otp(body.otp_session_id, body.otp_code)
    if not payload:
        raise HTTPException(status_code=400, detail="Verification code is invalid or expired.")
    username = payload["username"]
    pending = registration_requires_admin_approval()
    status = "pending_admin" if pending else "active"
    record = registration_user_record(
        username=username,
        email=payload["email"],
        full_name=payload.get("full_name") or username,
        org=payload.get("org") or "C-DAC",
        role=payload.get("role") or "Operator",
        password_hash=payload["password_hash"],
        account_status=status,
    )
    with _LOCK:
        users = user_store.load_all_users()
        if username in users:
            raise HTTPException(status_code=409, detail="Username already registered.")
        user_store.upsert_user(username, record)

    return {
        "status": "SUCCESS",
        "pending_admin_approval": pending,
        "account_status": status,
        "message": _registration_success_message(pending_admin=pending),
        "user": {"username": username, "role": record["role"], "email": record["email"]},
    }


@router.post("/register")
def register_user(req: RegisterRequest, request: Request):
    """Legacy single-step register — disabled; use send-otp then confirm."""
    from app.core.registration_policy import public_registration_allowed

    if not public_registration_allowed():
        raise HTTPException(
            status_code=403,
            detail="Public registration is disabled on this deployment. Contact your platform administrator.",
        )
    check_auth_rate_limit(request, "register")
    raise HTTPException(
        status_code=400,
        detail="Complete email verification first. Submit the form to receive a code, then confirm with /auth/register/confirm.",
    )


@router.post("/login")
def authenticate_user(req: LoginRequest, request: Request):
    username = (req.username or "").strip()
    password = req.password or ""
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required.")
    if len(password) > 256:
        raise HTTPException(status_code=400, detail="Password is too long.")

    check_auth_rate_limit(request, "login")
    _consume_captcha(req.captcha_id, req.captcha_code)
    reject_if_default_bootstrap_password(
        username,
        password,
        settings.ADMIN_USERNAME,
        settings.USER_USERNAME,
        settings.SUPERADMIN_USERNAME,
    )

    def _pw_eq(left: str, right: str) -> bool:
        a, b = (left or "").encode("utf-8"), (right or "").encode("utf-8")
        if len(a) != len(b):
            hmac.compare_digest(a, a)
            return False
        return hmac.compare_digest(a, b)

    if _pw_eq(username, settings.SUPERADMIN_USERNAME) and _pw_eq(password, settings.SUPERADMIN_PASSWORD):
        return _maybe_mfa_or_session(
            username,
            "PlatformAdmin",
            {"email": "", "full_name": "Platform Administrator", "org": "C-DAC"},
        )
    if _pw_eq(username, settings.ADMIN_USERNAME) and _pw_eq(password, settings.ADMIN_PASSWORD):
        return _maybe_mfa_or_session(username, "Admin", {"email": "", "full_name": "Platform Admin", "org": "C-DAC"})
    if _pw_eq(username, settings.USER_USERNAME) and _pw_eq(password, settings.USER_PASSWORD):
        return _maybe_mfa_or_session(username, "Operator", {"email": "", "full_name": "Researcher", "org": "C-DAC"})

    with _LOCK:
        users = user_store.load_all_users()
        record = users.get(username)
    candidate = _hash_password(password)
    stored = str((record or {}).get("password_hash") or "")
    if record and stored and hmac.compare_digest(stored, candidate):
        from app.core.registration_flow import account_status_login_message

        login_block = account_status_login_message(record.get("account_status"))
        if login_block:
            raise HTTPException(status_code=403, detail=login_block)
        return _maybe_mfa_or_session(
            username,
            record.get("role") or "Operator",
            {
                "email": record.get("email", ""),
                "full_name": record.get("full_name", username),
                "org": record.get("org", "C-DAC"),
            },
        )

    from app.core.ldap_auth import authenticate_ldap, ldap_enabled
    if ldap_enabled():
        try:
            ldap_user = authenticate_ldap(username, password)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        if ldap_user:
            return _maybe_mfa_or_session(ldap_user["username"], ldap_user["role"], ldap_user.get("extra"))

    raise HTTPException(status_code=401, detail="Invalid username or password.")


@router.post("/login/mfa")
def complete_mfa_login(req: MfaLoginRequest, request: Request):
    check_auth_rate_limit(request, "login_mfa")
    with _LOCK:
        pending = _MFA_LOGIN_PENDING.pop(req.mfa_token, None)
        if pending and pending.get("expires_at", 0) < time.time():
            pending = None
    if not pending:
        raise HTTPException(status_code=401, detail="Authenticator step expired. Sign in again.")
    from app.core.user_mfa import verify_login_code

    if not verify_login_code(pending["username"], req.code):
        with _LOCK:
            _MFA_LOGIN_PENDING[req.mfa_token] = pending
        raise HTTPException(status_code=401, detail="Invalid authenticator code.")
    return _issue_session(pending["username"], pending["role"], pending.get("extra"))


_FORGOT_MSG = "If an account exists for that identity, a reset link was issued."


@router.post("/password/forgot")
def forgot_password(req: ForgotPasswordRequest, request: Request):
    from app.core.env_profile import is_production_profile
    from app.core.password_reset import issue_reset_token

    check_auth_rate_limit(request, "password_forgot")
    _consume_captcha(req.captcha_id, req.captcha_code)
    username = (req.username or "").strip()
    email = (req.email or "").strip().lower()
    found = None
    users = user_store.load_all_users()
    if username and username in users:
        found = username
    elif email:
        for uname, rec in users.items():
            if (rec.get("email") or "").strip().lower() == email:
                found = uname
                break
    payload = {"status": "SUCCESS", "message": _FORGOT_MSG}
    if found:
        token = issue_reset_token(found)
        if is_production_profile():
            from app.core.mail_delivery import deliver_password_reset, password_reset_smtp_ready

            if password_reset_smtp_ready():
                rec = users.get(found) or {}
                to_email = (rec.get("email") or "").strip()
                if to_email:
                    deliver_password_reset(username=found, to_email=to_email, token=token)
        else:
            payload["dev_reset_token"] = token
    return payload


@router.post("/password/reset")
def reset_password(req: ResetPasswordRequest, request: Request):
    from app.core.password_reset import consume_reset_token
    from app.core.sessions import revoke_all_sessions_for_user
    from app.core.audit_log import record_audit

    check_auth_rate_limit(request, "password_reset")
    _consume_captcha(req.captcha_id, req.captcha_code)
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Password confirmation does not match.")
    username = consume_reset_token(req.token)
    if not username:
        raise HTTPException(status_code=400, detail="Reset link is invalid or expired.")
    users = user_store.load_all_users()
    rec = dict(users.get(username) or {"username": username})
    rec["password_hash"] = _hash_password(req.new_password)
    user_store.upsert_user(username, rec)
    revoke_all_sessions_for_user(username)
    record_audit("password.reset", actor=username, resource_type="user", resource_id=username)
    return {"status": "SUCCESS", "message": "Password updated. Sign in with the new password."}


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


class StreamTicketResponse(BaseModel):
    stream_ticket: str
    expires_in: int
    stream_path: str


@router.post("/stream-ticket", response_model=StreamTicketResponse)
def issue_sse_stream_ticket(authorization: Optional[str] = Header(None, alias="Authorization")):
    """Opaque short-lived ticket for EventSource — session token stays out of URLs."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer session required.")
    token = authorization[7:].strip()
    sess = get_session(token)
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    from app.core.stream_tickets import issue_stream_ticket

    try:
        ticket, ttl = issue_stream_ticket(token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return StreamTicketResponse(
        stream_ticket=ticket,
        expires_in=ttl,
        stream_path=f"{settings.API_V1_STR}/events/stream",
    )


@router.post("/logout")
def logout_user(authorization: Optional[str] = Header(None, alias="Authorization")):
    # Always succeed — client clears local session even if the token is already gone.
    try:
        if authorization and authorization.lower().startswith("bearer "):
            revoke_session(authorization[7:].strip())
    except Exception:
        pass
    return {"status": "SUCCESS", "message": "Signed out."}


def _self_check():
    code = "A3K7P2"
    uri = generate_captcha_image(code)
    assert uri.startswith("data:image/"), uri[:40]
    assert len(code) == CAPTCHA_LEN


if __name__ == "__main__":
    _self_check()
    print("captcha image ok")
