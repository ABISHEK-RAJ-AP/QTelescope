"""Rigetti QCS Forest REST — public Instruction Set Architecture (ISA).

GET https://api.qcs.rigetti.com/v1/quantumProcessors
GET https://api.qcs.rigetti.com/v1/quantumProcessors/{id}/instructionSetArchitecture

The ISA catalog is public (no API key). Queue/jobs are not in that OpenAPI.
Optional RIGETTI_API_KEY / QCS_API_KEY is attached if present.
"""
from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.mock_data import (
    get_mock_backend,
    get_mock_backend_properties,
    get_mock_connectivity,
    get_mock_jobs,
)
from app.providers.base import BaseProviderAdapter

logger = logging.getLogger("RigettiProviderAdapter")

QCS_API_BASE = os.getenv("RIGETTI_QCS_API_BASE", "https://api.qcs.rigetti.com/v1").rstrip("/")
DEFAULT_PROCESSOR = "Cepheus-1-108Q"
UA = "Q-TeleScope/1.0 (quantum-operations-console)"


def _backend_id_for(proc_id: str) -> str:
    return "rigetti_" + proc_id.lower().replace("-", "_")


def _processor_id_from_backend(backend_id: str) -> str:
    bid = (backend_id or "").lower()
    if "cepheus" in bid:
        return "Cepheus-1-108Q"
    if "aspen" in bid:
        return "Aspen-M-3"
    if bid.startswith("rigetti_"):
        raw = backend_id[len("rigetti_") :]
        parts = raw.replace("_", "-")
        return parts or DEFAULT_PROCESSOR
    return DEFAULT_PROCESSOR


def parse_isa_backend(isa: Dict[str, Any], proc_id: str, source_url: str) -> Dict[str, Any]:
    nodes = (isa.get("architecture") or {}).get("nodes") or []
    node_ids = [n["node_id"] for n in nodes if "node_id" in n]
    active_count = len(node_ids)
    edges = (isa.get("architecture") or {}).get("edges") or []
    instructions = isa.get("instructions") or []
    basis_gates = sorted({str(i.get("name", "")).lower() for i in instructions if i.get("name")})
    return {
        "backend_id": _backend_id_for(proc_id),
        "provider_id": "rigetti_quantum",
        "backend_name": f"Rigetti {proc_id}",
        "backend_type": "hardware",
        "qpu_modality": "superconducting",
        "topology_type": "octagonal_ring",
        "qubit_count": active_count,
        "operational_status": "ONLINE",
        "status_message": f"QCS public ISA — {active_count} nodes (queue not in OpenAPI)",
        "configuration_version": str(isa.get("name") or proc_id),
        "basis_gates": basis_gates or ["rx", "rz", "cz"],
        "modality_extensions": {
            "processor_type": "superconducting_transmon",
            "qpu_id": proc_id,
            "active_qubits": active_count,
            "coupling_edges_count": len(edges),
            "isa_source": source_url,
            "telemetry_scope": "instruction_set_architecture",
        },
    }


def parse_isa_properties(isa: Dict[str, Any], backend_id: str) -> Dict[str, Any]:
    nodes = (isa.get("architecture") or {}).get("nodes") or []
    node_set = {n["node_id"] for n in nodes if "node_id" in n}
    t1_map: Dict[int, tuple] = {}
    t2_map: Dict[int, tuple] = {}
    frb_map: Dict[int, float] = {}
    fro_map: Dict[int, float] = {}

    for b in isa.get("benchmarks") or []:
        b_name = b.get("name")
        for s in b.get("sites") or []:
            nids = s.get("node_ids") or []
            if not nids:
                continue
            nid = nids[0]
            for c in s.get("characteristics") or []:
                c_name = c.get("name")
                val = c.get("value")
                err = c.get("error") or 0.0
                if val is None:
                    continue
                if b_name == "FreeInversionRecovery" or c_name == "T1":
                    t1_map[nid] = (val * 1e6, err * 1e6)
                elif b_name == "FreeInductionDecay" or c_name == "T2":
                    t2_map[nid] = (val * 1e6, err * 1e6)
                elif c_name == "fRB":
                    frb_map[nid] = val

    for inst in isa.get("instructions") or []:
        for s in inst.get("sites") or []:
            nids = s.get("node_ids") or []
            if not nids:
                continue
            nid = nids[0]
            for c in s.get("characteristics") or []:
                if c.get("name") == "fRO" and c.get("value") is not None:
                    fro_map[nid] = c.get("value")

    qubits = []
    for q_idx in sorted(node_set):
        row: Dict[str, Any] = {"qubit_index": q_idx}
        if q_idx in t1_map:
            row["t1"] = round(t1_map[q_idx][0], 2)
        if q_idx in t2_map:
            row["t2"] = round(t2_map[q_idx][0], 2)
        if q_idx in fro_map:
            fro = fro_map[q_idx]
            row["readout_error"] = round(max(0.0, 1.0 - fro), 4)
            row["modality_metrics"] = {
                "readout_fidelity": round(fro, 4),
                "gate_fidelity_1q": round(frb_map[q_idx], 4) if q_idx in frb_map else None,
                "t1_uncertainty_us": round(t1_map[q_idx][1], 3) if q_idx in t1_map else None,
                "t2_uncertainty_us": round(t2_map[q_idx][1], 3) if q_idx in t2_map else None,
            }
        elif q_idx in frb_map:
            row["modality_metrics"] = {"gate_fidelity_1q": round(frb_map[q_idx], 4)}
        qubits.append(row)

    gates = []
    for inst in isa.get("instructions") or []:
        gate_name = str(inst.get("name") or "").lower()
        for s in inst.get("sites") or []:
            node_ids = s.get("node_ids") or []
            if node_ids:
                gates.append({"gate_name": gate_name, "qubits": node_ids})

    return {
        "calibration_identifier": f"qcs_isa_{backend_id}",
        "calibration_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "qubits": qubits,
        "gates": gates[:200],
        "source": "qcs_public_isa",
    }


def parse_isa_connectivity(isa: Dict[str, Any], backend_id: str) -> List[Dict[str, Any]]:
    edges = []
    for e in (isa.get("architecture") or {}).get("edges") or []:
        nids = e.get("node_ids") or []
        if len(nids) >= 2:
            edges.append({
                "edge_id": f"{backend_id}_{nids[0]}_{nids[1]}",
                "source_qubit": nids[0],
                "target_qubit": nids[1],
                "qubits": [nids[0], nids[1]],
            })
    return edges


class RigettiProviderAdapter(BaseProviderAdapter):
    QCS_API_BASE = QCS_API_BASE
    DEFAULT_PROCESSOR = DEFAULT_PROCESSOR

    def __init__(self, api_key: Optional[str] = None):
        raw_key = (api_key or settings.RIGETTI_API_KEY or os.getenv("RIGETTI_API_KEY", "") or os.getenv("QCS_API_KEY", "")).strip()
        self.custom_isa_url = raw_key if raw_key.startswith("http://") or raw_key.startswith("https://") else None
        self.api_key = "" if self.custom_isa_url else raw_key
        self.is_authenticated = bool(self.api_key and len(self.api_key) > 10)
        self._cached_isa: Dict[str, Any] = {}
        self._cache_timestamps: Dict[str, float] = {}
        self._cache_ttl_seconds = 120
        self._last_isa_ok = False

    def lineage_mode(self) -> str:
        return "live"

    def authenticate(self) -> bool:
        return True

    def _get_headers(self, with_auth: bool = True) -> Dict[str, str]:
        headers = {"User-Agent": UA, "Accept": "application/json"}
        if with_auth and self.is_authenticated and not self.api_key.startswith("http"):
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _http_json(self, url: str, timeout: int = 20) -> Optional[Dict[str, Any]]:
        last_err: Optional[Exception] = None
        for with_auth in (True, False):
            try:
                req = urllib.request.Request(url, headers=self._get_headers(with_auth=with_auth))
                with urllib.request.urlopen(req, timeout=timeout) as response:
                    if response.status == 200:
                        return json.loads(response.read().decode("utf-8"))
            except urllib.error.HTTPError as he:
                last_err = he
                if he.code in (401, 403) and with_auth:
                    continue
                logger.warning("Rigetti HTTP %s for %s", he.code, url)
                break
            except Exception as exc:
                last_err = exc
                logger.warning("Rigetti request failed %s: %s", url, exc)
                break
        if last_err:
            logger.debug("Rigetti last error: %s", last_err)
        return None

    def _fetch_instruction_set_architecture(self, processor_id: str = DEFAULT_PROCESSOR) -> Optional[Dict[str, Any]]:
        now = time.time()
        cache_key = self.custom_isa_url or processor_id
        if cache_key in self._cached_isa and (now - self._cache_timestamps.get(cache_key, 0)) < self._cache_ttl_seconds:
            self._last_isa_ok = True
            return self._cached_isa[cache_key]

        url = self.custom_isa_url or f"{self.QCS_API_BASE}/quantumProcessors/{processor_id}/instructionSetArchitecture"
        data = self._http_json(url)
        if data:
            self._cached_isa[cache_key] = data
            self._cache_timestamps[cache_key] = now
            self._last_isa_ok = True
            return data
        cached = self._cached_isa.get(cache_key)
        self._last_isa_ok = bool(cached)
        return cached

    def _list_quantum_processors(self) -> List[str]:
        data = self._http_json(f"{self.QCS_API_BASE}/quantumProcessors", timeout=15)
        if data:
            processors = data.get("quantumProcessors") or []
            ids = [p["id"] for p in processors if isinstance(p, dict) and p.get("id")]
            if ids:
                return ids
        return [self.DEFAULT_PROCESSOR]

    def discover_backends(self) -> List[Dict[str, Any]]:
        backends: List[Dict[str, Any]] = []
        for proc_id in self._list_quantum_processors():
            isa = self._fetch_instruction_set_architecture(proc_id)
            if not isa:
                continue
            source = self.custom_isa_url or f"{self.QCS_API_BASE}/quantumProcessors/{proc_id}/instructionSetArchitecture"
            backends.append(parse_isa_backend(isa, proc_id, source))

        if backends:
            return backends
        if settings.ENABLE_MOCK_DATA:
            b = get_mock_backend("rigetti_aspen_m3")
            return [b] if b else []
        return []

    def get_backend_status(self, backend_id: str) -> Dict[str, Any]:
        isa = self._fetch_instruction_set_architecture(_processor_id_from_backend(backend_id))
        return {
            "backend_id": backend_id,
            "operational": bool(isa),
            "pending_jobs": None,
            "estimated_wait_time": None,
            "status_message": "ISA catalog reachable; job queue is not published on this OpenAPI" if isa else "QCS ISA unavailable",
            "queue_condition": "UNKNOWN",
        }

    def get_backend_properties(self, backend_id: str) -> Dict[str, Any]:
        isa = self._fetch_instruction_set_architecture(_processor_id_from_backend(backend_id))
        if isa:
            return parse_isa_properties(isa, backend_id)
        if settings.ENABLE_MOCK_DATA:
            return get_mock_backend_properties(backend_id)
        return {"calibration_identifier": f"qcs_isa_{backend_id}", "qubits": [], "gates": [], "source": "unavailable"}

    def get_connectivity(self, backend_id: str) -> List[Dict[str, Any]]:
        isa = self._fetch_instruction_set_architecture(_processor_id_from_backend(backend_id))
        if isa:
            edges = parse_isa_connectivity(isa, backend_id)
            if edges:
                return edges
        if settings.ENABLE_MOCK_DATA:
            return get_mock_connectivity(backend_id)
        return []

    def get_jobs(self, backend_id: str, limit: int = 15) -> List[Dict[str, Any]]:
        if settings.ENABLE_MOCK_DATA and not self._last_isa_ok:
            return get_mock_jobs(backend_id, limit=limit)
        return []
