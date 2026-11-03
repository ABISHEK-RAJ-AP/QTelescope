"""Dispatch attempts (G3 domain B, no connector yet).

Revision ID: 20261103_0012
Revises: 20261103_0011
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect

revision: str = "20261103_0012"
down_revision: Union[str, None] = "20261103_0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "dispatch_attempts"


def upgrade() -> None:
    import app.models.development  # noqa: F401
    from app.core.database import Base

    bind = op.get_bind()
    if TABLE not in set(inspect(bind).get_table_names()):
        Base.metadata.tables[TABLE].create(bind=bind)


def downgrade() -> None:
    op.drop_table(TABLE)
