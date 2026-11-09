import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os

_startup_log = logging.getLogger("app.startup")

from app.core.config import settings
from app.core.api_auth import ApiAuthMiddleware
from app.core.request_id import RequestIdMiddleware, request_id_for
from app.core.security_headers import SecurityHeadersMiddleware
from app.core.env_profile import is_production_profile
from app.core.database import Base, engine, SessionLocal
import app.models.entities  # Ensure all models are registered on Base.metadata
import app.models.development  # noqa: F401 — Build workspace tables
from app.discovery.hardware_discovery import HardwareDiscoveryEngine
from app.workers.collection_scheduler import collection_scheduler_loop, scheduler_enabled
from app.api import (
    backends, qubits, calibration, drift, queues, jobs, health, alerts, admin,
    reports, events, auth, environment, incidents, operations, topology, evidence, metrics, infra,
    federated,
    anomalies,
    replay,
    research,
    users,
    device_capabilities,
)
from app.api.development.router import router as development_router
from app.api.governance.approvals import router as governance_approvals_router
from app.api.governance.approvals import summary_router as governance_summary_router
from app.api.governance.quotas import router as governance_quotas_router
from app.api.governance.capacity import router as governance_capacity_router
from app.api.governance.audit import router as governance_audit_router
from app.api.governance.reservations import router as governance_reservations_router

def ensure_runtime_directories():
    if settings.DATABASE_URL.startswith("sqlite:///./"):
        os.makedirs("data", exist_ok=True)


ensure_runtime_directories()

def execute_startup_hardware_discovery():
    """Autonomous zero-touch hardware discovery on startup."""
    db = SessionLocal()
    try:
        HardwareDiscoveryEngine.run_auto_discovery(db)
    finally:
        db.close()

seed_initial_telemetry = execute_startup_hardware_discovery


def _log_prod_security_warnings() -> None:
    if not is_production_profile():
        return
    from app.core.rbac import rbac_enforced
    from app.core.sessions import require_api_auth
    from app.core.bootstrap_security import block_default_bootstrap_enabled

    if not rbac_enforced():
        _startup_log.warning(
            "Production profile but ENFORCE_RBAC=false — set ENFORCE_RBAC=true for VAPT."
        )
    if not require_api_auth():
        _startup_log.warning(
            "Production profile but REQUIRE_API_AUTH=false — set REQUIRE_API_AUTH=true for VAPT."
        )
    if not block_default_bootstrap_enabled():
        _startup_log.warning(
            "Production profile but BLOCK_DEFAULT_BOOTSTRAP_CREDENTIALS=false — disable default passwords."
        )
    if settings.SECRET_KEY in ("cdac_quantum_telemetry_secret_key_2026", "your_secret_key_here", ""):
        _startup_log.error(
            "Production profile using insecure default SECRET_KEY — rotate before VAPT/go-live."
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.schema import apply_schema

    apply_schema(engine)
    _log_prod_security_warnings()
    execute_startup_hardware_discovery()
    stop = asyncio.Event()
    sched_task = None
    if scheduler_enabled():
        sched_task = asyncio.create_task(collection_scheduler_loop(stop))
    from app.facility.mqtt_subscriber import start_mqtt_subscriber, stop_mqtt_subscriber

    start_mqtt_subscriber()
    from app.workers.simulation_runner import start_simulation_runner, stop_simulation_runner

    start_simulation_runner()
    yield
    stop_simulation_runner()
    stop_mqtt_subscriber()
    stop.set()
    if sched_task is not None:
        await sched_task

_docs_url = None if is_production_profile() else "/docs"
_redoc_url = None if is_production_profile() else "/redoc"
_openapi_url = None if is_production_profile() else f"{settings.API_V1_STR}/openapi.json"

def _error_body(request: Request, status: int, message: str, code: str | None = None, details=None) -> dict:
    body = {
        "error": {
            "code": code or f"HTTP_{status}",
            "message": message,
            "request_id": request_id_for(request),
        }
    }
    if details is not None:
        body["error"]["details"] = details
    return body


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=_openapi_url,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    description="Quantum Runtime Telemetry, Multi-Hardware Auto-Discovery, and Monitoring Platform",
    lifespan=lifespan
)


@app.exception_handler(HTTPException)
async def _http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, str):
        message = detail
        details = None
    else:
        message = "Request could not be completed."
        details = detail
    payload = _error_body(request, exc.status_code, message, details=details)
    return JSONResponse(
        status_code=exc.status_code,
        content=payload,
        headers={"X-Request-Id": request_id_for(request)},
    )


@app.exception_handler(RequestValidationError)
async def _validation_exception_handler(request: Request, exc: RequestValidationError):
    payload = _error_body(
        request,
        422,
        "Validation failed.",
        code="VALIDATION_ERROR",
        details=exc.errors(),
    )
    return JSONResponse(
        status_code=422,
        content=payload,
        headers={"X-Request-Id": request_id_for(request)},
    )


# Outermost → innermost: SecurityHeaders wraps responses after CORS/Auth.
app.add_middleware(SecurityHeadersMiddleware)
# Auth runs inside CORS so 401/preflight responses still get Access-Control-* headers.
app.add_middleware(ApiAuthMiddleware)

_dev_cors_default = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:5174,http://127.0.0.1:5174,"
    "http://localhost:5175,http://127.0.0.1:5175,"
    "http://localhost:4173,http://127.0.0.1:4173"
)
# Production must set CORS_ORIGINS explicitly — never default to *
if is_production_profile():
    _cors_raw = os.getenv("CORS_ORIGINS", "").strip()
    if not _cors_raw or _cors_raw == "*":
        _startup_log.warning(
            "Production CORS_ORIGINS empty or '*' — set explicit UI origin(s) for VAPT."
        )
        _cors_raw = _cors_raw if _cors_raw and _cors_raw != "*" else ""
else:
    _cors_raw = os.getenv("CORS_ORIGINS", _dev_cors_default).strip()
if _cors_raw == "*":
    _cors_origins = ["*"]
    _cors_credentials = False
elif not _cors_raw:
    _cors_origins = _dev_cors_default.split(",") if not is_production_profile() else []
    _cors_credentials = bool(_cors_origins)
else:
    _cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
    _cors_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_credentials,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-User-Role", "X-User-Name", "X-QRE-Dev-Ack", "Accept", "X-Request-Id"],
)
app.add_middleware(RequestIdMiddleware)

# Include API Routers
app.include_router(backends.router, prefix=settings.API_V1_STR)
app.include_router(device_capabilities.router, prefix=settings.API_V1_STR)
app.include_router(topology.router, prefix=settings.API_V1_STR)
app.include_router(qubits.router, prefix=settings.API_V1_STR)
app.include_router(calibration.router, prefix=settings.API_V1_STR)
app.include_router(drift.router, prefix=settings.API_V1_STR)
app.include_router(queues.router, prefix=settings.API_V1_STR)
app.include_router(jobs.router, prefix=settings.API_V1_STR)
app.include_router(health.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(incidents.router, prefix=settings.API_V1_STR)
app.include_router(operations.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(evidence.router, prefix=settings.API_V1_STR)
app.include_router(metrics.router, prefix=settings.API_V1_STR)
app.include_router(infra.router, prefix=settings.API_V1_STR)
app.include_router(federated.router, prefix=settings.API_V1_STR)
app.include_router(anomalies.router, prefix=settings.API_V1_STR)
app.include_router(replay.router, prefix=settings.API_V1_STR)
app.include_router(research.router, prefix=settings.API_V1_STR)
app.include_router(events.router, prefix=settings.API_V1_STR)
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(environment.router, prefix=settings.API_V1_STR)
app.include_router(development_router, prefix=settings.API_V1_STR)
app.include_router(governance_approvals_router, prefix=settings.API_V1_STR)
app.include_router(governance_summary_router, prefix=settings.API_V1_STR)
app.include_router(governance_quotas_router, prefix=settings.API_V1_STR)
app.include_router(governance_capacity_router, prefix=settings.API_V1_STR)
app.include_router(governance_audit_router, prefix=settings.API_V1_STR)
app.include_router(governance_reservations_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "platform": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR
    }


# QRP portal Settings → Health probes (Vite proxies /healthz and /readyz to this API).
@app.get("/healthz")
def healthz():
    from datetime import datetime, timezone

    return {
        "status": "ok",
        "version": settings.VERSION,
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/readyz")
def readyz():
    from datetime import datetime, timezone

    from fastapi.responses import JSONResponse

    checks: dict = {
        "configuration": {"ok": True, "detail": "valid"},
        "database": {"ok": True, "detail": "reachable"},
        "migrations": {"ok": True, "detail": "n/a"},
    }
    try:
        from sqlalchemy import text

        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
        finally:
            db.close()
    except Exception as exc:  # pragma: no cover — surface real DB failure to portal
        checks["database"] = {"ok": False, "detail": str(exc)[:200]}

    ready = all(c["ok"] for c in checks.values())
    body = {
        "status": "ready" if ready else "not_ready",
        "version": settings.VERSION,
        "environment": getattr(settings, "ENVIRONMENT", "development"),
        "time": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }
    return JSONResponse(body, status_code=200 if ready else 503)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
