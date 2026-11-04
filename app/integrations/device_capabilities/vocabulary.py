"""Normalized status codes for device capability sheets.

Integer codes are stable for clients; string labels are the interchange format.
"""

DEVICE_STATUS = {
    "OFFLINE": 0,
    "IDLE": 1,
    "BUSY": 2,
    "ERROR": 3,
    "MAINTENANCE": 4,
    "CALIBRATION": 5,
}

JOB_STATUS = {
    "CREATED": 0,
    "SUBMITTED": 1,
    "QUEUED": 2,
    "RUNNING": 3,
    "DONE": 4,
    "CANCELED": 5,
    "FAILED": 6,
}

SCHEMA_VERSION = "device-capabilities/1.0"

COVERAGE = {
    "covered": [
        "name",
        "version",
        "status",
        "qubit_count",
        "queue_depth",
        "coupling_map",
        "duration_unit",
        "qubits.t1_us / t2_us",
        "gates.name / fidelity / duration_us",
        "job status sample",
    ],
    "partial": [
        "per-job queue position (fleet depth only today)",
        "qubit zones / spatial layout",
    ],
    "planned": [
        "neutral-atom length / shuttle metrics",
        "benchmark suite ingest into evidence packs",
        "optional foreign device-plugin collector",
    ],
}
