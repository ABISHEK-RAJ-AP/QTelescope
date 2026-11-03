#!/usr/bin/env python3
"""Copy SQLite data into PostgreSQL (batched). Run after Postgres schema is migrated."""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

BATCH = 5000
TELEMETRY_TABLE = "qubit_telemetry"

# FK-safe load order (parents before children)
TABLE_ORDER = [
    "providers",
    "backends",
    "qubits",
    "gates",
    "connectivity_edges",
    "alert_rules",
    "collection_schedules",
    "backend_telemetry",
    "calibration_snapshots",
    "gate_telemetry",
    "job_records",
    "alerts",
    "incidents",
    "incident_alerts",
    "evidence_snapshots",
    "user_accounts",
    "audit_events",
    TELEMETRY_TABLE,
]


def row_count(engine, table: str) -> int:
    with engine.connect() as conn:
        return conn.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar_one()


def table_names(engine) -> list[str]:
    return sorted(inspect(engine).get_table_names())


def _is_bool_col(col: dict) -> bool:
    from sqlalchemy import Boolean

    t = col.get("type")
    return isinstance(t, Boolean) or "BOOLEAN" in str(t).upper()


def _coerce_row(row: dict, dst_cols: dict) -> dict:
    out = dict(row)
    for name, col in dst_cols.items():
        if name not in out or out[name] is None:
            continue
        val = out[name]
        if _is_bool_col(col) and isinstance(val, int):
            out[name] = bool(val)
    return out


def copy_table(
    src_sess,
    dst_sess,
    table: str,
    batch: int,
    *,
    valid_backend_ids: set[str] | None = None,
) -> tuple[int, int]:
    meta = inspect(src_sess.bind)
    if table not in meta.get_table_names():
        return 0, 0
    dst_meta = inspect(dst_sess.bind)
    dst_cols = {c["name"]: c for c in dst_meta.get_columns(table)}
    cols = [c["name"] for c in meta.get_columns(table)]
    col_list = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join(f":{c}" for c in cols)
    src = src_sess.bind
    dst = dst_sess.bind
    total = row_count(src, table)
    if total == 0:
        return 0, 0
    migrated = 0
    offset = 0
    pk = meta.get_pk_constraint(table).get("constrained_columns") or []
    order = pk[0] if pk else cols[0]
    while offset < total:
        rows = src_sess.execute(
            text(f'SELECT {col_list} FROM "{table}" ORDER BY "{order}" LIMIT :lim OFFSET :off'),
            {"lim": batch, "off": offset},
        ).mappings().all()
        if not rows:
            break
        payload = [_coerce_row(dict(r), dst_cols) for r in rows]
        if valid_backend_ids is not None and payload and "backend_id" in payload[0]:
            payload = [r for r in payload if r.get("backend_id") in valid_backend_ids]
        if not payload:
            offset += batch
            continue
        dst_sess.execute(
            text(f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'),
            payload,
        )
        dst_sess.commit()
        migrated += len(rows)
        offset += batch
        print(f"  {table}: {migrated}/{total}", flush=True)
    return total, migrated


def reset_sequences(dst_engine) -> None:
    if dst_engine.dialect.name != "postgresql":
        return
    insp = inspect(dst_engine)
    with dst_engine.connect() as conn:
        for table in insp.get_table_names():
            pk = insp.get_pk_constraint(table).get("constrained_columns") or []
            if len(pk) != 1:
                continue
            col = pk[0]
            cols = insp.get_columns(table)
            if not any(c["name"] == col and c.get("autoincrement") for c in cols):
                continue
            seq = conn.execute(
                text("SELECT pg_get_serial_sequence(:tbl, :col)"),
                {"tbl": table, "col": col},
            ).scalar()
            if not seq:
                continue
            mx = conn.execute(text(f'SELECT COALESCE(MAX("{col}"), 0) FROM "{table}"')).scalar_one()
            conn.execute(text("SELECT setval(:seq, :v, true)"), {"seq": seq, "v": mx})
        conn.commit()


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate SQLite → PostgreSQL")
    parser.add_argument(
        "--sqlite",
        default=os.getenv("SQLITE_URL", "sqlite:///./data/qtelescope.db"),
        help="Source SQLite URL",
    )
    parser.add_argument(
        "--postgres",
        default=os.getenv("DATABASE_URL", ""),
        help="Target PostgreSQL URL",
    )
    parser.add_argument("--batch", type=int, default=BATCH)
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="TRUNCATE all destination tables before copy (PostgreSQL only)",
    )
    args = parser.parse_args()
    if not args.postgres or args.postgres.startswith("sqlite"):
        print("Set DATABASE_URL to PostgreSQL (postgresql+psycopg2://...)", file=sys.stderr)
        return 1
    src_engine = create_engine(args.sqlite, connect_args={"check_same_thread": False})
    dst_engine = create_engine(args.postgres)
    src_sess = sessionmaker(bind=src_engine)()
    dst_sess = sessionmaker(bind=dst_engine)()
    if args.fresh and dst_engine.dialect.name == "postgresql":
        with dst_engine.connect() as conn:
            names = table_names(dst_engine)
            if names:
                quoted = ", ".join(f'"{t}"' for t in names)
                conn.execute(text(f"TRUNCATE {quoted} RESTART IDENTITY CASCADE"))
                conn.commit()
            print("Truncated destination tables (--fresh).", flush=True)

    tables = table_names(src_engine)
    skip = {"alembic_version"}
    ordered = [t for t in TABLE_ORDER if t in tables]
    ordered += [t for t in tables if t not in skip and t not in ordered]
    valid_backends = {
        r[0]
        for r in src_sess.execute(text('SELECT backend_id FROM "backends"')).all()
    }
    fk_backend_tables = {
        "backend_telemetry",
        "qubit_telemetry",
        "gate_telemetry",
        "calibration_snapshots",
        "job_records",
        "connectivity_edges",
        "qubits",
        "gates",
        "incidents",
    }
    _bids = list(valid_backends)
    if _bids:
        _ph = ", ".join(f":b{i}" for i in range(len(_bids)))
        _params = {f"b{i}": v for i, v in enumerate(_bids)}
        valid_incidents = {
            r[0]
            for r in src_sess.execute(
                text(f'SELECT incident_id FROM "incidents" WHERE backend_id IN ({_ph})'),
                _params,
            ).all()
        }
    else:
        valid_incidents = set()
    valid_alerts = {r[0] for r in src_sess.execute(text('SELECT alert_id FROM "alerts"')).all()}
    report = []
    for table in ordered:
        if table == "incident_alerts":
            rows = src_sess.execute(text('SELECT * FROM "incident_alerts"')).mappings().all()
            payload = [
                dict(r)
                for r in rows
                if r["incident_id"] in valid_incidents and r["alert_id"] in valid_alerts
            ]
            if payload:
                cols = list(payload[0].keys())
                col_list = ", ".join(f'"{c}"' for c in cols)
                ph = ", ".join(f":{c}" for c in cols)
                dst_sess.execute(
                    text(f'INSERT INTO "incident_alerts" ({col_list}) VALUES ({ph}) ON CONFLICT DO NOTHING'),
                    payload,
                )
                dst_sess.commit()
            src_n, mig = len(rows), len(payload)
            dst_n = row_count(dst_engine, table)
            report.append((table, src_n, dst_n, mig))
            continue
        fk = valid_backends if table in fk_backend_tables else None
        src_n, mig = copy_table(src_sess, dst_sess, table, args.batch, valid_backend_ids=fk)
        dst_n = row_count(dst_engine, table) if src_n else 0
        report.append((table, src_n, dst_n, mig))
    reset_sequences(dst_engine)
    print("\n=== Migration report ===")
    ok = True
    for table, src_n, dst_n, mig in report:
        status = "OK" if dst_n >= src_n or src_n == 0 else "MISMATCH"
        if status != "OK":
            ok = False
        print(f"{table}: source={src_n} dest={dst_n} migrated={mig} [{status}]")
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
