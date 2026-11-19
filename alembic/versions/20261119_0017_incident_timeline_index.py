"""Incident timeline ordering index.

Revision ID: 20261119_0017
Revises: 20261109_0016
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20261119_0017"
down_revision: Union[str, None] = "20261109_0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from migration_util import index_exists

    if not index_exists("ix_incidents_last_detected_at"):
        op.create_index(
            "ix_incidents_last_detected_at",
            "incidents",
            ["last_detected_at"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index("ix_incidents_last_detected_at", table_name="incidents")