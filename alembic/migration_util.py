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


def drop_column_server_default(table: str, column: str) -> None:
    """Remove a column default after backfill. SQLite has no ALTER COLUMN DROP DEFAULT."""
    if op.get_bind().dialect.name == "sqlite":
        return
    op.alter_column(table, column, server_default=None)
