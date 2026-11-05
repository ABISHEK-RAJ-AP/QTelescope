import json
import logging
import os
from typing import Any, Dict, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from app.core.config import settings
from app.core.mock_data import (
    get_mock_backend,
    get_mock_backend_properties,
    get_mock_backend_status,
    get_mock_connectivity,
    get_mock_jobs,
)
from app.providers.base import ADAPTER_USER_AGENT, BaseProviderAdapter

logger = logging.getLogger("OnPremiseProviderAdapter")
UA = ADAPTER_USER_AGENT


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def parse_onprem_backends(payload: Any, endpoint_url: str) -> List[Dict[str, Any]]:
    if isinstance(payload, dict):
        rows = payload.get("backends") or payload.get("devices") or payload.get("qpus") or []
        if isinstance(payload.get("backend_id"), str):
            rows = [payload]
    elif isinstance(payload, list):
        rows = payload
    else:
        rows = []

    out = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        bid = item.get("backend_id") or item.get("id") or item.get("name")
        if not bid:
            continue
        qubits = item.get("qubit_count") or item.get("n_qubits") or item.get("qubits")
        try:
            qubits = int(qubits) if qubits is not None else 0
        except (TypeError, ValueError):
            qubits = 0
        status = str(item.get("operational_status") or item.get("status") or "").upper()
        online = status in ("ONLINE", "AVAILABLE", "ACTIVE", "OK")
        out.append({
            "backend_id": str(bid),
            "provider_id": "cdac_quantum",
            "backend_name": item.get("backend_name") or item.get("name") or str(bid),
            "backend_type": item.get("backend_type") or "hardware",
            "qpu_modality": item.get("qpu_modality") or "on_prem",
            "topology_type": item.get("topology_type") or "unknown",
            "qubit_count": qubits,
            "operational_status": "ONLINE" if online or status == "" else "OFFLINE",
            "status_message": item.get("status_message") or item.get("status") or endpoint_url,
            "configuration_version": str(item.get("configuration_version") or ""),
            "basis_gates": item.get("basis_gates") or [],
            "modality_extensions": {"controller": endpoint_url},
        })
    return out


class OnPremiseProviderAdapter(BaseProviderAdapter):
    """Lab controller REST. No invented PARAM QSim when mock is off."""

    def __init__(self, endpoint_url: str = None):
        self.endpoint_url = (endpoint_url or settings.ONPREM_QPU_URL or os.getenv("ONPREM_QPU_URL") or "").rstrip("/")
        self.is_connected = False
        self._live_backends: Optional[List[Dict[str, Any]]] = None
        if self.endpoint_url:
            self._probe()

    def authenticate(self) -> bool:
        return True

    def lineage_mode(self) -> str:
        if self.is_connected:
            return "live"
        return "simulated" if settings.ENABLE_MOCK_DATA else "live"

    def _get_json(self, url: str, timeout: int = 8) -> Any:
        opener = build_opener(_NoRedirect)
        req = Request(url, headers={"Accept": "application/json", "User-Agent": UA}, method="GET")
        with opener.open(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            if not raw.strip():
                return {"ok": True}
            return json.loads(raw)

    def _probe(self) -> None:
        base = self.endpoint_url
        for suffix in ("/health", "/backends", "/api/backends", ""):
            url = f"{base}{suffix}" if suffix else base
            try:
                payload = self._get_json(url)
                self.is_connected = True
                parsed = parse_onprem_backends(payload, base)
                if parsed:
                    self._live_backends = parsed
                    return
                if suffix == "/health" or (isinstance(payload, dict) and payload.get("ok")):
                    self._live_backends = []
                    continue
                if isinstance(payload, dict) and not parsed:
                    continue
            except (HTTPError, URLError, TimeoutError, ValueError, OSError) as err:
                logger.info("On-prem probe %s failed: %s", url, err)
        if not self.is_connected:
            self._live_backends = []

    def discover_backends(self) -> List[Dict[str, Any]]:
        if self.is_connected:
            return list(self._live_backends or [])
        if settings.ENABLE_MOCK_DATA:
            b = get_mock_backend("cdac_qsim_param")
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
            "status_message": "Controller unreachable" if not self.is_connected else "Not found",
        }

    def get_backend_properties(self, backend_id: str) -> Dict[str, Any]:
        if settings.ENABLE_MOCK_DATA and not self.is_connected:
            return get_mock_backend_properties(backend_id)
        return {
            "backend_id": backend_id,
            "calibration_timestamp": None,
            "qubits": [],
            "gates": [],
            "general_properties": {},
        }

    def get_connectivity(self, backend_id: str) -> List[Dict[str, Any]]:
        if settings.ENABLE_MOCK_DATA and not self.is_connected:
            return get_mock_connectivity(backend_id)
        return []

    def get_jobs(self, backend_id: str, limit: int = 15) -> List[Dict[str, Any]]:
        if settings.ENABLE_MOCK_DATA and not self.is_connected:
            return get_mock_jobs(backend_id, limit=limit)
        return []
