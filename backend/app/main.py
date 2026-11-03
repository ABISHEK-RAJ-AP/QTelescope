from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
import app.models.entities  # Ensure all models are registered on Base.metadata
from app.discovery.hardware_discovery import HardwareDiscoveryEngine
from app.api import backends, qubits, calibration, drift, queues, jobs, health, alerts, admin, reports, events, auth

# Initialize database schema
Base.metadata.create_all(bind=engine)

def execute_startup_hardware_discovery():
    """Autonomous zero-touch hardware discovery on startup."""
    db = SessionLocal()
    try:
        HardwareDiscoveryEngine.run_auto_discovery(db)
    finally:
        db.close()

seed_initial_telemetry = execute_startup_hardware_discovery

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run autonomous hardware discovery and telemetry collection on startup
    execute_startup_hardware_discovery()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="Quantum Runtime Telemetry, Multi-Hardware Auto-Discovery, and Monitoring Platform",
    lifespan=lifespan
)

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(backends.router, prefix=settings.API_V1_STR)
app.include_router(qubits.router, prefix=settings.API_V1_STR)
app.include_router(calibration.router, prefix=settings.API_V1_STR)
app.include_router(drift.router, prefix=settings.API_V1_STR)
app.include_router(queues.router, prefix=settings.API_V1_STR)
app.include_router(jobs.router, prefix=settings.API_V1_STR)
app.include_router(health.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(events.router, prefix=settings.API_V1_STR)
app.include_router(auth.router, prefix=settings.API_V1_STR)

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
