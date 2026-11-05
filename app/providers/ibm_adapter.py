import json
import logging
import os
import datetime
import urllib.request
import urllib.parse
from typing import List, Dict, Any, Optional

from app.providers.base import ADAPTER_USER_AGENT, BaseProviderAdapter
from app.providers.mock_provider import MockProviderAdapter
from app.core.config import settings

logger = logging.getLogger("IBMProviderAdapter")
UA = ADAPTER_USER_AGENT


def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)


def _opt_float(src: dict, key: str) -> Optional[float]:
    val = src.get(key)
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


class IBMProviderAdapter(BaseProviderAdapter):
    """IBM Cloud IAM + Qiskit Runtime REST. Mock only when ENABLE_MOCK_DATA is on."""

    def __init__(self, api_token: str = None):
        self.api_token = api_token or settings.IBM_QUANTUM_TOKEN or os.getenv("IBM_QUANTUM_TOKEN", "")
        self.mock_fallback = MockProviderAdapter()
        self.is_authenticated = False
        self.access_token = None
        self.is_cloud = False
        self.crn = None
        self.base_url = "https://us-east.quantum-computing.cloud.ibm.com"
        self.cached_backends = []
        self.cached_configs = {}

        if self.api_token and len(self.api_token.strip()) > 10:
            self.authenticate()

    def lineage_mode(self) -> str:
        if self.is_authenticated:
            return "live"
        return "simulated" if settings.ENABLE_MOCK_DATA else "live"

    def _use_mock(self) -> bool:
        return bool(settings.ENABLE_MOCK_DATA)

    def _http_request(self, url: str, method: str = "GET", data_dict: dict = None, headers: dict = None, timeout: int = 12):
        req_headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": UA,
            **(headers or {}),
        }
        json_bytes = json.dumps(data_dict).encode("utf-8") if data_dict else None
        req = urllib.request.Request(url, data=json_bytes, headers=req_headers, method=method)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))

    def authenticate(self) -> bool:
        if not self.api_token or len(self.api_token.strip()) < 10:
            self.is_authenticated = False
            return False

        token = self.api_token.strip()

        try:
            iam_url = "https://iam.cloud.ibm.com/identity/token"
            data = urllib.parse.urlencode({
                "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                "apikey": token,
            }).encode("utf-8")
            req = urllib.request.Request(
                iam_url,
                data=data,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                    "User-Agent": UA,
                },
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    token_data = json.loads(resp.read().decode("utf-8"))
                    self.access_token = token_data.get("access_token")
                    self.is_cloud = True
                    try:
                        rc_url = "https://resource-controller.cloud.ibm.com/v2/resource_instances"
                        rc_headers = {"Authorization": f"Bearer {self.access_token}"}
                        _, rc_data = self._http_request(rc_url, headers=rc_headers, timeout=10)
                        all_resources = rc_data.get("resources", [])
                        quantum_resources = [item for item in all_resources if ":quantum-computing:" in item.get("crn", "")]
                        if quantum_resources:
                            self.crn = quantum_resources[0].get("crn")
                            parts = self.crn.split(":")
                            region = parts[5] if len(parts) > 5 and parts[5] else "us-east"
                            self.base_url = f"https://{region}.quantum-computing.cloud.ibm.com"
                    except Exception as exc:
                        logger.warning("IBM Resource Controller lookup failed: %s", exc)
                    self.is_authenticated = True
                    return True
        except Exception as err:
            logger.info("IBM Cloud IAM auth failed: %s", err)

        try:
            url = "https://api.quantum-computing.ibm.com/api/users/loginWithToken"
            status, data = self._http_request(url, method="POST", data_dict={"apiToken": token}, timeout=10)
            if status == 200:
                self.access_token = data.get("id")
                self.is_cloud = False
                self.is_authenticated = True
                return True
        except Exception as err:
            logger.info("IBM legacy token auth failed: %s", err)

        self.is_authenticated = False
        return False

    def _get_auth_headers(self) -> dict:
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "User-Agent": UA,
            "Accept": "application/json",
        }
        if self.crn:
            headers["Service-CRN"] = self.crn
        return headers

    def _offline_status(self, backend_id: str, message: str) -> Dict[str, Any]:
        return {
            "backend_id": backend_id,
            "operational": False,
            "pending_jobs": 0,
            "status_message": message,
            "timestamp": utcnow().isoformat(),
        }

    def _empty_properties(self, backend_id: str) -> Dict[str, Any]:
        return {
            "backend_id": backend_id,
            "calibration_timestamp": None,
            "qubits": [],
            "gates": [],
            "general_properties": {},
        }

    def discover_backends(self) -> List[Dict[str, Any]]:
        if not self.is_authenticated:
            return self.mock_fallback.discover_backends() if self._use_mock() else []

        if self.is_cloud and self.access_token:
            try:
                headers = self._get_auth_headers()
                _, data = self._http_request(f"{self.base_url}/backends", headers=headers, timeout=12)
                device_names = data.get("devices", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])

                real_backends = []
                for name in device_names:
                    cfg = {}
                    st = {}
                    try:
                        _, cfg = self._http_request(f"{self.base_url}/backends/{name}/configuration", headers=headers, timeout=8)
                        self.cached_configs[name] = cfg
                    except Exception:
                        cfg = self.cached_configs.get(name, {})
                    try:
                        _, st = self._http_request(f"{self.base_url}/backends/{name}/status", headers=headers, timeout=8)
                    except Exception:
                        pass

                    n_qubits = cfg.get("n_qubits")
                    try:
                        n_qubits = int(n_qubits) if n_qubits is not None else None
                    except (TypeError, ValueError):
                        n_qubits = None
                    is_online = bool(st.get("state") is True or st.get("status") in ["active", "online"])
                    proc = cfg.get("processor_type")
                    if isinstance(proc, dict):
                        proc_label = proc.get("family") or proc.get("name")
                    else:
                        proc_label = proc
                    display = f"IBM {str(name).replace('ibm_', '').title()}"
                    if n_qubits:
                        display = f"{display} ({n_qubits}Q)"

                    record = {
                        "backend_id": name,
                        "provider_id": "ibm_quantum",
                        "backend_name": display,
                        "backend_type": "hardware" if not cfg.get("simulator") else "simulator",
                        "qpu_modality": "superconducting",
                        "topology_type": "heavy_hex" if cfg.get("coupling_map") else "unknown",
                        "qubit_count": n_qubits or 0,
                        "operational_status": "ONLINE" if is_online else "OFFLINE",
                        "status_message": st.get("message") or ("Operational" if is_online else "Offline"),
                        "configuration_version": cfg.get("backend_version") or "",
                        "basis_gates": cfg.get("basis_gates") or [],
                        "modality_extensions": {
                            "crn": self.crn,
                            "queue_length": st.get("length_queue", 0),
                        },
                    }
                    if proc_label:
                        record["modality_extensions"]["processor_type"] = proc_label
                    if cfg.get("quantum_volume") is not None:
                        record["quantum_volume"] = cfg.get("quantum_volume")
                    if cfg.get("clops") is not None:
                        record["clops"] = cfg.get("clops")
                    real_backends.append(record)

                self.cached_backends = real_backends
                return real_backends
            except Exception as err:
                logger.warning("IBM live discovery failed: %s", err)

        if self._use_mock():
            return self.mock_fallback.discover_backends()
        return []

    def get_backend_status(self, backend_id: str) -> Dict[str, Any]:
        if not self.is_authenticated:
            if self._use_mock():
                return self.mock_fallback.get_backend_status(backend_id)
            return self._offline_status(backend_id, "IBM token not configured")

        if not hasattr(self, "cached_status_map"):
            self.cached_status_map = {}

        if backend_id in self.cached_status_map:
            cached_st, t_time = self.cached_status_map[backend_id]
            if (utcnow() - t_time).total_seconds() < 90:
                return cached_st

        if self.is_cloud and self.access_token:
            try:
                headers = self._get_auth_headers()
                _, st = self._http_request(f"{self.base_url}/backends/{backend_id}/status", headers=headers, timeout=8)
                is_op = bool(st.get("state") is True or st.get("status") in ["active", "online"])
                pending = st.get("length_queue", 0)
                res = {
                    "backend_id": backend_id,
                    "operational": is_op,
                    "pending_jobs": pending,
                    "status_message": st.get("message") or ("Operational" if is_op else "Maintenance"),
                    "timestamp": utcnow().isoformat(),
                }
                self.cached_status_map[backend_id] = (res, utcnow())
                return res
            except Exception as err:
                logger.warning("IBM status fetch failed: %s", err)

        if self._use_mock():
            return self.mock_fallback.get_backend_status(backend_id)
        return self._offline_status(backend_id, "Live status fetch failed")

    def get_backend_properties(self, backend_id: str) -> Dict[str, Any]:
        if not self.is_authenticated:
            if self._use_mock():
                return self.mock_fallback.get_backend_properties(backend_id)
            return self._empty_properties(backend_id)

        if not hasattr(self, "cached_props_map"):
            self.cached_props_map = {}

        if backend_id in self.cached_props_map:
            cached_pr, t_time = self.cached_props_map[backend_id]
            if (utcnow() - t_time).total_seconds() < 120:
                return cached_pr

        if self.is_cloud and self.access_token:
            try:
                headers = self._get_auth_headers()
                _, props = self._http_request(
                    f"{self.base_url}/backends/{backend_id}/properties",
                    headers=headers,
                    timeout=10,
                )
                cal_time = props.get("last_update_date") or utcnow().isoformat()
                raw_qubits = props.get("qubits", [])

                qubits = []
                for idx, q_items in enumerate(raw_qubits):
                    q_map = {item.get("name"): item.get("value") for item in q_items if "name" in item}
                    t1 = _opt_float(q_map, "T1")
                    t2 = _opt_float(q_map, "T2")
                    if t1 is None and t2 is None:
                        continue
                    row = {"qubit_index": idx}
                    if t1 is not None:
                        row["t1"] = t1
                    if t2 is not None:
                        row["t2"] = t2
                    for src, dest in (
                        ("frequency", "frequency"),
                        ("readout_error", "readout_error"),
                        ("prob_meas0_prep1", "prob_meas0_prep1"),
                        ("prob_meas1_prep0", "prob_meas1_prep0"),
                        ("anharmonicity", "anharmonicity"),
                        ("readout_length", "readout_length"),
                    ):
                        val = _opt_float(q_map, src)
                        if val is not None:
                            row[dest] = val
                    qubits.append(row)

                gates = []
                for g in props.get("gates", []):
                    params = {p.get("name"): p.get("value") for p in g.get("parameters", [])}
                    err = _opt_float(params, "gate_error")
                    length = _opt_float(params, "gate_length")
                    gate = {
                        "gate_name": g.get("name", "gate"),
                        "gate_type": "1q" if len(g.get("qubits", [])) == 1 else "2q",
                        "qubits": g.get("qubits", []),
                    }
                    if err is not None:
                        gate["error_rate"] = err
                    if length is not None:
                        gate["gate_length"] = length
                    gates.append(gate)

                res = {
                    "backend_id": backend_id,
                    "calibration_timestamp": cal_time,
                    "qubits": qubits,
                    "gates": gates,
                    "general_properties": {"last_update": cal_time},
                }
                self.cached_props_map[backend_id] = (res, utcnow())
                return res
            except Exception as err:
                logger.warning("IBM properties fetch failed: %s", err)

        if self._use_mock():
            return self.mock_fallback.get_backend_properties(backend_id)
        return self._empty_properties(backend_id)

    def get_connectivity(self, backend_id: str) -> List[Dict[str, Any]]:
        if not self.is_authenticated:
            return self.mock_fallback.get_connectivity(backend_id) if self._use_mock() else []

        cfg = self.cached_configs.get(backend_id)
        if not cfg and self.is_cloud and self.access_token:
            try:
                headers = self._get_auth_headers()
                _, cfg = self._http_request(
                    f"{self.base_url}/backends/{backend_id}/configuration",
                    headers=headers,
                    timeout=8,
                )
                self.cached_configs[backend_id] = cfg
            except Exception:
                pass

        if cfg and cfg.get("coupling_map"):
            edges = []
            seen = set()
            for pair in cfg["coupling_map"]:
                if len(pair) >= 2:
                    q1, q2 = pair[0], pair[1]
                    key = tuple(sorted([q1, q2]))
                    if key not in seen:
                        seen.add(key)
                        edges.append({
                            "edge_id": f"{backend_id}_e_{q1}_{q2}",
                            "qubits": [q1, q2],
                            "directed": False,
                        })
            return edges

        return self.mock_fallback.get_connectivity(backend_id) if self._use_mock() else []

    def get_jobs(self, backend_id: str, limit: int = 15) -> List[Dict[str, Any]]:
        if self._use_mock() and not self.is_authenticated:
            return self.mock_fallback.get_jobs(backend_id, limit=limit)
        return []
