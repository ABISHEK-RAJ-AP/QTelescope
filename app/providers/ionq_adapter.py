import json
import logging
import os
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.providers.truth import ionq_live_enabled
from app.core.mock_data import (
    get_mock_backend,
    get_mock_backend_properties,
    get_mock_backend_status,
    get_mock_connectivity,
    get_mock_jobs,
)
from app.providers.base import ADAPTER_USER_AGENT, BaseProviderAdapter

logger = logging.getLogger("IonQProviderAdapter")
UA = ADAPTER_USER_AGENT


def parse_ionq_backends(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, dict):
        rows = payload.get("backends") or payload.get("devices") or payload.get("data") or []
    elif isinstance(payload, list):
        rows = payload
    else:
        rows = []

    out = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        name = item.get("backend") or item.get("name") or item.get("id")
        if not name:
            continue
        bid = str(name).replace(".", "_").replace("-", "_")
        if not bid.startswith("ionq"):
            bid = f"ionq_{bid}"
        qubits = item.get("qubits") or item.get("n_qubits") or item.get("num_qubits")
        try:
            qubits = int(qubits) if qubits is not None else 0
        except (TypeError, ValueError):
            qubits = 0
        status_raw = str(item.get("status") or item.get("availability") or "").lower()
        online = status_raw in ("available", "online", "active", "running")
        display = item.get("display_name") or f"IonQ {name}"
        rec = {
            "backend_id": bid,
            "provider_id": "ionq_quantum",
            "backend_name": display,
            "backend_type": "simulator" if "simulator" in str(name).lower() or item.get("simulator") else "hardware",
            "qpu_modality": "trapped_ion",
            "topology_type": "all_to_all",
            "qubit_count": qubits,
            "operational_status": "ONLINE" if online else "OFFLINE",
            "status_message": item.get("status") or item.get("availability") or "",
            "configuration_version": str(item.get("version") or ""),
            "basis_gates": item.get("gates") or item.get("native_gates") or [],
            "modality_extensions": {
                "ionq_backend": name,
                "average_queue_time": item.get("average_queue_time"),
            },
        }
        out.append(rec)
    return out


class IonQProviderAdapter(BaseProviderAdapter):
    """IonQ Cloud REST (api.ionq.co). Mock catalog only when ENABLE_MOCK_DATA is on and no live reply."""

    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.IONQ_API_KEY or os.getenv("IONQ_API_KEY", "")
        self.is_authenticated = False
        self._live_backends: Optional[List[Dict[str, Any]]] = None
        if ionq_live_enabled() and self.api_key and len(self.api_key.strip()) > 10:
            self.authenticate()

    def authenticate(self) -> bool:
        if not ionq_live_enabled() or not self.api_key or len(self.api_key.strip()) < 10:
            self.is_authenticated = False
            return True
        try:
            payload = self._get_json("/backends")
            self._live_backends = parse_ionq_backends(payload)
            self.is_authenticated = True
            return True
        except Exception as err:
            logger.warning("IonQ auth/discover failed: %s", err)
            self.is_authenticated = False
            return False

    def lineage_mode(self) -> str:
        if self.is_authenticated:
            return "live"
        return "simulated" if settings.ENABLE_MOCK_DATA else "live"

    def _headers(self) -> dict:
        return {
            "Authorization": f"apiKey {self.api_key.strip()}",
            "Accept": "application/json",
            "User-Agent": UA,
        }

    def _get_json(self, path: str, timeout: int = 12) -> Any:
        import urllib.request

        base = os.getenv("IONQ_API_BASE", "https://api.ionq.co/v0.3").rstrip("/")
        url = f"{base}{path}"
        req = urllib.request.Request(url, headers=self._headers(), method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def discover_backends(self) -> List[Dict[str, Any]]:
        if self.is_authenticated:
            if self._live_backends is None:
                try:
                    self._live_backends = parse_ionq_backends(self._get_json("/backends"))
                except Exception as err:
                    logger.warning("IonQ discover failed: %s", err)
                    self._live_backends = []
            return list(self._live_backends)
        if settings.ENABLE_MOCK_DATA:
            b = get_mock_backend("ionq_forte")
            return [b] if b else []
        return []

    def get_backend_status(self, backend_id: str) -> Dict[str, Any]:
        for b in self.discover_backends():
            if b.get("backend_id") == backend_id:
                return {
                    "backend_id": backend_id,
                    "operational": b.get("operational_status") == "ONLINE",
                    "pending_jobs": 0,
                    "status_message": b.get("status_message") or "",
                }
        if settings.ENABLE_MOCK_DATA:
            return get_mock_backend_status(backend_id)
        return {
            "backend_id": backend_id,
            "operational": False,
            "pending_jobs": 0,
            "status_message": "Not found",
        }

    def get_backend_properties(self, backend_id: str) -> Dict[str, Any]:
        if settings.ENABLE_MOCK_DATA and not self.is_authenticated:
            return get_mock_backend_properties(backend_id)
        return {
            "backend_id": backend_id,
            "calibration_timestamp": None,
            "qubits": [],
            "gates": [],
            "general_properties": {},
        }

    def get_connectivity(self, backend_id: str) -> List[Dict[str, Any]]:
        if settings.ENABLE_MOCK_DATA and not self.is_authenticated:
            return get_mock_connectivity(backend_id)
        return []

    def get_jobs(self, backend_id: str, limit: int = 15) -> List[Dict[str, Any]]:
        if settings.ENABLE_MOCK_DATA and not self.is_authenticated:
            return get_mock_jobs(backend_id, limit=limit)
        return []
