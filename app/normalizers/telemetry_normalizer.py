import datetime
from typing import Dict, Any, Tuple

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

class TelemetryNormalizer:
    """
    Converts raw multi-hardware provider telemetry into standardized internal entities.
    Handles superconducting transmon, trapped-ion, neutral atom, and simulation modalities.
    """
    @staticmethod
    def normalize_backend_status(
        raw_status: Dict[str, Any],
        provider_id: str = "ibm_quantum",
        lineage: str = "live",
    ) -> Dict[str, Any]:
        from app.core.provenance import format_telemetry_source

        coll_time = utcnow()
        operational = raw_status.get("operational", True)

        return {
            "backend_id": str(raw_status.get("backend_id", "unknown")),
            "operational": bool(operational),
            "pending_jobs": int(raw_status["pending_jobs"]) if raw_status.get("pending_jobs") is not None else None,
            "estimated_wait_time": float(raw_status["estimated_wait_time"]) if raw_status.get("estimated_wait_time") is not None else None,
            "telemetry_source": format_telemetry_source(lineage, provider_id),
            "data_quality": "VALID" if operational else "DEGRADED",
            "timestamp": coll_time
        }

    @staticmethod
    def normalize_qubit_metric(qubit_raw: Dict[str, Any], backend_id: str) -> Dict[str, Any]:
        coll_time = utcnow()
        t1 = qubit_raw.get("t1")
        t2 = qubit_raw.get("t2")
        readout = qubit_raw.get("readout_error")
        
        quality = "VALID"
        if t1 is None or t2 is None or readout is None:
            quality = "PARTIAL_MISSING"
        elif t1 <= 0 or t2 <= 0:
            quality = "INVALID_RANGE"

        modality_metrics = qubit_raw.get("modality_extras") or qubit_raw.get("modality_metrics") or {}
        if not modality_metrics:
            # Infer from raw payload
            if "anharmonicity" in qubit_raw:
                modality_metrics["anharmonicity_mhz"] = qubit_raw["anharmonicity"]
            if "prob_meas0_prep1" in qubit_raw:
                modality_metrics["prob_meas0_prep1"] = qubit_raw["prob_meas0_prep1"]
            if "prob_meas1_prep0" in qubit_raw:
                modality_metrics["prob_meas1_prep0"] = qubit_raw["prob_meas1_prep0"]

        return {
            "backend_id": backend_id,
            "qubit_index": int(qubit_raw.get("qubit_index", 0)),
            "t1": float(t1) if t1 is not None else None,
            "t2": float(t2) if t2 is not None else None,
            "frequency": float(qubit_raw["frequency"]) if qubit_raw.get("frequency") is not None else None,
            "readout_error": float(readout) if readout is not None else None,
            "modality_metrics": modality_metrics if modality_metrics else None,
            "source_timestamp": qubit_raw.get("source_timestamp") or coll_time,
            "timestamp": coll_time,
            "data_quality": quality
        }

    @staticmethod
    def normalize_gate_metric(gate_raw: Dict[str, Any], backend_id: str) -> Dict[str, Any]:
        coll_time = utcnow()
        ge = gate_raw.get("gate_error")
        if ge is None:
            ge = gate_raw.get("error_rate")
        dur = gate_raw.get("gate_duration")
        if dur is None:
            dur = gate_raw.get("gate_length")
        return {
            "backend_id": backend_id,
            "gate_name": str(gate_raw.get("gate_name", "unknown")),
            "qubits": list(gate_raw.get("qubits", [])),
            "gate_error": float(ge) if ge is not None else None,
            "gate_duration": float(dur) if dur is not None else None,
            "source_timestamp": gate_raw.get("source_timestamp") or coll_time,
            "timestamp": coll_time,
            "data_quality": "VALID"
        }
