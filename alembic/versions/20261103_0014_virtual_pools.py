"""Virtual resource pools (S5 metadata only).

Revision ID: 20261103_0014
Revises: 20261103_0013
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect

revision: str = "20261103_0014"
down_revision: Union[str, None] = "20261103_0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ("virtual_resource_pools", "virtual_resource_pool_members")


def upgrade() -> None:
    import app.models.development  # noqa: F401
    from app.core.database import Base

    bind = op.get_bind()
    present = set(inspect(bind).get_table_names())
    for name in TABLES:
        if name not in present:
            Base.metadata.tables[name].create(bind=bind)


def downgrade() -> None:
    for name in reversed(TABLES):
        op.drop_table(name)
