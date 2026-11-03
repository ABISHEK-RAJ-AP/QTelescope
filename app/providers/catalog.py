"""Public 2026 quantum-cloud / hardware credential catalog.

Live adapters exist only for IBM, Rigetti, IonQ, and C-DAC/on-prem.
Every other vendor is a credential slot (STUB) — no fake discover/poll.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(ROOT, "data")
CREDS_PATH = os.path.join(DATA_DIR, "provider_credentials.json")

# adapter: live = wired collector; stub = store-only
CATALOG: List[Dict[str, Any]] = [
    {
        "id": "ibm_quantum",
        "name": "IBM Quantum Platform",
        "vendor": "IBM",
        "modality": "superconducting",
        "adapter": "live",
        "credential_type": "IBM Cloud IAM API key",
        "docs": "https://quantum.cloud.ibm.com/",
        "env_key": "IBM_QUANTUM_TOKEN",
        "fields": [{"key": "token", "label": "IBM Cloud API key", "secret": True, "in": "token"}],
    },
    {
        "id": "aws_braket",
        "name": "Amazon Braket",
        "vendor": "AWS",
        "modality": "multi-QPU marketplace",
        "adapter": "stub",
        "credential_type": "IAM access key",
        "docs": "https://docs.aws.amazon.com/braket/",
        "fields": [
            {"key": "token", "label": "Access key ID", "secret": False, "in": "token"},
            {"key": "secret_key", "label": "Secret access key", "secret": True, "in": "extra"},
            {"key": "region", "label": "Region (e.g. us-east-1)", "secret": False, "in": "extra"},
        ],
    },
    {
        "id": "azure_quantum",
        "name": "Azure Quantum",
        "vendor": "Microsoft",
        "modality": "multi-QPU workspace",
        "adapter": "stub",
        "credential_type": "Workspace key",
        "docs": "https://learn.microsoft.com/azure/quantum/",
        "fields": [
            {"key": "token", "label": "Access key", "secret": True, "in": "token"},
            {"key": "subscription_id", "label": "Subscription ID", "secret": False, "in": "extra"},
            {"key": "resource_group", "label": "Resource group", "secret": False, "in": "extra"},
            {"key": "workspace", "label": "Workspace name", "secret": False, "in": "extra"},
            {"key": "location", "label": "Location", "secret": False, "in": "extra"},
        ],
    },
    {
        "id": "google_quantum",
        "name": "Google Quantum AI",
        "vendor": "Google",
        "modality": "superconducting",
        "adapter": "stub",
        "credential_type": "Service account JSON / API key",
        "docs": "https://quantumai.google/",
        "fields": [
            {"key": "token", "label": "API key or service-account JSON", "secret": True, "in": "token"},
            {"key": "project_id", "label": "GCP project ID", "secret": False, "in": "extra"},
        ],
    },
    {
        "id": "ionq_quantum",
        "name": "IonQ Cloud",
        "vendor": "IonQ",
        "modality": "trapped ion",
        "adapter": "live",
        "credential_type": "IonQ API key",
        "docs": "https://ionq.com/docs",
        "env_key": "IONQ_API_KEY",
        "fields": [{"key": "token", "label": "IonQ API key", "secret": True, "in": "token"}],
    },
    {
        "id": "rigetti_quantum",
        "name": "Rigetti QCS",
        "vendor": "Rigetti",
        "modality": "superconducting",
        "adapter": "live",
        "credential_type": "QCS API key",
        "docs": "https://qcs.rigetti.com/",
        "env_key": "RIGETTI_API_KEY",
        "fields": [{"key": "token", "label": "QCS API key", "secret": True, "in": "token"}],
    },
    {
        "id": "quantinuum",
        "name": "Quantinuum Nexus / H-Series",
        "vendor": "Quantinuum",
        "modality": "trapped ion",
        "adapter": "stub",
        "credential_type": "Nexus user + token",
        "docs": "https://docs.quantinuum.com/",
        "fields": [
            {"key": "token", "label": "API token", "secret": True, "in": "token"},
            {"key": "username", "label": "Username / email", "secret": False, "in": "extra"},
        ],
    },
    {
        "id": "iqm_quantum",
        "name": "IQM Resonance",
        "vendor": "IQM",
        "modality": "superconducting",
        "adapter": "stub",
        "credential_type": "Resonance token",
        "docs": "https://resonance.meetiqm.com/",
        "fields": [{"key": "token", "label": "IQM token", "secret": True, "in": "token"}],
    },
    {
        "id": "quera_quantum",
        "name": "QuEra Aquila",
        "vendor": "QuEra",
        "modality": "neutral atom",
        "adapter": "stub",
        "credential_type": "API token (or via Braket)",
        "docs": "https://www.quera.com/",
        "fields": [{"key": "token", "label": "API token", "secret": True, "in": "token"}],
    },
    {
        "id": "pasqal",
        "name": "PASQAL Cloud",
        "vendor": "PASQAL",
        "modality": "neutral atom",
        "adapter": "stub",
        "credential_type": "Cloud token",
        "docs": "https://www.pasqal.com/",
        "fields": [{"key": "token", "label": "PASQAL token", "secret": True, "in": "token"}],
    },
    {
        "id": "dwave",
        "name": "D-Wave Leap",
        "vendor": "D-Wave",
        "modality": "quantum annealer",
        "adapter": "stub",
        "credential_type": "Leap API token",
        "docs": "https://docs.dwavesys.com/docs/latest/leap.html",
        "fields": [{"key": "token", "label": "Leap API token", "secret": True, "in": "token"}],
    },
    {
        "id": "qbraid",
        "name": "qBraid",
        "vendor": "qBraid",
        "modality": "multi-provider hub",
        "adapter": "stub",
        "credential_type": "qBraid API key",
        "docs": "https://docs.qbraid.com/",
        "fields": [{"key": "token", "label": "qBraid API key", "secret": True, "in": "token"}],
    },
    {
        "id": "oxford_qcs",
        "name": "Oxford Quantum Circuits",
        "vendor": "OQC",
        "modality": "superconducting",
        "adapter": "stub",
        "credential_type": "OQC token",
        "docs": "https://oxfordquantumcircuits.com/",
        "fields": [{"key": "token", "label": "OQC token", "secret": True, "in": "token"}],
    },
    {
        "id": "xanadu",
        "name": "Xanadu Cloud",
        "vendor": "Xanadu",
        "modality": "photonic",
        "adapter": "stub",
        "credential_type": "Cloud API key",
        "docs": "https://cloud.xanadu.ai/",
        "fields": [{"key": "token", "label": "Xanadu API key", "secret": True, "in": "token"}],
    },
    {
        "id": "aqt",
        "name": "Alpine Quantum Technologies",
        "vendor": "AQT",
        "modality": "trapped ion",
        "adapter": "stub",
        "credential_type": "AQT token",
        "docs": "https://www.aqt.eu/",
        "fields": [{"key": "token", "label": "AQT token", "secret": True, "in": "token"}],
    },
    {
        "id": "cdac_quantum",
        "name": "C-DAC / on-prem lab controller",
        "vendor": "C-DAC",
        "modality": "on-prem / simulator",
        "adapter": "live",
        "credential_type": "REST endpoint",
        "docs": "",
        "env_key": "ONPREM_QPU_URL",
        "fields": [{"key": "endpoint_url", "label": "Controller URL", "secret": False, "in": "endpoint_url"}],
    },
    {
        "id": "facility_env",
        "name": "Facility / cryo / RF telemetry",
        "vendor": "Lab",
        "modality": "environment",
        "adapter": "stub",
        "credential_type": "Ingest endpoint",
        "docs": "",
        "fields": [
            {"key": "endpoint_url", "label": "Telemetry ingest URL", "secret": False, "in": "endpoint_url"},
            {"key": "token", "label": "Optional bearer token", "secret": True, "in": "token", "required": False},
        ],
    },
]

BY_ID = {p["id"]: p for p in CATALOG}


def _ensure_data_dir() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)


def load_stored() -> Dict[str, Any]:
    if not os.path.exists(CREDS_PATH):
        return {}
    try:
        with open(CREDS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_stored(store: Dict[str, Any]) -> None:
    _ensure_data_dir()
    with open(CREDS_PATH, "w", encoding="utf-8") as f:
        json.dump(store, f, indent=2)


def upsert_stored(provider_id: str, token: Optional[str], endpoint_url: Optional[str], extra: Optional[Dict[str, Any]]) -> None:
    store = load_stored()
    prev = store.get(provider_id) or {}
    prev_extra = prev.get("extra") if isinstance(prev.get("extra"), dict) else {}
    merged_extra = {**prev_extra, **(extra or {})}
    store[provider_id] = {
        "token": token if token else prev.get("token", ""),
        "endpoint_url": endpoint_url if endpoint_url else prev.get("endpoint_url", ""),
        "extra": merged_extra,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    save_stored(store)


def stored_configured(provider_id: str) -> bool:
    row = load_stored().get(provider_id) or {}
    return bool(row.get("token") or row.get("endpoint_url"))


def public_extra(provider_id: str, fields: List[Dict[str, Any]]) -> Dict[str, str]:
    row = load_stored().get(provider_id) or {}
    extra = row.get("extra") if isinstance(row.get("extra"), dict) else {}
    out: Dict[str, str] = {}
    for field in fields:
        if field.get("secret"):
            continue
        key = field["key"]
        src = field.get("in")
        if src == "endpoint_url" and row.get("endpoint_url"):
            out[key] = row["endpoint_url"]
        elif src == "token" and key != "token" and row.get("token"):
            out[key] = row["token"]
        elif key in extra:
            out[key] = str(extra[key])
    return out
