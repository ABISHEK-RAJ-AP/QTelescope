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
        "credential_type": "Public QCS ISA (token optional)",
        "docs": "https://docs.rigetti.com/qcs/",
        "env_key": "RIGETTI_API_KEY",
        "fields": [{
            "key": "token",
            "label": "QCS API token (optional — hardware ISA is public)",
            "secret": True,
            "in": "token",
            "required": False,
        }],
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
        "name": "C-DAC on-prem / QSim",
        "vendor": "C-DAC",
        "modality": "on-prem / simulator",
        "adapter": "live",
        "credential_type": "REST endpoint",
        "docs": "",
        "env_key": "ONPREM_QPU_URL",
        "fields": [
            {"key": "endpoint_url", "label": "Controller or QSim ingest URL", "secret": False, "in": "endpoint_url"},
            {"key": "token", "label": "Optional API bearer", "secret": True, "in": "token", "required": False},
        ],
    },
    {
        "id": "custom_integration",
        "name": "Custom integration",
        "vendor": "Custom",
        "modality": "multi-QPU",
        "adapter": "stub",
        "credential_type": "Discovery URL + optional API key",
        "docs": "",
        "fields": [
            {"key": "endpoint_url", "label": "Discovery or telemetry base URL", "secret": False, "in": "endpoint_url", "required": True},
            {"key": "token", "label": "API key (optional)", "secret": True, "in": "token", "required": False},
        ],
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


def catalog_by_id(provider_id: str) -> Optional[Dict[str, Any]]:
    if not provider_id:
        return None
    return BY_ID.get(provider_id) or BY_ID.get(str(provider_id).lower())


def _ensure_data_dir() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)


_TOKEN_ENC_FIELD = "token_enc"


def _seal_credential(value: str) -> str:
    from app.core import secret_box

    plain = (value or "").strip()
    if not plain:
        return ""
    return secret_box.seal_plaintext(plain)


def _open_credential(value: str) -> str:
    from app.core import secret_box

    raw = (value or "").strip()
    if not raw:
        return ""
    if raw.startswith("gAAAA"):
        try:
            return secret_box.open_ciphertext(raw)
        except Exception:
            return ""
    return raw


def _migrate_plaintext_tokens(store: Dict[str, Any]) -> bool:
    changed = False
    for _pid, row in list(store.items()):
        if not isinstance(row, dict):
            continue
        plain = row.pop("token", None)
        if plain and not row.get(_TOKEN_ENC_FIELD):
            row[_TOKEN_ENC_FIELD] = _seal_credential(str(plain))
            changed = True
    return changed


def load_stored() -> Dict[str, Any]:
    if not os.path.exists(CREDS_PATH):
        return {}
    try:
        with open(CREDS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {}
        if _migrate_plaintext_tokens(data):
            save_stored(data)
        return data
    except (OSError, json.JSONDecodeError):
        return {}


def save_stored(store: Dict[str, Any]) -> None:
    _ensure_data_dir()
    tmp = CREDS_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(store, f, indent=2)
    os.replace(tmp, CREDS_PATH)


def stored_secret_token(provider_id: str) -> str:
    """Provider API token for collectors — never expose via HTTP."""
    row = load_stored().get(provider_id) or {}
    enc = row.get(_TOKEN_ENC_FIELD) or row.get("token") or ""
    return _open_credential(str(enc)) if enc else ""


def upsert_stored(provider_id: str, token: Optional[str], endpoint_url: Optional[str], extra: Optional[Dict[str, Any]]) -> None:
    store = load_stored()
    prev = store.get(provider_id) or {}
    prev_extra = prev.get("extra") if isinstance(prev.get("extra"), dict) else {}
    merged_extra = {**prev_extra, **(extra or {})}
    if token:
        token_enc = _seal_credential(token)
    else:
        token_enc = prev.get(_TOKEN_ENC_FIELD) or ""
        if not token_enc and prev.get("token"):
            token_enc = _seal_credential(str(prev.get("token")))
    store[provider_id] = {
        _TOKEN_ENC_FIELD: token_enc,
        "endpoint_url": endpoint_url if endpoint_url else prev.get("endpoint_url", ""),
        "extra": merged_extra,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    save_stored(store)


def stored_configured(provider_id: str) -> bool:
    row = load_stored().get(provider_id) or {}
    return bool(stored_secret_token(provider_id) or row.get("endpoint_url"))


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
        elif src == "token":
            continue
        elif key in extra:
            val = str(extra[key])
            if field.get("secret"):
                continue
            out[key] = val
    return out
