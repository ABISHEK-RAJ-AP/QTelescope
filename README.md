# Quantum Runtime Telemetry, Monitoring, and Resource Management Platform

A web-based platform for collecting, normalizing, storing, analyzing, and visualizing telemetry from quantum hardware backends (IBM Quantum) and quantum simulators.

---

## 🚀 Key Features

* **Quantum Backend Inventory & Availability**: Monitor operational states, quantum volume, CLOPS, basis gates, qubit counts, and status messages.
* **Qubit Telemetry & Coherence Monitoring**: Real-time T1 coherence, T2 coherence, qubit frequencies, and readout error rates.
* **Calibration Freshness**: Tracking calibration snapshot age (Fresh, Recent, Aging, Stale, Unknown).
* **Parameter Drift Analysis**: Statistical change detection, rolling average, rolling standard deviation, % change, and rate of change for T1, T2, and readout error metrics.
* **Queue & Workload Monitoring**: Pending job counts, queue condition gauges (Optimal, Moderate, Busy, Congested), and estimated waiting times.
* **Execution Monitoring**: Job execution history, status monitoring (Completed, Running, Queued, Failed), execution runtimes, and calibration references.
* **Transparent Resource Health Assessment**: Rule-based explainable health score (0–100) with contributing health factors (Operational status, Calibration age, Qubit degradation, Queue pressure).
* **Alert & Incident Engine**: Rule evaluation for T1/T2 drops, high readout error, queue overflow, stale calibration, and offline backends with inline acknowledgement and resolution actions.
* **Reports & Data Export**: Printable HTML/PDF and downloadable CSV audit reports.
* **Live Telemetry Stream**: Server-Sent Events (SSE) live updates for real-time telemetry streaming.

---

## 🏗 System Architecture

```
IBM Quantum Platform / Simulators
               ↓
    IBM Provider Adapter (Qiskit Runtime & REST API / Mock Adapter)
               ↓
     Telemetry Collectors (Status, Properties, Calibration, Queue, Jobs)
               ↓
     Normalization & Validation Layer (Normalized Internal Telemetry)
               ↓
   PostgreSQL / TimescaleDB & SQLite Engine
               ↓
 Monitoring & Analytics Engine (Freshness, Drift Analyzer, Health Engine, Alert Engine)
               ↓
         FastAPI REST API & SSE Server
               ↓
 React + TypeScript + Apache ECharts Dashboard
```

---

## 📁 Repository Structure

```
quantum-monitoring-platform/
├── backend/
│   ├── app/
│   │   ├── api/             # REST Routers (backends, qubits, calibration, drift, queues, jobs, health, alerts, admin, reports, events)
│   │   ├── core/            # Database engine and app settings
│   │   ├── models/          # SQLAlchemy Database entities
│   │   ├── schemas/         # Pydantic data validation schemas
│   │   ├── providers/       # Base, IBM, and Mock Provider Adapters
│   │   ├── collectors/      # Telemetry collector orchestrator
│   │   ├── normalizers/     # Telemetry normalizer engine
│   │   ├── monitoring/      # Freshness monitor & Health assessment engine
│   │   ├── analytics/       # Parameter drift analyzer
│   │   ├── alerts/          # Alert evaluation engine
│   │   ├── reports/         # CSV and HTML/PDF report generator
│   │   └── main.py          # FastAPI application entrypoint
│   ├── tests/               # Pytest suite for end-to-end API verification
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard Home, Inventory, Details, Qubits, Live Telemetry, Calibration, Drift, Trends, Jobs, Queues, Health, Alerts, Reports, Admin
│   │   ├── services/        # API client service wrapper
│   │   ├── App.tsx          # Main React layout with sidebar navigation
│   │   └── index.css        # Quantum Dark Glassmorphism CSS design system
│   └── package.json
├── deployment/
│   ├── Dockerfile
│   └── docker-compose.yml
└── README.md
```

---

## 🛠 Quick Start Guide

### 1. Run Backend Server

Canonical API lives at repository root **`app/`** (the `backend/` folder is a legacy partial copy).

```bash
# From repository root
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r backend/requirements.txt
USE_ALEMBIC=false PYTHONPATH=. uvicorn app.main:app --reload --port 8000
```

FastAPI Interactive API Documentation will be live at `http://localhost:8000/docs`.

### 2. Run Backend Pytest Suite

```bash
# From repository root
USE_ALEMBIC=false PYTHONPATH=. pytest tests/
```

PostgreSQL production path: [docs/DATABASE_POSTGRES.md](docs/DATABASE_POSTGRES.md) · Backups: [docs/DATABASE_BACKUP.md](docs/DATABASE_BACKUP.md)

### 3. Run Frontend React Dashboard

```bash
cd frontend
npm install
npm run dev
```

The React Monitoring Dashboard will be live at `http://localhost:5173`.

---

## 🐳 Docker Deployment

To launch the full stack with Docker Compose:

```bash
cd deployment
docker-compose up -d
```

---

## 🔒 Non-Functional & Security Requirements

* **Credential Safety**: IBM Quantum credentials are read securely from backend environment variables (`IBM_QUANTUM_TOKEN`) and never exposed to the frontend.
* **Unavailable Telemetry**: Missing or uncollected provider telemetry fields are explicitly preserved as `NULL` / `NOT_AVAILABLE`.
* **No Artificial Data**: Real provider properties are preserved; mock adapter is only triggered for offline demonstration.
* **No ML / RL**: Excludes machine learning, XGBoost, reinforcement learning, or automated backend recommendation in accordance with Phase 1 scope.
