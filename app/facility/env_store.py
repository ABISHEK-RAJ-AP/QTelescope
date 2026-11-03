"""Persisted facility / environment samples (JSON file)."""
from __future__ import annotations

import json
import os
from typing import Any, Dict, List

from app.providers.catalog import DATA_DIR

ENV_PATH = os.path.join(DATA_DIR, "environment_telemetry.json")
FACILITY_INBOX = os.path.join(DATA_DIR, "facility_inbox")

CHANNELS = (
    "cryo_temp_mK",
    "pulse_tube",
    "vacuum_mbar",
    "rf_power_dbm",
    "magnetic_field_uT",
    "lab_humidity_pct",
)


def load_rows() -> List[Dict[str, Any]]:
    if not os.path.exists(ENV_PATH):
        return []
    try:
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def save_rows(rows: List[Dict[str, Any]]) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(ENV_PATH, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)
