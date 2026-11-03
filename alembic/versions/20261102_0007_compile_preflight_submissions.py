"""Compilation, preflight, workload submission tables.

Revision ID: 20261102_0007
Revises: 20261102_0006
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20261102_0007"
down_revision: Union[str, None] = "20261102_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = (
    "compilation_runs",
    "preflight_reports",
    "workload_submissions",
)


def upgrade() -> None:
    from migration_util import table_exists

    import app.models.development  # noqa: F401
    from app.core.database import Base

    bind = op.get_bind()
    for name in _TABLES:
        if table_exists(name):
            continue
        Base.metadata.tables[name].create(bind=bind)


def downgrade() -> None:
    for name in reversed(_TABLES):
        op.drop_table(name)
