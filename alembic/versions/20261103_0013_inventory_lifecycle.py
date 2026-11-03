"""Add inventory_assets.lifecycle_state (S3).

Revision ID: 20261103_0013
Revises: 20261103_0012
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "20261103_0013"
down_revision: Union[str, None] = "20261103_0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if "inventory_assets" not in inspect(bind).get_table_names():
        return
    cols = {c["name"] for c in inspect(bind).get_columns("inventory_assets")}
    if "lifecycle_state" not in cols:
        op.add_column(
            "inventory_assets",
            sa.Column("lifecycle_state", sa.String(), nullable=False, server_default="active"),
        )
        op.alter_column("inventory_assets", "lifecycle_state", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    if "inventory_assets" not in inspect(bind).get_table_names():
        return
    cols = {c["name"] for c in inspect(bind).get_columns("inventory_assets")}
    if "lifecycle_state" in cols:
        op.drop_column("inventory_assets", "lifecycle_state")
