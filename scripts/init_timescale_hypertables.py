#!/usr/bin/env python3
"""Convert high-volume telemetry tables to Timescale hypertables (idempotent)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, text

HYPERTABLES = (
    ("gate_telemetry", "timestamp"),
    ("qubit_telemetry", "timestamp"),
    ("backend_telemetry", "timestamp"),
    ("calibration_snapshots", "timestamp"),
)


def _resolve_database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if url.startswith("postgresql"):
        return url
    envf = ROOT / ".env"
    if envf.is_file():
        for line in envf.read_text(encoding="utf-8").splitlines():
            if line.startswith("DATABASE_URL="):
                url = line.split("=", 1)[1].strip().strip("'\"")
                if url.startswith("postgresql"):
                    return url
    return url


def main() -> int:
    url = _resolve_database_url()
    if not url.startswith("postgresql"):
        print(
            "DATABASE_URL must be PostgreSQL (export DATABASE_URL=... or set in .env)",
            file=sys.stderr,
        )
        return 1
    engine = create_engine(url)
    with engine.connect() as conn:
        ext = conn.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'")).scalar()
        if not ext:
            print("TimescaleDB extension not installed — skip or use timescale/timescaledb image", file=sys.stderr)
            return 2
        for table, time_col in HYPERTABLES:
            exists = conn.execute(
                text("SELECT to_regclass(:t)"), {"t": table},
            ).scalar()
            if not exists:
                print(f"skip {table} (missing)")
                continue
            already = conn.execute(
                text(
                    "SELECT 1 FROM timescaledb_information.hypertables "
                    "WHERE hypertable_name = :t"
                ),
                {"t": table},
            ).scalar()
            if already:
                print(f"ok {table} (already hypertable)")
                continue
            conn.execute(text(f"SELECT create_hypertable('{table}', '{time_col}', if_not_exists => TRUE)"))
            conn.commit()
            print(f"ok {table} → hypertable on {time_col}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())