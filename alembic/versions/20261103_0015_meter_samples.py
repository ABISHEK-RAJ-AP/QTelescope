"""Meter samples for capacity rollups (S9).

Revision ID: 20261103_0015
Revises: 20261103_0014
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect

revision: str = "20261103_0015"
down_revision: Union[str, None] = "20261103_0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "meter_samples"


def upgrade() -> None:
    import app.models.development  # noqa: F401
    from app.core.database import Base

    bind = op.get_bind()
    if TABLE not in set(inspect(bind).get_table_names()):
        Base.metadata.tables[TABLE].create(bind=bind)


def downgrade() -> None:
    op.drop_table(TABLE)
