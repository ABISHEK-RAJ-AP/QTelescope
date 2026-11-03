"""Idempotent migration helpers (0001 bootstrap uses create_all)."""
from __future__ import annotations

from alembic import op
from sqlalchemy import inspect


def table_exists(name: str) -> bool:
    return name in inspect(op.get_bind()).get_table_names()


def index_exists(name: str) -> bool:
    bind = op.get_bind()
    insp = inspect(bind)
    for table in insp.get_table_names():
        for idx in insp.get_indexes(table):
            if idx.get("name") == name:
                return True
    return False
