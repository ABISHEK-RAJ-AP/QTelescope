import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

_startup_log = logging.getLogger("app.startup")

from app.core.config import settings
from app.core.api_auth import ApiAuthMiddleware
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
    profile = (os.getenv("QRE_PROFILE") or os.getenv("ENVIRONMENT") or "").lower()
    if profile not in ("prod", "production"):
        return
    from app.core.rbac import rbac_enforced
    from app.core.sessions import require_api_auth

    if not rbac_enforced():
        _startup_log.warning(
            "QRE_PROFILE/ENVIRONMENT indicates production but ENFORCE_RBAC is not enabled — deny-by-default RBAC required"
        )
    if not require_api_auth():
        _startup_log.warning(
            "QRE_PROFILE/ENVIRONMENT indicates production but REQUIRE_API_AUTH is not enabled"
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

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="Quantum Runtime Telemetry, Multi-Hardware Auto-Discovery, and Monitoring Platform",
    lifespan=lifespan
)

# Auth runs inside CORS so 401/preflight responses still get Access-Control-* headers.
app.add_middleware(ApiAuthMiddleware)

_dev_cors_default = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:5174,http://127.0.0.1:5174,"
    "http://localhost:5175,http://127.0.0.1:5175,"
    "http://localhost:4173,http://127.0.0.1:4173"
)
_cors_raw = os.getenv("CORS_ORIGINS", _dev_cors_default).strip()
if _cors_raw == "*":
    _cors_origins = ["*"]
    _cors_credentials = False
else:
    _cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]
    _cors_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(backends.router, prefix=settings.API_V1_STR)
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
