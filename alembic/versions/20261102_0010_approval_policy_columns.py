"""policy id and version on approval_records.

Revision ID: 20261102_0010
Revises: 20261102_0009
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "20261102_0010"
down_revision: Union[str, None] = "20261102_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has(table: str, column: str) -> bool:
    cols = {c["name"] for c in inspect(op.get_bind()).get_columns(table)}
    return column in cols


def upgrade() -> None:
    if not _has("approval_records", "policy_id"):
        op.add_column("approval_records", sa.Column("policy_id", sa.String(), nullable=True))
    if not _has("approval_records", "policy_version"):
        op.add_column("approval_records", sa.Column("policy_version", sa.String(), nullable=True))


def downgrade() -> None:
    if _has("approval_records", "policy_version"):
        op.drop_column("approval_records", "policy_version")
    if _has("approval_records", "policy_id"):
        op.drop_column("approval_records", "policy_id")
