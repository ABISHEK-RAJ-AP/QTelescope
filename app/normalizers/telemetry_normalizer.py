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
        from app.core.metric_bounds import (
            clamp_positive_time_us,
            clamp_probability,
            had_invalid_range,
        )

        t1_raw = qubit_raw.get("t1")
        t2_raw = qubit_raw.get("t2")
        ro_raw = qubit_raw.get("readout_error")
        t1 = clamp_positive_time_us(t1_raw) if t1_raw is not None else None
        t2 = clamp_positive_time_us(t2_raw) if t2_raw is not None else None
        readout = clamp_probability(ro_raw) if ro_raw is not None else None

        quality = "VALID"
        if t1 is None or t2 is None or readout is None:
            quality = "PARTIAL_MISSING"
        elif (
            had_invalid_range(t1_raw, t1)
            or had_invalid_range(t2_raw, t2)
            or had_invalid_range(ro_raw, readout)
        ):
            quality = "CLAMPED_RANGE"

        modality_metrics = qubit_raw.get("modality_extras") or qubit_raw.get("modality_metrics") or {}
        if not modality_metrics:
            # Infer from raw payload
            if "anharmonicity" in qubit_raw:
                modality_metrics["anharmonicity_mhz"] = qubit_raw["anharmonicity"]
            if "prob_meas0_prep1" in qubit_raw:
                modality_metrics["prob_meas0_prep1"] = clamp_probability(qubit_raw["prob_meas0_prep1"])
            if "prob_meas1_prep0" in qubit_raw:
                modality_metrics["prob_meas1_prep0"] = clamp_probability(qubit_raw["prob_meas1_prep0"])

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
        from app.core.metric_bounds import (
            clamp_positive_time_us,
            clamp_probability,
            had_invalid_range,
        )

        ge_raw = gate_raw.get("gate_error")
        if ge_raw is None:
            ge_raw = gate_raw.get("error_rate")
        dur_raw = gate_raw.get("gate_duration")
        if dur_raw is None:
            dur_raw = gate_raw.get("gate_length")
        ge = clamp_probability(ge_raw) if ge_raw is not None else None
        dur = clamp_positive_time_us(dur_raw, floor_us=0.001) if dur_raw is not None else None
        quality = "VALID"
        if ge_raw is not None and had_invalid_range(ge_raw, ge):
            quality = "CLAMPED_RANGE"
        if dur_raw is not None and had_invalid_range(dur_raw, dur):
            quality = "CLAMPED_RANGE"
        return {
            "backend_id": backend_id,
            "gate_name": str(gate_raw.get("gate_name", "unknown")),
            "qubits": list(gate_raw.get("qubits", [])),
            "gate_error": ge,
            "gate_duration": dur,
            "source_timestamp": gate_raw.get("source_timestamp") or coll_time,
            "timestamp": coll_time,
            "data_quality": quality,
        }
